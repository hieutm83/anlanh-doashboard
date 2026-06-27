create table public.dashboard_province_daily (
  organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels,
  metric_date date not null,
  province text not null,
  revenue numeric(18,2) not null default 0,
  orders bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (organization_id, channel_id, metric_date, province)
);
create index dashboard_province_range_idx
  on public.dashboard_province_daily(organization_id, metric_date, channel_id);

alter table public.dashboard_province_daily enable row level security;
create policy dashboard_province_read on public.dashboard_province_daily
  for select using (organization_id=public.current_organization_id());
create policy dashboard_province_write on public.dashboard_province_daily
  for all using (public.can_edit(organization_id)) with check (public.can_edit(organization_id));
grant select,insert,update,delete on public.dashboard_province_daily to authenticated;

alter function public.refresh_dashboard_dates(uuid,date[]) rename to refresh_dashboard_base_dates;

create or replace function public.refresh_dashboard_dates(p_org uuid,p_dates date[])
returns void language plpgsql security invoker set search_path=public as $$
begin
  perform public.refresh_dashboard_base_dates(p_org,p_dates);
  if coalesce(cardinality(p_dates),0)=0 then return; end if;
  delete from dashboard_province_daily where organization_id=p_org and metric_date=any(p_dates);
  insert into dashboard_province_daily(organization_id,channel_id,metric_date,province,revenue,orders)
  select organization_id,channel_id,order_date,coalesce(nullif(province,''),'Khác'),
         coalesce(sum(net_gmv) filter(where not is_cancelled),0),
         count(*) filter(where not is_cancelled)
  from orders
  where organization_id=p_org and order_date=any(p_dates)
  group by organization_id,channel_id,order_date,coalesce(nullif(province,''),'Khác');
end $$;

create or replace function public.dashboard_overview(p_from date,p_to date,p_prev_from date,p_prev_to date,p_channel text default null)
returns jsonb language sql stable security invoker set search_path=public as $$
with scoped as (
 select d.* from dashboard_daily d join channels c on c.id=d.channel_id
 where d.organization_id=current_organization_id() and (p_channel is null or c.code=p_channel)
 and d.metric_date between least(p_from,p_prev_from) and greatest(p_to,p_prev_to)
), cur as (
 select coalesce(sum(revenue),0) revenue,coalesce(sum(orders),0) orders,coalesce(sum(ad_spend),0) spend,coalesce(sum(customers),0) customers
 from scoped where metric_date between p_from and p_to
), prv as (
 select coalesce(sum(revenue),0) revenue,coalesce(sum(orders),0) orders,coalesce(sum(ad_spend),0) spend,coalesce(sum(customers),0) customers
 from scoped where metric_date between p_prev_from and p_prev_to
), series as (
 select coalesce(jsonb_agg(jsonb_build_object('date',metric_date,'revenue',revenue,'orders',orders,'cancelledOrders',cancelled_orders,'adSpend',ad_spend) order by metric_date),'[]'::jsonb) value
 from scoped where metric_date between p_from and p_to
), provinces as (
 select coalesce(jsonb_agg(jsonb_build_object('name',province,'revenue',revenue) order by revenue desc),'[]'::jsonb) value
 from (select province,sum(p.revenue) revenue from dashboard_province_daily p join channels c on c.id=p.channel_id
       where p.organization_id=current_organization_id() and p.metric_date between p_from and p_to and (p_channel is null or c.code=p_channel)
       group by province order by revenue desc limit 10) top_provinces
)
select jsonb_build_object(
 'revenue',jsonb_build_object('value',cur.revenue,'previous',prv.revenue,'changePct',case when prv.revenue=0 then null else (cur.revenue-prv.revenue)*100/prv.revenue end),
 'orders',jsonb_build_object('value',cur.orders,'previous',prv.orders,'changePct',case when prv.orders=0 then null else (cur.orders-prv.orders)*100.0/prv.orders end),
 'adSpend',jsonb_build_object('value',cur.spend,'previous',prv.spend,'changePct',case when prv.spend=0 then null else (cur.spend-prv.spend)*100/prv.spend end),
 'roas',jsonb_build_object('value',case when cur.spend=0 then 0 else cur.revenue/cur.spend end,'previous',case when prv.spend=0 then 0 else prv.revenue/prv.spend end,'changePct',null),
 'customers',jsonb_build_object('value',cur.customers,'previous',prv.customers,'changePct',case when prv.customers=0 then null else (cur.customers-prv.customers)*100.0/prv.customers end),
 'series',series.value,'provinces',provinces.value)
from cur,prv,series,provinces $$;

grant execute on function public.refresh_dashboard_dates(uuid,date[]) to authenticated;
