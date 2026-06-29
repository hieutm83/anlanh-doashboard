create or replace function public.normalize_province(p_value text)
returns text language sql immutable as $$
  select coalesce(nullif(trim(regexp_replace(coalesce(p_value,''),'^(Tỉnh|Thành phố|TP\.?)[[:space:]]+','','i')),''),'Khác')
$$;

create table if not exists public.customer_order_daily (
  organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels,
  metric_date date not null,
  customer_key text not null,
  order_count bigint not null default 0,
  primary key(organization_id,channel_id,metric_date,customer_key)
);
create index if not exists customer_order_daily_range_idx on public.customer_order_daily(organization_id,metric_date,channel_id);
alter table public.customer_order_daily enable row level security;
create policy customer_order_daily_read on public.customer_order_daily for select using(organization_id=public.current_organization_id());
create policy customer_order_daily_write on public.customer_order_daily for all using(public.can_edit(organization_id)) with check(public.can_edit(organization_id));
grant select,insert,update,delete on public.customer_order_daily to authenticated;

create or replace function public.refresh_dashboard_base_dates(p_org uuid,p_dates date[])
returns void language plpgsql security invoker set search_path=public as $$
begin
  if p_org is null or not public.can_edit(p_org) then raise exception 'Not authorized'; end if;
  if coalesce(cardinality(p_dates),0)=0 then return; end if;
  delete from dashboard_daily where organization_id=p_org and metric_date=any(p_dates);
  delete from customer_order_daily where organization_id=p_org and metric_date=any(p_dates);

  insert into customer_order_daily(organization_id,channel_id,metric_date,customer_key,order_count)
  select organization_id,channel_id,order_date,
         customer_name||'_'||public.normalize_province(province),count(*)
  from orders
  where organization_id=p_org and order_date=any(p_dates) and not is_cancelled and not is_sample_order and nullif(customer_name,'') is not null
  group by organization_id,channel_id,order_date,customer_name||'_'||public.normalize_province(province);

  insert into dashboard_daily(organization_id,channel_id,metric_date,revenue,orders,cancelled_orders,customers,ad_spend,ad_revenue,updated_at)
  select organization_id,channel_id,metric_date,sum(revenue),sum(order_count),sum(cancelled_count),sum(customer_count),sum(spend),sum(ad_revenue),now()
  from (
    select organization_id,channel_id,order_date metric_date,
      coalesce(sum(net_gmv) filter(where not is_cancelled and not is_sample_order),0) revenue,
      count(*) filter(where not is_cancelled and not is_sample_order) order_count,
      count(*) filter(where is_cancelled and not is_sample_order) cancelled_count,
      count(distinct customer_name||'_'||public.normalize_province(province)) filter(where not is_cancelled and not is_sample_order and nullif(customer_name,'') is not null) customer_count,
      0::numeric spend,0::numeric ad_revenue
    from orders where organization_id=p_org and order_date=any(p_dates) group by 1,2,3
    union all
    select organization_id,channel_id,metric_date,0,0,0,0,sum(spend),sum(revenue)
    from ad_performance_daily where organization_id=p_org and metric_date=any(p_dates) group by 1,2,3
  ) facts group by organization_id,channel_id,metric_date;
end $$;

create or replace function public.refresh_dashboard_dates(p_org uuid,p_dates date[])
returns void language plpgsql security invoker set search_path=public as $$
begin
  perform public.refresh_dashboard_base_dates(p_org,p_dates);
  if coalesce(cardinality(p_dates),0)=0 then return; end if;
  delete from dashboard_province_daily where organization_id=p_org and metric_date=any(p_dates);
  insert into dashboard_province_daily(organization_id,channel_id,metric_date,province,revenue,orders)
  select organization_id,channel_id,order_date,public.normalize_province(province),
    coalesce(sum(net_gmv) filter(where not is_cancelled and not is_sample_order),0),
    count(*) filter(where not is_cancelled and not is_sample_order)
  from orders where organization_id=p_org and order_date=any(p_dates)
  group by organization_id,channel_id,order_date,public.normalize_province(province);
end $$;

create or replace function public.finalize_import(p_job_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare v_job import_jobs%rowtype; v_dates date[];
begin
  select * into v_job from import_jobs where id=p_job_id for update;
  if v_job.id is null or not public.can_edit(v_job.organization_id) then raise exception 'Not authorized'; end if;
  if v_job.status='completed' then return; end if;
  if v_job.dataset_type not in ('orders','sample_orders') then raise exception 'Dataset type % is not implemented',v_job.dataset_type; end if;

  select array_agg(distinct d) into v_dates from (
    select o.order_date d from import_staging s join channels c on c.code=coalesce(s.payload->>'channel','tiktok')
      join orders o on o.organization_id=v_job.organization_id and o.channel_id=c.id and o.external_order_id=s.payload->>'order_id'
      where s.import_job_id=p_job_id
    union select ((payload->>'ordered_at')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date from import_staging where import_job_id=p_job_id and nullif(payload->>'ordered_at','') is not null
  ) x;

  insert into products(organization_id,channel_id,external_product_id,name,normalized_name)
  select distinct v_job.organization_id,c.id,'name:'||md5(s.payload->>'product_name'),s.payload->>'product_name',lower(trim(s.payload->>'product_name'))
  from import_staging s join channels c on c.code=coalesce(s.payload->>'channel','tiktok')
  where s.import_job_id=p_job_id and nullif(s.payload->>'product_name','') is not null
  on conflict(organization_id,channel_id,external_product_id) do update set name=excluded.name,normalized_name=excluded.normalized_name,updated_at=now();

  insert into product_skus(product_id,external_sku_id,seller_sku,sku_name)
  select distinct p.id,coalesce(s.payload->>'sku_id',''),coalesce(sm.seller_sku,s.payload->>'seller_sku',''),coalesce(sm.seller_sku,s.payload->>'seller_sku','')
  from import_staging s join channels c on c.code=coalesce(s.payload->>'channel','tiktok')
  join products p on p.organization_id=v_job.organization_id and p.channel_id=c.id and p.external_product_id='name:'||md5(s.payload->>'product_name')
  left join sku_mappings sm on sm.organization_id=v_job.organization_id and sm.channel_id=c.id and sm.external_sku_id=s.payload->>'sku_id'
  where s.import_job_id=p_job_id and nullif(s.payload->>'sku_id','') is not null
  on conflict(product_id,external_sku_id,seller_sku) do update set sku_name=excluded.sku_name;

  with grouped as (
    select c.id channel_id,s.payload->>'order_id' order_id,min((s.payload->>'ordered_at')::timestamptz) ordered_at,
      max(coalesce(s.payload->>'status','')) status,bool_or(coalesce((s.payload->>'is_cancelled')::boolean,false)) cancelled,
      max(coalesce(s.payload->>'customer_name','')) customer_name,max(coalesce(s.payload->>'province','')) province,
      sum(coalesce((s.payload->>'line_gmv')::numeric,0)) gmv
    from import_staging s join channels c on c.code=coalesce(s.payload->>'channel','tiktok')
    where s.import_job_id=p_job_id and nullif(s.payload->>'order_id','') is not null group by c.id,s.payload->>'order_id'
  )
  insert into orders(organization_id,channel_id,external_order_id,ordered_at,status,is_cancelled,is_sample_order,customer_name,province,gross_amount,net_gmv,import_job_id)
  select v_job.organization_id,channel_id,order_id,ordered_at,status,cancelled,v_job.dataset_type='sample_orders',customer_name,province,gmv,gmv,p_job_id from grouped
  on conflict(organization_id,channel_id,external_order_id) do update set ordered_at=excluded.ordered_at,status=excluded.status,
    is_cancelled=excluded.is_cancelled,is_sample_order=orders.is_sample_order or excluded.is_sample_order,
    customer_name=excluded.customer_name,province=excluded.province,gross_amount=excluded.gross_amount,net_gmv=excluded.net_gmv,import_job_id=excluded.import_job_id,updated_at=now();

  delete from order_items oi using orders o where oi.order_id=o.id and o.organization_id=v_job.organization_id
    and exists(select 1 from import_staging s where s.import_job_id=p_job_id and s.payload->>'order_id'=o.external_order_id);
  insert into order_items(order_id,product_id,sku_id,quantity,gross_amount,net_amount)
  select o.id,p.id,ps.id,sum(coalesce((s.payload->>'quantity')::numeric,1)),sum(coalesce((s.payload->>'line_gmv')::numeric,0)),sum(coalesce((s.payload->>'line_gmv')::numeric,0))
  from import_staging s join channels c on c.code=coalesce(s.payload->>'channel','tiktok')
  join orders o on o.organization_id=v_job.organization_id and o.channel_id=c.id and o.external_order_id=s.payload->>'order_id'
  join products p on p.organization_id=v_job.organization_id and p.channel_id=c.id and p.external_product_id='name:'||md5(s.payload->>'product_name')
  left join sku_mappings sm on sm.organization_id=v_job.organization_id and sm.channel_id=c.id and sm.external_sku_id=s.payload->>'sku_id'
  left join product_skus ps on ps.product_id=p.id and ps.external_sku_id=coalesce(s.payload->>'sku_id','') and ps.seller_sku=coalesce(sm.seller_sku,s.payload->>'seller_sku','')
  where s.import_job_id=p_job_id group by o.id,p.id,ps.id;

  perform public.refresh_dashboard_dates(v_job.organization_id,v_dates);
  update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;

create or replace function public.dashboard_overview(p_from date,p_to date,p_prev_from date,p_prev_to date,p_channel text default null)
returns jsonb language sql stable security invoker set search_path=public as $$
with scoped as (select d.* from dashboard_daily d join channels c on c.id=d.channel_id where d.organization_id=current_organization_id() and (p_channel is null or c.code=p_channel) and d.metric_date between least(p_from,p_prev_from) and greatest(p_to,p_prev_to)),
cur as (select coalesce(sum(revenue),0) revenue,coalesce(sum(orders),0) orders,coalesce(sum(ad_spend),0) spend from scoped where metric_date between p_from and p_to),
prv as (select coalesce(sum(revenue),0) revenue,coalesce(sum(orders),0) orders,coalesce(sum(ad_spend),0) spend from scoped where metric_date between p_prev_from and p_prev_to),
curcust as (select count(*) total,count(*) filter(where n>1) repeat from (select customer_key,sum(order_count)n from customer_order_daily d join channels c on c.id=d.channel_id where d.organization_id=current_organization_id() and d.metric_date between p_from and p_to and (p_channel is null or c.code=p_channel) group by customer_key)x),
prvcust as (select count(*) total,count(*) filter(where n>1) repeat from (select customer_key,sum(order_count)n from customer_order_daily d join channels c on c.id=d.channel_id where d.organization_id=current_organization_id() and d.metric_date between p_prev_from and p_prev_to and (p_channel is null or c.code=p_channel) group by customer_key)x),
series as (select coalesce(jsonb_agg(jsonb_build_object('date',s.metric_date,'revenue',s.revenue,'orders',s.orders,'cancelledOrders',s.cancelled_orders,'adSpend',s.ad_spend,'newCustomers',coalesce(cd.newc,0),'repeatCustomers',coalesce(cd.oldc,0)) order by s.metric_date),'[]'::jsonb)value from scoped s left join (select metric_date,count(*)filter(where order_count=1)newc,count(*)filter(where order_count>1)oldc from customer_order_daily where organization_id=current_organization_id() group by metric_date)cd using(metric_date) where s.metric_date between p_from and p_to),
provinces as (select coalesce(jsonb_agg(jsonb_build_object('name',province,'revenue',revenue)order by revenue desc),'[]'::jsonb)value from(select province,sum(p.revenue)revenue from dashboard_province_daily p join channels c on c.id=p.channel_id where p.organization_id=current_organization_id() and p.metric_date between p_from and p_to and(p_channel is null or c.code=p_channel)group by province order by revenue desc limit 10)x)
select jsonb_build_object(
'revenue',jsonb_build_object('value',cur.revenue,'previous',prv.revenue,'changePct',case when prv.revenue=0 then null else(cur.revenue-prv.revenue)*100/prv.revenue end),
'orders',jsonb_build_object('value',cur.orders,'previous',prv.orders,'changePct',case when prv.orders=0 then null else(cur.orders-prv.orders)*100.0/prv.orders end),
'adSpend',jsonb_build_object('value',cur.spend,'previous',prv.spend,'changePct',case when prv.spend=0 then null else(cur.spend-prv.spend)*100/prv.spend end),
'roas',jsonb_build_object('value',case when cur.spend=0 then 0 else cur.revenue/cur.spend end,'previous',case when prv.spend=0 then 0 else prv.revenue/prv.spend end,'changePct',null),
'customers',jsonb_build_object('value',curcust.total,'previous',prvcust.total,'changePct',case when prvcust.total=0 then null else(curcust.total-prvcust.total)*100.0/prvcust.total end),
'repeatRate',jsonb_build_object('value',case when curcust.total=0 then 0 else curcust.repeat*100.0/curcust.total end,'previous',case when prvcust.total=0 then 0 else prvcust.repeat*100.0/prvcust.total end,'changePct',null),
'series',series.value,'provinces',provinces.value) from cur,prv,curcust,prvcust,series,provinces $$;
