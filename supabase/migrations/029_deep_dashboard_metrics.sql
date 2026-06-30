create or replace function public.dashboard_deep_metrics(p_section text,p_from date,p_to date,p_limit integer default 500)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare rows jsonb:='[]'::jsonb; summary jsonb:='{}'::jsonb; org uuid:=current_organization_id(); lim int:=least(greatest(p_limit,1),2000);
begin
  if p_section in ('ads','product-ads','source-ads','video') then
    with grouped as (
      select case p_section when 'product-ads' then coalesce(nullif(product_code,''),nullif(product_external_id,''),'Không xác định')
        when 'source-ads' then source_type when 'video' then coalesce(nullif(video_title,''),nullif(video_id,''),'Không có video') else campaign_name end label,
        case when p_section='video' then source_type else '' end source_type,
        sum(spend) spend,sum(revenue) revenue,sum(orders) orders,sum(impressions) impressions,sum(clicks) clicks,
        case when sum(impressions)>0 then sum(view_2s_rate*impressions)/sum(impressions) else 0 end view_2s_rate,
        case when sum(impressions)>0 then sum(view_6s_rate*impressions)/sum(impressions) else 0 end view_6s_rate,
        case when sum(impressions)>0 then sum(view_25_rate*impressions)/sum(impressions) else 0 end view_25_rate,
        case when sum(impressions)>0 then sum(view_50_rate*impressions)/sum(impressions) else 0 end view_50_rate,
        case when sum(impressions)>0 then sum(view_75_rate*impressions)/sum(impressions) else 0 end view_75_rate,
        case when sum(impressions)>0 then sum(view_100_rate*impressions)/sum(impressions) else 0 end view_100_rate
      from tiktok_ad_records where organization_id=org and metric_date between p_from and p_to group by 1,2 order by spend desc limit lim
    ) select coalesce(jsonb_agg(to_jsonb(grouped)),'[]'),jsonb_build_object('spend',coalesce(sum(spend),0),'revenue',coalesce(sum(revenue),0),'orders',coalesce(sum(orders),0),'impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0)) into rows,summary from grouped;
  elsif p_section in ('creators','commission') then
    with grouped as (
      select coalesce(nullif(creator_display_name,''),creator_username) label,sum(payment_amount) revenue,count(distinct order_id) orders,sum(quantity) quantity,
        sum(actual_standard_commission) standard_commission,sum(actual_ad_commission) ad_commission,
        sum(actual_standard_commission+actual_ad_commission) spend,
        case when sum(payment_amount)>0 then sum(actual_standard_commission+actual_ad_commission)/sum(payment_amount) else 0 end commission_rate
      from tiktok_affiliate_order_lines where organization_id=org and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
      group by 1 order by revenue desc limit lim
    ) select coalesce(jsonb_agg(to_jsonb(grouped)),'[]'),jsonb_build_object('revenue',coalesce(sum(revenue),0),'orders',coalesce(sum(orders),0),'quantity',coalesce(sum(quantity),0),'spend',coalesce(sum(spend),0),'standard_commission',coalesce(sum(standard_commission),0),'ad_commission',coalesce(sum(ad_commission),0)) into rows,summary from grouped;
  elsif p_section='booking' then
    with grouped as (
      select bc.creator_name_snapshot label,bc.status,coalesce(c.start_date,current_date)::text date,bc.agreed_fee spend,
        1 quantity,count(distinct bo.id) orders,count(distinct bv.id) videos,
        case when bc.status not in ('pending','draft') then 1 else 0 end replied,
        case when count(distinct bo.id)>0 then 1 else 0 end booked,
        case when count(distinct bv.id)>0 then 1 else 0 end produced,
        case when count(distinct bv.id)filter(where bv.published_at is not null)>0 then 1 else 0 end published
      from booking_creators bc join booking_campaigns c on c.id=bc.campaign_id
      left join booking_orders bo on bo.booking_creator_id=bc.id left join booking_videos bv on bv.booking_creator_id=bc.id
      where c.organization_id=org and (c.start_date is null or c.start_date<=p_to) and (c.end_date is null or c.end_date>=p_from)
      group by bc.id,c.start_date order by c.start_date desc nulls last limit lim
    ) select coalesce(jsonb_agg(to_jsonb(grouped)),'[]'),jsonb_build_object('quantity',coalesce(sum(quantity),0),'customers',coalesce(sum(replied),0),'orders',coalesce(sum(orders),0),'videos',coalesce(sum(videos),0),'booked',coalesce(sum(booked),0),'produced',coalesce(sum(produced),0),'published',coalesce(sum(published),0),'spend',coalesce(sum(spend),0)) into rows,summary from grouped;
  elsif p_section in ('planner','weekly') then
    with grouped as (
      select title label,task_date::text date,status,priority,sort_order,
        case greatest(priority,1) when 1 then 1 when 2 then 2 else 3 end weight,
        case when status in('done','completed') then case greatest(priority,1) when 1 then 1 when 2 then 2 else 3 end else 0 end earned,
        case when task_date<current_date and status not in('done','completed') then 1 else 0 end overdue
      from planner_tasks where organization_id=org and task_date between p_from and p_to order by task_date,sort_order limit lim
    ) select coalesce(jsonb_agg(to_jsonb(grouped)),'[]'),jsonb_build_object('quantity',count(*),'orders',count(*)filter(where status in('done','completed')),'customers',count(*)filter(where status not in('done','completed')),'overdue',coalesce(sum(overdue),0),'score',case when sum(weight)>0 then sum(earned)*100.0/sum(weight) else 0 end) into rows,summary from grouped;
  elsif p_section in ('shopee','shopee-ads') then
    with grouped as (select d.metric_date::text label,d.revenue,d.orders,d.cancelled_orders,d.customers,d.ad_spend spend,d.ad_revenue from dashboard_daily d join channels c on c.id=d.channel_id where d.organization_id=org and c.code='shopee' and d.metric_date between p_from and p_to order by d.metric_date)
    select coalesce(jsonb_agg(to_jsonb(grouped)),'[]'),jsonb_build_object('revenue',coalesce(sum(revenue),0),'orders',coalesce(sum(orders),0),'cancelled_orders',coalesce(sum(cancelled_orders),0),'customers',coalesce(sum(customers),0),'spend',coalesce(sum(spend),0)) into rows,summary from grouped;
  elsif p_section='shopee-products' then
    with grouped as (select coalesce(p.name,'Không xác định')label,sum(x.gmv)revenue,sum(x.orders)orders,sum(x.units_sold)quantity,sum(x.visitors)customers,sum(x.page_views)impressions,sum(x.refund_amount)refund_amount from product_performance_daily x join channels c on c.id=x.channel_id left join products p on p.id=x.product_id where x.organization_id=org and c.code='shopee' and x.metric_date between p_from and p_to group by p.name order by revenue desc limit lim)
    select coalesce(jsonb_agg(to_jsonb(grouped)),'[]'),jsonb_build_object('revenue',coalesce(sum(revenue),0),'orders',coalesce(sum(orders),0),'quantity',coalesce(sum(quantity),0),'customers',coalesce(sum(customers),0),'impressions',coalesce(sum(impressions),0),'refund_amount',coalesce(sum(refund_amount),0)) into rows,summary from grouped;
  elsif p_section='shopee-traffic' then
    with grouped as (select source_name label,sum(visitors)customers,sum(product_views)impressions,sum(add_to_cart)atc,sum(checkout)checkout,sum(buyers)buyers,sum(orders)orders,sum(gmv)revenue from traffic_performance_daily x join channels c on c.id=x.channel_id where x.organization_id=org and c.code='shopee' and x.metric_date between p_from and p_to group by source_name order by impressions desc limit lim)
    select coalesce(jsonb_agg(to_jsonb(grouped)),'[]'),jsonb_build_object('customers',coalesce(sum(customers),0),'impressions',coalesce(sum(impressions),0),'atc',coalesce(sum(atc),0),'checkout',coalesce(sum(checkout),0),'buyers',coalesce(sum(buyers),0),'orders',coalesce(sum(orders),0),'revenue',coalesce(sum(revenue),0)) into rows,summary from grouped;
  else return public.dashboard_legacy(p_section,p_from,p_to,p_limit); end if;
  return jsonb_build_object('rows',rows,'summary',summary,'from',p_from,'to',p_to);
end $$;

revoke all on function public.dashboard_deep_metrics(text,date,date,integer) from public,anon;
grant execute on function public.dashboard_deep_metrics(text,date,date,integer) to authenticated;
