-- Keep ads imports lean and ignore placeholder posted_at values such as "-".
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
    case
      when nullif(trim(coalesce(s.payload->>'posted_at','')),'') is null then null
      when trim(s.payload->>'posted_at') in ('-','--') then null
      when trim(s.payload->>'posted_at') ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}' then (s.payload->>'posted_at')::timestamptz
      when trim(s.payload->>'posted_at') ~ '^\d{4}-\d{2}-\d{2}[[:space:]]+\d{1,2}:\d{2}' then (s.payload->>'posted_at')::timestamptz
      else null
    end,coalesce(s.payload->>'status',''),coalesce(s.payload->>'authorization_type',''),
    coalesce((s.payload->>'spend')::numeric,0),coalesce((s.payload->>'orders')::numeric,0),coalesce((s.payload->>'cpa')::numeric,0),coalesce((s.payload->>'revenue')::numeric,0),coalesce((s.payload->>'roi')::numeric,0),
    coalesce((s.payload->>'impressions')::bigint,0),coalesce((s.payload->>'clicks')::bigint,0),coalesce((s.payload->>'ctr')::numeric,0),coalesce((s.payload->>'conversion_rate')::numeric,0),
    coalesce((s.payload->>'view_2s_rate')::numeric,0),coalesce((s.payload->>'view_6s_rate')::numeric,0),coalesce((s.payload->>'view_25_rate')::numeric,0),coalesce((s.payload->>'view_50_rate')::numeric,0),coalesce((s.payload->>'view_75_rate')::numeric,0),coalesce((s.payload->>'view_100_rate')::numeric,0),coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code='tiktok'
  left join product_mappings pm on pm.organization_id=j.organization_id and pm.channel_id=c.id and pm.external_product_id=s.payload->>'product_external_id'
  left join inhouse_accounts ih on ih.organization_id=j.organization_id and ih.channel_id=c.id and lower(ih.account_name)=lower(s.payload->>'account_name')
  where s.import_job_id=p_job_id
    and coalesce((s.payload->>'impressions')::numeric,0) > 0;
  delete from ad_performance_daily where organization_id=j.organization_id and metric_date=any(dates);
  insert into ad_performance_daily(organization_id,channel_id,metric_date,campaign_external_id,ad_external_id,source_type,spend,revenue,orders,impressions,clicks,conversions,import_job_id)
  select organization_id,channel_id,metric_date,campaign_id,video_id,source_type,sum(spend),sum(revenue),sum(orders),sum(impressions),sum(clicks),sum(orders),p_job_id
  from tiktok_ad_records where organization_id=j.organization_id and metric_date=any(dates) group by 1,2,3,4,5,6;
  perform refresh_dashboard_dates(j.organization_id,dates);
  update import_jobs set status='completed',completed_at=now(),valid_rows=(select count(*) from import_staging where import_job_id=p_job_id and coalesce((payload->>'impressions')::numeric,0) > 0) where id=p_job_id;
end $$;

revoke all on function public.finalize_ads_import(uuid) from public,anon;
grant execute on function public.finalize_ads_import(uuid) to authenticated;
