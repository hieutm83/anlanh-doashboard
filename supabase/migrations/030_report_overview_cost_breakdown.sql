-- Ensure the report overview GMV breakdown always uses fresh ads spend from tiktok_ad_records.
create or replace function public.dashboard_overview(p_from date,p_to date,p_prev_from date,p_prev_to date,p_channel text default null)
returns jsonb language sql stable security invoker set search_path=public as $$
with scoped as (
  select d.*
  from dashboard_daily d
  join channels c on c.id=d.channel_id
  where d.organization_id=current_organization_id()
    and (p_channel is null or c.code=p_channel)
    and d.metric_date between least(p_from,p_prev_from) and greatest(p_to,p_prev_to)
),
cur as (
  select coalesce(sum(revenue),0) revenue,coalesce(sum(orders),0) orders,coalesce(sum(cancelled_orders),0) cancelled_orders
  from scoped where metric_date between p_from and p_to
),
prv as (
  select coalesce(sum(revenue),0) revenue,coalesce(sum(orders),0) orders,coalesce(sum(cancelled_orders),0) cancelled_orders
  from scoped where metric_date between p_prev_from and p_prev_to
),
ad_cur as (
  select coalesce(sum(a.spend),0) spend
  from tiktok_ad_records a
  join channels c on c.id=a.channel_id
  where a.organization_id=current_organization_id()
    and a.metric_date between p_from and p_to
    and (p_channel is null or c.code=p_channel)
),
ad_prv as (
  select coalesce(sum(a.spend),0) spend
  from tiktok_ad_records a
  join channels c on c.id=a.channel_id
  where a.organization_id=current_organization_id()
    and a.metric_date between p_prev_from and p_prev_to
    and (p_channel is null or c.code=p_channel)
),
affiliate_cur as (
  select coalesce(sum(actual_standard_commission+actual_ad_commission),0) spend
  from tiktok_affiliate_order_lines
  where organization_id=current_organization_id()
    and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
),
curcust as (
  select count(*) total,count(*) filter(where n>1) repeat
  from (
    select customer_key,sum(order_count)n
    from customer_order_daily d
    join channels c on c.id=d.channel_id
    where d.organization_id=current_organization_id()
      and d.metric_date between p_from and p_to
      and (p_channel is null or c.code=p_channel)
    group by customer_key
  )x
),
prvcust as (
  select count(*) total,count(*) filter(where n>1) repeat
  from (
    select customer_key,sum(order_count)n
    from customer_order_daily d
    join channels c on c.id=d.channel_id
    where d.organization_id=current_organization_id()
      and d.metric_date between p_prev_from and p_prev_to
      and (p_channel is null or c.code=p_channel)
    group by customer_key
  )x
),
series as (
  select coalesce(jsonb_agg(jsonb_build_object(
    'date',s.metric_date,
    'revenue',s.revenue,
    'orders',s.orders,
    'cancelledOrders',s.cancelled_orders,
    'adSpend',coalesce(ad_day.spend,0),
    'newCustomers',coalesce(cd.newc,0),
    'repeatCustomers',coalesce(cd.oldc,0)
  ) order by s.metric_date),'[]'::jsonb)value
  from scoped s
  left join (
    select metric_date,count(*) filter(where order_count=1)newc,count(*) filter(where order_count>1)oldc
    from customer_order_daily
    where organization_id=current_organization_id()
    group by metric_date
  )cd using(metric_date)
  left join (
    select a.metric_date,coalesce(sum(a.spend),0) spend
    from tiktok_ad_records a
    join channels c on c.id=a.channel_id
    where a.organization_id=current_organization_id()
      and a.metric_date between p_from and p_to
      and (p_channel is null or c.code=p_channel)
    group by a.metric_date
  ) ad_day on ad_day.metric_date=s.metric_date
  where s.metric_date between p_from and p_to
),
provinces as (
  select coalesce(jsonb_agg(jsonb_build_object('name',province,'revenue',revenue) order by revenue desc),'[]'::jsonb)value
  from (
    select province,sum(p.revenue) revenue
    from dashboard_province_daily p
    join channels c on c.id=p.channel_id
    where p.organization_id=current_organization_id()
      and p.metric_date between p_from and p_to
      and (p_channel is null or c.code=p_channel)
    group by province
    order by revenue desc
    limit 10
  )x
),
breakdown as (
  select
    cur.revenue revenue,
    cur.revenue*.21 fees,
    affiliate_cur.spend affiliate,
    ad_cur.spend ads,
    0::numeric refund
  from cur,affiliate_cur,ad_cur
),
cost_breakdown as (
  select jsonb_agg(jsonb_build_object('label',label,'value',value) order by sort_order) value
  from (
    select 1 sort_order,'Tổng phí & thuế' label,fees value from breakdown
    union all select 2,'Hoa hồng KOC / Affiliate',affiliate from breakdown
    union all select 3,'Chi phí Ads',ads from breakdown
    union all select 4,'Hoàn tiền',refund from breakdown
    union all select 5,'Còn lại',greatest(0,revenue-fees-affiliate-ads-refund) from breakdown
  )x
)
select jsonb_build_object(
  'revenue',jsonb_build_object('value',cur.revenue,'previous',prv.revenue,'changePct',case when prv.revenue=0 then null else(cur.revenue-prv.revenue)*100/prv.revenue end),
  'orders',jsonb_build_object('value',cur.orders,'previous',prv.orders,'changePct',case when prv.orders=0 then null else(cur.orders-prv.orders)*100.0/prv.orders end),
  'adSpend',jsonb_build_object('value',ad_cur.spend,'previous',ad_prv.spend,'changePct',case when ad_prv.spend=0 then null else(ad_cur.spend-ad_prv.spend)*100/ad_prv.spend end),
  'roas',jsonb_build_object('value',case when ad_cur.spend=0 then 0 else cur.revenue/ad_cur.spend end,'previous',case when ad_prv.spend=0 then 0 else prv.revenue/ad_prv.spend end,'changePct',null),
  'customers',jsonb_build_object('value',curcust.total,'previous',prvcust.total,'changePct',case when prvcust.total=0 then null else(curcust.total-prvcust.total)*100.0/prvcust.total end),
  'repeatRate',jsonb_build_object('value',case when curcust.total=0 then 0 else curcust.repeat*100.0/curcust.total end,'previous',case when prvcust.total=0 then 0 else prvcust.repeat*100.0/prvcust.total end,'changePct',null),
  'series',series.value,
  'provinces',provinces.value,
  'costBreakdown',cost_breakdown.value
) from cur,prv,ad_cur,ad_prv,curcust,prvcust,series,provinces,cost_breakdown $$;

revoke all on function public.dashboard_overview(date,date,date,date,text) from public,anon;
grant execute on function public.dashboard_overview(date,date,date,date,text) to authenticated;
