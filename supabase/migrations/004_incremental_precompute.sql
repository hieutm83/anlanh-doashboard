-- Write-heavy architecture: dashboard reads never scan raw order/ad facts.
alter table public.dashboard_daily
  add column if not exists cancelled_orders bigint not null default 0;

create or replace function public.refresh_dashboard_dates(p_org uuid, p_dates date[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_org is null or not public.can_edit(p_org) then
    raise exception 'Not authorized';
  end if;
  if coalesce(cardinality(p_dates), 0) = 0 then return; end if;

  -- Remove only exact affected dates. This also removes aggregates whose raw rows were deleted.
  delete from dashboard_daily
  where organization_id = p_org and metric_date = any(p_dates);

  insert into dashboard_daily(
    organization_id, channel_id, metric_date, revenue, orders,
    cancelled_orders, customers, ad_spend, ad_revenue, updated_at
  )
  select organization_id, channel_id, metric_date,
         sum(revenue), sum(order_count), sum(cancelled_count),
         sum(customer_count), sum(spend), sum(ad_revenue), now()
  from (
    select organization_id, channel_id, order_date as metric_date,
           coalesce(sum(net_gmv) filter (where not is_cancelled), 0) as revenue,
           count(*) filter (where not is_cancelled) as order_count,
           count(*) filter (where is_cancelled) as cancelled_count,
           count(distinct nullif(customer_name, '')) filter (where not is_cancelled) as customer_count,
           0::numeric as spend, 0::numeric as ad_revenue
    from orders
    where organization_id = p_org and order_date = any(p_dates)
    group by organization_id, channel_id, order_date

    union all

    select organization_id, channel_id, metric_date,
           0::numeric, 0::bigint, 0::bigint, 0::bigint,
           coalesce(sum(spend), 0), coalesce(sum(revenue), 0)
    from ad_performance_daily
    where organization_id = p_org and metric_date = any(p_dates)
    group by organization_id, channel_id, metric_date
  ) facts
  group by organization_id, channel_id, metric_date
  on conflict (organization_id, channel_id, metric_date) do update set
    revenue = excluded.revenue,
    orders = excluded.orders,
    cancelled_orders = excluded.cancelled_orders,
    customers = excluded.customers,
    ad_spend = excluded.ad_spend,
    ad_revenue = excluded.ad_revenue,
    updated_at = now();
end;
$$;

create or replace function public.finalize_import(p_job_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_job import_jobs%rowtype;
  v_affected_dates date[];
begin
  select * into v_job from import_jobs where id = p_job_id for update;
  if v_job.id is null or not public.can_edit(v_job.organization_id) then
    raise exception 'Not authorized';
  end if;
  if v_job.status = 'completed' then return; end if;

  if v_job.dataset_type = 'orders' then
    -- Capture both sides before upsert: an order may be corrected to another date.
    select array_agg(distinct metric_date order by metric_date)
    into v_affected_dates
    from (
      select o.order_date as metric_date
      from import_staging s
      join channels c on c.code = coalesce(s.payload->>'channel', 'tiktok')
      join orders o on o.organization_id=v_job.organization_id
                   and o.channel_id=c.id
                   and o.external_order_id=s.payload->>'order_id'
      where s.import_job_id=p_job_id
      union
      select ((s.payload->>'ordered_at')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date
      from import_staging s
      where s.import_job_id=p_job_id and nullif(s.payload->>'ordered_at','') is not null
    ) before_and_incoming;

    insert into orders(
      organization_id, channel_id, external_order_id, ordered_at, status,
      is_cancelled, is_sample_order, is_affiliate_order, customer_name,
      province, gross_amount, discount_amount, net_gmv, import_job_id
    )
    select v_job.organization_id, c.id, s.payload->>'order_id',
           (s.payload->>'ordered_at')::timestamptz, coalesce(s.payload->>'status', ''),
           coalesce((s.payload->>'is_cancelled')::boolean, false),
           coalesce((s.payload->>'is_sample_order')::boolean, false),
           coalesce((s.payload->>'is_affiliate_order')::boolean, false),
           coalesce(s.payload->>'customer_name', ''), coalesce(s.payload->>'province', ''),
           coalesce((s.payload->>'gross_amount')::numeric, 0),
           coalesce((s.payload->>'discount_amount')::numeric, 0),
           coalesce((s.payload->>'net_gmv')::numeric, 0), p_job_id
    from import_staging s
    join channels c on c.code = coalesce(s.payload->>'channel', 'tiktok')
    where s.import_job_id = p_job_id and nullif(s.payload->>'order_id', '') is not null
    on conflict (organization_id, channel_id, external_order_id) do update set
      ordered_at=excluded.ordered_at, status=excluded.status,
      is_cancelled=excluded.is_cancelled, gross_amount=excluded.gross_amount,
      discount_amount=excluded.discount_amount, net_gmv=excluded.net_gmv,
      import_job_id=excluded.import_job_id, updated_at=now();
  end if;

  select array_agg(distinct metric_date order by metric_date)
  into v_affected_dates
  from (
    select unnest(coalesce(v_affected_dates, '{}'::date[])) as metric_date
    union
    select order_date as metric_date from orders where import_job_id = p_job_id
    union
    select metric_date from ad_performance_daily where import_job_id = p_job_id
    union
    select metric_date from product_performance_daily where import_job_id = p_job_id
    union
    select metric_date from traffic_performance_daily where import_job_id = p_job_id
  ) changed;

  perform public.refresh_dashboard_dates(v_job.organization_id, v_affected_dates);
  update import_jobs set status='completed', completed_at=now(), valid_rows=imported_rows where id=p_job_id;
end;
$$;

create index if not exists dashboard_daily_org_date_idx
  on public.dashboard_daily(organization_id, metric_date);
create index if not exists dashboard_daily_org_channel_date_idx
  on public.dashboard_daily(organization_id, channel_id, metric_date);

grant execute on function public.refresh_dashboard_dates(uuid,date[]) to authenticated;
