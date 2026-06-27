-- TikTok exports one row per SKU. Collapse repeated Order IDs before upsert.
create or replace function public.finalize_import(p_job_id uuid)
returns void language plpgsql security invoker set search_path=public as $$
declare
  v_job import_jobs%rowtype;
  v_affected_dates date[];
begin
  select * into v_job from import_jobs where id=p_job_id for update;
  if v_job.id is null or not public.can_edit(v_job.organization_id) then raise exception 'Not authorized'; end if;
  if v_job.status='completed' then return; end if;

  if v_job.dataset_type='orders' then
    select array_agg(distinct metric_date order by metric_date) into v_affected_dates
    from (
      select o.order_date metric_date
      from import_staging s
      join channels c on c.code=coalesce(s.payload->>'channel','tiktok')
      join orders o on o.organization_id=v_job.organization_id and o.channel_id=c.id and o.external_order_id=s.payload->>'order_id'
      where s.import_job_id=p_job_id
      union
      select ((s.payload->>'ordered_at')::timestamptz at time zone 'Asia/Ho_Chi_Minh')::date
      from import_staging s where s.import_job_id=p_job_id and nullif(s.payload->>'ordered_at','') is not null
    ) dates_before_upsert;

    with source_rows as (
      select distinct on (c.id,s.payload->>'order_id')
        v_job.organization_id organization_id,
        c.id channel_id,
        s.payload->>'order_id' external_order_id,
        (s.payload->>'ordered_at')::timestamptz ordered_at,
        coalesce(s.payload->>'status','') status,
        coalesce((s.payload->>'is_cancelled')::boolean,false) is_cancelled,
        coalesce((s.payload->>'is_sample_order')::boolean,false) is_sample_order,
        coalesce((s.payload->>'is_affiliate_order')::boolean,false) is_affiliate_order,
        coalesce(s.payload->>'customer_name','') customer_name,
        coalesce(s.payload->>'province','') province,
        coalesce((s.payload->>'gross_amount')::numeric,0) gross_amount,
        coalesce((s.payload->>'discount_amount')::numeric,0) discount_amount,
        coalesce((s.payload->>'net_gmv')::numeric,0) net_gmv
      from import_staging s
      join channels c on c.code=coalesce(s.payload->>'channel','tiktok')
      where s.import_job_id=p_job_id
        and nullif(s.payload->>'order_id','') is not null
        and nullif(s.payload->>'ordered_at','') is not null
      order by c.id,s.payload->>'order_id',s.row_no desc
    )
    insert into orders(
      organization_id,channel_id,external_order_id,ordered_at,status,is_cancelled,is_sample_order,is_affiliate_order,
      customer_name,province,gross_amount,discount_amount,net_gmv,import_job_id
    )
    select organization_id,channel_id,external_order_id,ordered_at,status,is_cancelled,is_sample_order,is_affiliate_order,
           customer_name,province,gross_amount,discount_amount,net_gmv,p_job_id
    from source_rows
    on conflict(organization_id,channel_id,external_order_id) do update set
      ordered_at=excluded.ordered_at,status=excluded.status,is_cancelled=excluded.is_cancelled,
      gross_amount=excluded.gross_amount,discount_amount=excluded.discount_amount,net_gmv=excluded.net_gmv,
      customer_name=excluded.customer_name,province=excluded.province,import_job_id=excluded.import_job_id,updated_at=now();
  end if;

  select array_agg(distinct metric_date order by metric_date) into v_affected_dates
  from (
    select unnest(coalesce(v_affected_dates,'{}'::date[])) metric_date
    union select order_date from orders where import_job_id=p_job_id
    union select metric_date from ad_performance_daily where import_job_id=p_job_id
    union select metric_date from product_performance_daily where import_job_id=p_job_id
    union select metric_date from traffic_performance_daily where import_job_id=p_job_id
  ) changed;

  perform public.refresh_dashboard_dates(v_job.organization_id,v_affected_dates);
  update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;
