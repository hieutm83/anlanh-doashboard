-- Allow product analysis imports when product name headers are missing or grouped.
create or replace function public.finalize_product_analysis_import(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  j import_jobs%rowtype;
  dates date[];
begin
  select * into j from import_jobs where id=p_job_id for update;
  if j.id is null or not public.can_edit(j.organization_id) then
    raise exception 'Not authorized';
  end if;

  select array_agg(distinct (payload->>'metric_date')::date)
  into dates
  from import_staging
  where import_job_id=p_job_id;

  delete from tiktok_product_analysis
  where organization_id=j.organization_id and metric_date=any(dates);

  insert into tiktok_product_analysis(
    organization_id,channel_id,metric_date,product_external_id,product_name,
    product_status,product_code,raw_payload,import_job_id
  )
  select
    j.organization_id,
    c.id,
    (s.payload->>'metric_date')::date,
    coalesce(nullif(s.payload->>'product_external_id',''),'name:'||md5(coalesce(nullif(s.payload->>'product_name',''),s.payload->>'product_external_id','unknown'))),
    coalesce(nullif(s.payload->>'product_name',''),nullif(s.payload->>'product_external_id',''),'Unknown product'),
    coalesce(s.payload->>'product_status',''),
    coalesce(pm.product_code,''),
    coalesce(s.payload->'raw_payload',s.payload),
    p_job_id
  from import_staging s
  join channels c on c.code='tiktok'
  left join product_mappings pm
    on pm.organization_id=j.organization_id
   and pm.channel_id=c.id
   and pm.external_product_id=s.payload->>'product_external_id'
  where s.import_job_id=p_job_id
    and (
      nullif(s.payload->>'product_name','') is not null
      or nullif(s.payload->>'product_external_id','') is not null
    );

  update import_jobs
  set status='completed',
      completed_at=now(),
      valid_rows=(
        select count(*)
        from import_staging
        where import_job_id=p_job_id
          and (
            nullif(payload->>'product_name','') is not null
            or nullif(payload->>'product_external_id','') is not null
          )
      )
  where id=p_job_id;
end $$;

revoke all on function public.finalize_product_analysis_import(uuid) from public,anon;
grant execute on function public.finalize_product_analysis_import(uuid) to authenticated;
