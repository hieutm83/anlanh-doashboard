-- Stable contract used by the legacy-shaped frontend. Every KPI is calculated over the full
-- selected range, independently from the limited detail rows returned for charts/tables.
create or replace function public.dashboard_legacy(p_section text,p_from date,p_to date,p_limit integer default 500)
returns jsonb language plpgsql stable security invoker set search_path=public as $$
declare base jsonb; summary jsonb:='{}'::jsonb; org uuid:=current_organization_id();
begin
  if p_section='costs' then base:=public.dashboard_costs(p_from,p_to,p_limit);
  elsif p_section in ('creators','commission') then base:=public.dashboard_affiliate(p_from,p_to,p_limit);
  else base:=public.dashboard_section(p_section,p_from,p_to,p_limit); end if;

  if p_section in ('products','sources','customers') then
    select jsonb_build_object('revenue',coalesce(sum(o.net_gmv),0),'orders',count(*),
      'quantity',coalesce(sum(items.quantity),0),'customers',count(distinct nullif(o.customer_name,''))) into summary
    from orders o left join lateral(select sum(oi.quantity)quantity from order_items oi where oi.order_id=o.id)items on true
    join channels c on c.id=o.channel_id where o.organization_id=org and c.code='tiktok' and o.order_date between p_from and p_to and not o.is_cancelled and not o.is_sample_order;
  elsif p_section in ('ads','product-ads','source-ads','video') then
    select jsonb_build_object('revenue',coalesce(sum(revenue),0),'orders',coalesce(sum(orders),0),'spend',coalesce(sum(spend),0),
      'impressions',coalesce(sum(impressions),0),'clicks',coalesce(sum(clicks),0),'quantity',count(distinct nullif(video_id,''))) into summary
    from tiktok_ad_records where organization_id=org and metric_date between p_from and p_to;
  elsif p_section in ('creators','commission') then
    select jsonb_build_object('revenue',coalesce(sum(payment_amount),0),'orders',count(distinct order_id),'quantity',count(distinct creator_username),
      'spend',coalesce(sum(estimated_standard_commission+estimated_ad_commission),0)) into summary
    from tiktok_affiliate_order_lines where organization_id=org and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to;
  elsif p_section='costs' then
    select jsonb_build_object('spend',coalesce(sum((row->>'spend')::numeric),0)) into summary from jsonb_array_elements(base->'rows')row;
    select summary||jsonb_build_object('revenue',coalesce(sum(net_gmv),0),'orders',count(*)) into summary from orders
      where organization_id=org and order_date between p_from and p_to and not is_cancelled and not is_sample_order;
  elsif p_section in ('planner','weekly') then
    select jsonb_build_object('quantity',count(*),'orders',count(*)filter(where status in('done','completed')),
      'customers',count(*)filter(where status not in('done','completed'))) into summary
    from planner_tasks where organization_id=org and task_date between p_from and p_to;
  elsif p_section='booking' then
    select jsonb_build_object('quantity',count(*),'orders',count(*)filter(where status in('done','closed','completed')),
      'customers',count(*)filter(where status not in('done','closed','completed')),'spend',coalesce(sum(budget),0)) into summary
    from booking_campaigns where organization_id=org and (start_date is null or start_date<=p_to) and (end_date is null or end_date>=p_from);
  elsif p_section in ('shopee','shopee-products','shopee-ads','shopee-traffic') then
    select jsonb_build_object('revenue',coalesce(sum(d.revenue),0),'orders',coalesce(sum(d.orders),0),'spend',coalesce(sum(d.ad_spend),0),
      'customers',coalesce(sum(d.customers),0)) into summary from dashboard_daily d join channels c on c.id=d.channel_id
    where d.organization_id=org and c.code='shopee' and d.metric_date between p_from and p_to;
  end if;
  return base||jsonb_build_object('summary',summary);
end $$;

revoke all on function public.dashboard_legacy(text,date,date,integer) from public,anon;
grant execute on function public.dashboard_legacy(text,date,date,integer) to authenticated;
