create or replace function public.begin_import(p_dataset_type text,p_filename text,p_total_rows bigint)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_org uuid:=public.current_organization_id(); v_id uuid;
begin
  if v_org is null or not public.can_edit(v_org) then raise exception 'Not authorized to import'; end if;
  insert into import_jobs(organization_id,dataset_type,original_filename,total_rows,status) values(v_org,p_dataset_type,p_filename,p_total_rows,'processing') returning id into v_id;
  return v_id;
end $$;

create or replace function public.import_generic_batch(p_job_id uuid,p_batch_no integer,p_rows jsonb)
returns integer language plpgsql security invoker set search_path=public as $$
declare v_count integer; v_org uuid;
begin
  select organization_id into v_org from import_jobs where id=p_job_id;
  if v_org is null or not public.can_edit(v_org) then raise exception 'Not authorized'; end if;
  if exists(select 1 from import_batches where import_job_id=p_job_id and batch_no=p_batch_no and status='completed') then return 0; end if;
  insert into import_staging(import_job_id,batch_no,payload) select p_job_id,p_batch_no,value from jsonb_array_elements(p_rows);
  get diagnostics v_count=row_count;
  insert into import_batches(import_job_id,batch_no,row_count,status,processed_at) values(p_job_id,p_batch_no,v_count,'completed',now())
  on conflict(import_job_id,batch_no) do update set row_count=excluded.row_count,status='completed',processed_at=now();
  update import_jobs set last_batch_no=greatest(last_batch_no,p_batch_no),imported_rows=imported_rows+v_count where id=p_job_id;
  return v_count;
end $$;

create or replace function public.refresh_dashboard_daily(p_org uuid,p_from date,p_to date)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.can_edit(p_org) then raise exception 'Not authorized'; end if;
  delete from dashboard_daily where organization_id=p_org and metric_date between p_from and p_to;
  insert into dashboard_daily(organization_id,channel_id,metric_date,revenue,orders,customers,ad_spend,ad_revenue)
  select organization_id,channel_id,day,sum(revenue),sum(order_count),sum(customer_count),sum(spend),sum(ad_revenue)
  from (
    select organization_id,channel_id,order_date day,sum(net_gmv) revenue,count(*) order_count,count(distinct nullif(customer_name,'')) customer_count,0::numeric spend,0::numeric ad_revenue
    from orders where organization_id=p_org and order_date between p_from and p_to and not is_cancelled group by 1,2,3
    union all
    select organization_id,channel_id,metric_date,0,0,0,sum(spend),sum(revenue) from ad_performance_daily where organization_id=p_org and metric_date between p_from and p_to group by 1,2,3
  ) x group by organization_id,channel_id,day;
end $$;

create or replace function public.finalize_import(p_job_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare v_job import_jobs%rowtype; v_min date; v_max date;
begin
  select * into v_job from import_jobs where id=p_job_id for update;
  if v_job.id is null or not public.can_edit(v_job.organization_id) then raise exception 'Not authorized'; end if;
  -- Canonical payload keys are produced by dataset-specific adapters. Unknown formats stay staged and are never silently accepted.
  if v_job.dataset_type='orders' then
    insert into orders(organization_id,channel_id,external_order_id,ordered_at,status,is_cancelled,is_sample_order,is_affiliate_order,customer_name,province,gross_amount,discount_amount,net_gmv,import_job_id)
    select v_job.organization_id,c.id,s.payload->>'order_id',(s.payload->>'ordered_at')::timestamptz,coalesce(s.payload->>'status',''),coalesce((s.payload->>'is_cancelled')::boolean,false),coalesce((s.payload->>'is_sample_order')::boolean,false),coalesce((s.payload->>'is_affiliate_order')::boolean,false),coalesce(s.payload->>'customer_name',''),coalesce(s.payload->>'province',''),coalesce((s.payload->>'gross_amount')::numeric,0),coalesce((s.payload->>'discount_amount')::numeric,0),coalesce((s.payload->>'net_gmv')::numeric,0),p_job_id
    from import_staging s join channels c on c.code=coalesce(s.payload->>'channel','tiktok') where s.import_job_id=p_job_id and nullif(s.payload->>'order_id','') is not null
    on conflict(organization_id,channel_id,external_order_id) do update set ordered_at=excluded.ordered_at,status=excluded.status,is_cancelled=excluded.is_cancelled,gross_amount=excluded.gross_amount,discount_amount=excluded.discount_amount,net_gmv=excluded.net_gmv,import_job_id=excluded.import_job_id,updated_at=now();
    select min(order_date),max(order_date) into v_min,v_max from orders where import_job_id=p_job_id;
    if v_min is not null then perform refresh_dashboard_daily(v_job.organization_id,v_min,v_max); end if;
  end if;
  update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;

create or replace function public.dashboard_overview(p_from date,p_to date,p_prev_from date,p_prev_to date,p_channel text default null)
returns jsonb language sql stable security invoker set search_path=public as $$
with scoped as (
 select d.* from dashboard_daily d join channels c on c.id=d.channel_id where d.organization_id=current_organization_id() and (p_channel is null or c.code=p_channel) and d.metric_date between least(p_from,p_prev_from) and greatest(p_to,p_prev_to)
), cur as (select coalesce(sum(revenue),0) revenue,coalesce(sum(orders),0) orders,coalesce(sum(ad_spend),0) spend,coalesce(sum(customers),0) customers from scoped where metric_date between p_from and p_to),
prv as (select coalesce(sum(revenue),0) revenue,coalesce(sum(orders),0) orders,coalesce(sum(ad_spend),0) spend,coalesce(sum(customers),0) customers from scoped where metric_date between p_prev_from and p_prev_to),
series as (select coalesce(jsonb_agg(jsonb_build_object('date',metric_date,'revenue',revenue,'orders',orders,'adSpend',ad_spend) order by metric_date),'[]'::jsonb) value from scoped where metric_date between p_from and p_to)
select jsonb_build_object(
 'revenue',jsonb_build_object('value',cur.revenue,'previous',prv.revenue,'changePct',case when prv.revenue=0 then null else (cur.revenue-prv.revenue)*100/prv.revenue end),
 'orders',jsonb_build_object('value',cur.orders,'previous',prv.orders,'changePct',case when prv.orders=0 then null else (cur.orders-prv.orders)*100.0/prv.orders end),
 'adSpend',jsonb_build_object('value',cur.spend,'previous',prv.spend,'changePct',case when prv.spend=0 then null else (cur.spend-prv.spend)*100/prv.spend end),
 'roas',jsonb_build_object('value',case when cur.spend=0 then 0 else cur.revenue/cur.spend end,'previous',case when prv.spend=0 then 0 else prv.revenue/prv.spend end,'changePct',null),
 'customers',jsonb_build_object('value',cur.customers,'previous',prv.customers,'changePct',case when prv.customers=0 then null else (cur.customers-prv.customers)*100.0/prv.customers end),'series',series.value)
from cur,prv,series $$;

create or replace function public.dashboard_order_page(p_from date,p_to date,p_channel text default null,p_cursor text default null,p_page_size integer default 50)
returns jsonb language sql stable security invoker set search_path=public as $$
with rows as (select o.id,o.external_order_id,o.ordered_at,o.status,o.customer_name,o.province,o.net_gmv,c.code channel from orders o join channels c on c.id=o.channel_id
where o.organization_id=current_organization_id() and o.order_date between p_from and p_to and (p_channel is null or c.code=p_channel) and (p_cursor is null or o.id < p_cursor::uuid) order by o.id desc limit least(p_page_size,200))
select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb),'nextCursor',(select id::text from rows order by id limit 1)) from rows $$;
