-- Re-imports are snapshots: replace the affected business keys/dates before rebuilding aggregates.
create or replace function public.finalize_order_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare j import_jobs%rowtype;
begin
  select * into j from import_jobs where id=p_job_id;
  if j.id is null or not public.can_edit(j.organization_id) then raise exception 'Not authorized'; end if;
  perform public.finalize_order_core_import(p_job_id);
  delete from tiktok_order_lines t using channels c
  where t.organization_id=j.organization_id and t.channel_id=c.id
    and exists(select 1 from import_staging s where s.import_job_id=p_job_id and s.payload->>'order_id'=t.order_id);
  insert into tiktok_order_lines(organization_id,channel_id,order_id,sku_id,seller_sku,product_name,ordered_at,quantity,line_gmv,is_cancelled,is_sample_order,raw_payload,import_job_id)
  select j.organization_id,c.id,s.payload->>'order_id',coalesce(s.payload->>'sku_id',''),coalesce(s.payload->>'seller_sku',''),coalesce(s.payload->>'product_name',''),
    (s.payload->>'ordered_at')::timestamptz,coalesce((s.payload->>'quantity')::numeric,0),coalesce((s.payload->>'line_gmv')::numeric,0),
    coalesce((s.payload->>'is_cancelled')::boolean,false),j.dataset_type='sample_orders',coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code=coalesce(s.payload->>'channel','tiktok') where s.import_job_id=p_job_id;
end $$;

create or replace function public.finalize_affiliate_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare j import_jobs%rowtype;
begin
  select * into j from import_jobs where id=p_job_id for update;
  if j.id is null or not public.can_edit(j.organization_id) then raise exception 'Not authorized'; end if;
  delete from tiktok_affiliate_order_lines a
  where a.organization_id=j.organization_id and exists(select 1 from import_staging s where s.import_job_id=p_job_id and s.payload->>'order_id'=a.order_id);
  insert into tiktok_affiliate_order_lines(organization_id,channel_id,order_id,product_external_id,product_name,sku_id,price,payment_amount,quantity,status,creator_username,creator_display_name,content_type,content_id,estimated_commission_base,estimated_ad_commission,actual_ad_commission,created_at,raw_payload,import_job_id)
  select j.organization_id,c.id,s.payload->>'order_id',coalesce(s.payload->>'product_external_id',''),coalesce(s.payload->>'product_name',''),coalesce(s.payload->>'sku_id',''),
    coalesce((s.payload->>'price')::numeric,0),coalesce((s.payload->>'payment_amount')::numeric,0),coalesce((s.payload->>'quantity')::numeric,0),coalesce(s.payload->>'status',''),
    coalesce(s.payload->>'creator_username',''),coalesce(am.display_name,s.payload->>'creator_username',''),coalesce(s.payload->>'content_type',''),coalesce(s.payload->>'content_id',''),
    coalesce((s.payload->>'estimated_commission_base')::numeric,0),coalesce((s.payload->>'estimated_ad_commission')::numeric,0),coalesce((s.payload->>'actual_ad_commission')::numeric,0),
    (s.payload->>'created_at')::timestamptz,coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code='tiktok'
  left join account_mappings am on am.organization_id=j.organization_id and am.channel_id=c.id and am.account_id=s.payload->>'creator_username'
  where s.import_job_id=p_job_id;
  update orders o set is_affiliate_order=true where o.organization_id=j.organization_id
    and exists(select 1 from tiktok_affiliate_order_lines a where a.organization_id=j.organization_id and a.order_id=o.external_order_id and a.import_job_id=p_job_id);
  update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;

create or replace function public.finalize_ads_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare j import_jobs%rowtype; dates date[];
begin
  select * into j from import_jobs where id=p_job_id for update;
  if j.id is null or not public.can_edit(j.organization_id) then raise exception 'Not authorized'; end if;
  select array_agg(distinct (payload->>'metric_date')::date) into dates from import_staging where import_job_id=p_job_id;
  delete from tiktok_ad_records where organization_id=j.organization_id and metric_date=any(dates);
  insert into tiktok_ad_records(organization_id,channel_id,metric_date,campaign_name,campaign_id,product_external_id,product_code,creative_type,video_title,video_id,account_name,source_type,posted_at,status,authorization_type,spend,orders,cpa,revenue,roi,impressions,clicks,ctr,conversion_rate,view_2s_rate,view_6s_rate,view_25_rate,view_50_rate,view_75_rate,view_100_rate,raw_payload,import_job_id)
  select j.organization_id,c.id,(s.payload->>'metric_date')::date,coalesce(s.payload->>'campaign_name',''),coalesce(s.payload->>'campaign_id',''),coalesce(s.payload->>'product_external_id',''),coalesce(pm.product_code,''),
    coalesce(s.payload->>'creative_type',''),coalesce(s.payload->>'video_title',''),coalesce(s.payload->>'video_id',''),coalesce(s.payload->>'account_name',''),
    case when lower(coalesce(s.payload->>'creative_type','')) like '%product card%' then 'product_card' when ih.account_name is not null then 'inhouse' else 'koc' end,
    nullif(s.payload->>'posted_at','')::timestamptz,coalesce(s.payload->>'status',''),coalesce(s.payload->>'authorization_type',''),
    coalesce((s.payload->>'spend')::numeric,0),coalesce((s.payload->>'orders')::numeric,0),coalesce((s.payload->>'cpa')::numeric,0),coalesce((s.payload->>'revenue')::numeric,0),coalesce((s.payload->>'roi')::numeric,0),
    coalesce((s.payload->>'impressions')::bigint,0),coalesce((s.payload->>'clicks')::bigint,0),coalesce((s.payload->>'ctr')::numeric,0),coalesce((s.payload->>'conversion_rate')::numeric,0),
    coalesce((s.payload->>'view_2s_rate')::numeric,0),coalesce((s.payload->>'view_6s_rate')::numeric,0),coalesce((s.payload->>'view_25_rate')::numeric,0),coalesce((s.payload->>'view_50_rate')::numeric,0),coalesce((s.payload->>'view_75_rate')::numeric,0),coalesce((s.payload->>'view_100_rate')::numeric,0),coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code='tiktok'
  left join product_mappings pm on pm.organization_id=j.organization_id and pm.channel_id=c.id and pm.external_product_id=s.payload->>'product_external_id'
  left join inhouse_accounts ih on ih.organization_id=j.organization_id and ih.channel_id=c.id and lower(ih.account_name)=lower(s.payload->>'account_name')
  where s.import_job_id=p_job_id;
  delete from ad_performance_daily where organization_id=j.organization_id and metric_date=any(dates);
  insert into ad_performance_daily(organization_id,channel_id,metric_date,campaign_external_id,ad_external_id,source_type,spend,revenue,orders,impressions,clicks,conversions,import_job_id)
  select organization_id,channel_id,metric_date,campaign_id,video_id,source_type,sum(spend),sum(revenue),sum(orders),sum(impressions),sum(clicks),sum(orders),p_job_id
  from tiktok_ad_records where organization_id=j.organization_id and metric_date=any(dates) group by 1,2,3,4,5,6;
  perform refresh_dashboard_dates(j.organization_id,dates);
  update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;

create or replace function public.finalize_product_analysis_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare j import_jobs%rowtype; dates date[];
begin
  select * into j from import_jobs where id=p_job_id for update;
  if j.id is null or not public.can_edit(j.organization_id) then raise exception 'Not authorized'; end if;
  select array_agg(distinct (payload->>'metric_date')::date) into dates from import_staging where import_job_id=p_job_id;
  delete from tiktok_product_analysis where organization_id=j.organization_id and metric_date=any(dates);
  insert into tiktok_product_analysis(organization_id,channel_id,metric_date,product_external_id,product_name,product_status,product_code,raw_payload,import_job_id)
  select j.organization_id,c.id,(s.payload->>'metric_date')::date,coalesce(nullif(s.payload->>'product_external_id',''),'name:'||md5(s.payload->>'product_name')),
    s.payload->>'product_name',coalesce(s.payload->>'product_status',''),coalesce(pm.product_code,''),coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code='tiktok'
  left join product_mappings pm on pm.organization_id=j.organization_id and pm.channel_id=c.id and pm.external_product_id=s.payload->>'product_external_id'
  where s.import_job_id=p_job_id and nullif(s.payload->>'product_name','') is not null;
  update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;

-- One aggregate endpoint feeds every read-only dashboard tab; no full fact table is sent to the browser.
create or replace function public.dashboard_section(p_section text,p_from date,p_to date,p_limit integer default 100)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare result jsonb; org uuid:=current_organization_id(); lim integer:=least(greatest(p_limit,1),500);
begin
  if p_section in ('products','shopee-products') then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.revenue desc),'[]') into result from (
      select p.name label,sum(oi.net_amount) revenue,count(distinct o.id) orders,sum(oi.quantity) quantity
      from orders o join channels c on c.id=o.channel_id join order_items oi on oi.order_id=o.id left join products p on p.id=oi.product_id
      where o.organization_id=org and o.order_date between p_from and p_to and not o.is_cancelled and not o.is_sample_order
        and c.code=case when p_section='shopee-products' then 'shopee' else 'tiktok' end
      group by p.name order by revenue desc limit lim)x;
  elsif p_section='sources' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.revenue desc),'[]') into result from (
      select case when is_affiliate_order then 'Affiliate/KOC' else 'Cửa hàng' end label,sum(net_gmv) revenue,count(*) orders
      from orders where organization_id=org and order_date between p_from and p_to and not is_cancelled and not is_sample_order group by 1)x;
  elsif p_section='costs' then
    with base as (select coalesce(sum(net_gmv),0) gmv,count(*) orders from orders where organization_id=org and order_date between p_from and p_to and not is_cancelled and not is_sample_order),
    ads as(select coalesce(sum(spend),0)v from tiktok_ad_records where organization_id=org and metric_date between p_from and p_to),
    aff as(select coalesce(sum(actual_ad_commission),0)v from tiktok_affiliate_order_lines where organization_id=org and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to),
    samples as(select count(distinct external_order_id)n from orders where organization_id=org and order_date between p_from and p_to and is_sample_order)
    select jsonb_agg(to_jsonb(x)) into result from (select * from (values
      ('Phí giao dịch',(select gmv*.06 from base)),('Hoa hồng nền tảng',(select gmv*.11 from base)),('Phí xử lý',(select orders*3000 from base)),
      ('Voucher Xtra',(select gmv*.04 from base)),('Chi phí Ads',(select v from ads)),('Hoa hồng KOC',(select v from aff)),('Đơn mẫu',(select n*30000 from samples)))v(label,spend))x;
  elsif p_section in ('ads','product-ads','source-ads','video') then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.spend desc),'[]') into result from (
      select case p_section when 'product-ads' then coalesce(nullif(product_code,''),nullif(product_external_id,''),'Không xác định')
        when 'source-ads' then source_type when 'video' then coalesce(nullif(video_title,''),nullif(video_id,''),'Không có video') else campaign_name end label,
        sum(spend) spend,sum(revenue) revenue,sum(orders) orders,sum(impressions) impressions,sum(clicks) clicks
      from tiktok_ad_records where organization_id=org and metric_date between p_from and p_to
      group by 1 order by spend desc limit lim)x;
  elsif p_section in ('creators','commission') then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.revenue desc),'[]') into result from (
      select coalesce(nullif(creator_display_name,''),creator_username) label,sum(payment_amount) revenue,count(distinct order_id) orders,
        sum(actual_ad_commission) spend,sum(quantity) quantity
      from tiktok_affiliate_order_lines where organization_id=org and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
      group by 1 order by revenue desc limit lim)x;
  elsif p_section='customers' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.revenue desc),'[]') into result from (
      select customer_name label,sum(net_gmv) revenue,count(*) orders,max(province) province
      from orders where organization_id=org and order_date between p_from and p_to and not is_cancelled and not is_sample_order and customer_name<>''
      group by customer_name order by revenue desc limit lim)x;
  elsif p_section in ('shopee','shopee-ads','shopee-traffic') then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.label),'[]') into result from (
      select d.metric_date::text label,d.revenue,d.orders,d.ad_spend spend from dashboard_daily d join channels c on c.id=d.channel_id
      where d.organization_id=org and c.code='shopee' and d.metric_date between p_from and p_to)x;
  elsif p_section in ('planner','weekly') then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.date,x.sort_order),'[]') into result from (
      select title label,task_date::text date,status,priority,sort_order from planner_tasks where organization_id=org and task_date between p_from and p_to limit lim)x;
  elsif p_section='booking' then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.date desc),'[]') into result from (
      select name label,status,start_date::text date,budget spend from booking_campaigns where organization_id=org limit lim)x;
  else result:='[]'::jsonb;
  end if;
  return jsonb_build_object('rows',result,'from',p_from,'to',p_to);
end $$;

revoke all on function public.dashboard_section(text,date,date,integer) from public,anon;
grant execute on function public.dashboard_section(text,date,date,integer) to authenticated;

-- Replace the obsolete full-range helper (kept for compatibility with older callers).
create or replace function public.refresh_dashboard_daily(p_org uuid,p_from date,p_to date)
returns void language plpgsql security invoker set search_path=public as $$
declare dates date[];
begin
  select array_agg(day::date) into dates from generate_series(p_from,p_to,interval '1 day') day;
  perform public.refresh_dashboard_dates(p_org,dates);
end $$;
