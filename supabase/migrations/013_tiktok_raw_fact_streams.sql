create table public.tiktok_order_lines (
  organization_id uuid not null references public.organizations on delete cascade, channel_id smallint not null references public.channels,
  order_id text not null, sku_id text not null default '', seller_sku text not null default '', product_name text not null default '',
  ordered_at timestamptz not null, quantity numeric(14,3) not null default 0, line_gmv numeric(18,2) not null default 0,
  is_cancelled boolean not null default false, is_sample_order boolean not null default false, raw_payload jsonb not null,
  import_job_id uuid references public.import_jobs, updated_at timestamptz not null default now(),
  primary key(organization_id,channel_id,order_id,sku_id,seller_sku,product_name)
);

create table public.tiktok_affiliate_order_lines (
  organization_id uuid not null references public.organizations on delete cascade, channel_id smallint not null references public.channels,
  order_id text not null, product_external_id text not null default '', product_name text not null default '', sku_id text not null default '',
  price numeric(18,2) not null default 0, payment_amount numeric(18,2) not null default 0, quantity numeric(14,3) not null default 0,
  status text not null default '', creator_username text not null default '', creator_display_name text not null default '', content_type text not null default '', content_id text not null default '',
  estimated_commission_base numeric(18,2) not null default 0, estimated_ad_commission numeric(18,2) not null default 0, actual_ad_commission numeric(18,2) not null default 0,
  created_at timestamptz not null, raw_payload jsonb not null, import_job_id uuid references public.import_jobs, updated_at timestamptz not null default now(),
  primary key(organization_id,channel_id,order_id,sku_id,content_id)
);

create table public.tiktok_ad_records (
  organization_id uuid not null references public.organizations on delete cascade, channel_id smallint not null references public.channels, metric_date date not null,
  campaign_name text not null default '', campaign_id text not null, product_external_id text not null default '', product_code text not null default '',
  creative_type text not null default '', video_title text not null default '', video_id text not null default '', account_name text not null default '', source_type text not null default 'koc',
  posted_at timestamptz, status text not null default '', authorization_type text not null default '', spend numeric(18,3) not null default 0,
  orders numeric(14,3) not null default 0, cpa numeric(18,3) not null default 0, revenue numeric(18,3) not null default 0, roi numeric(14,6) not null default 0,
  impressions bigint not null default 0, clicks bigint not null default 0, ctr numeric(14,8) not null default 0, conversion_rate numeric(14,8) not null default 0,
  view_2s_rate numeric(14,8) not null default 0, view_6s_rate numeric(14,8) not null default 0, view_25_rate numeric(14,8) not null default 0,
  view_50_rate numeric(14,8) not null default 0, view_75_rate numeric(14,8) not null default 0, view_100_rate numeric(14,8) not null default 0,
  raw_payload jsonb not null, import_job_id uuid references public.import_jobs, updated_at timestamptz not null default now(),
  primary key(organization_id,channel_id,metric_date,campaign_id,product_external_id,video_id,account_name)
);

create table public.tiktok_product_analysis (
  organization_id uuid not null references public.organizations on delete cascade, channel_id smallint not null references public.channels, metric_date date not null,
  product_external_id text not null, product_name text not null, product_status text not null default '', product_code text not null default '',
  raw_payload jsonb not null, import_job_id uuid references public.import_jobs, updated_at timestamptz not null default now(),
  primary key(organization_id,channel_id,metric_date,product_external_id)
);

do $$ declare t text; begin foreach t in array array['tiktok_order_lines','tiktok_affiliate_order_lines','tiktok_ad_records','tiktok_product_analysis'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('create policy %I on public.%I for select using(organization_id=public.current_organization_id())',t||'_read',t);
end loop; end $$;
grant select on public.tiktok_order_lines,public.tiktok_affiliate_order_lines,public.tiktok_ad_records,public.tiktok_product_analysis to authenticated;
create index tiktok_order_lines_date_idx on public.tiktok_order_lines(organization_id,ordered_at);
create index affiliate_creator_date_idx on public.tiktok_affiliate_order_lines(organization_id,creator_username,created_at);
create index ad_records_date_source_idx on public.tiktok_ad_records(organization_id,metric_date,source_type);
create index product_analysis_date_idx on public.tiktok_product_analysis(organization_id,metric_date);

alter function public.finalize_import(uuid) rename to finalize_order_core_import;

create function public.finalize_order_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare v_job import_jobs%rowtype; begin
  select * into v_job from import_jobs where id=p_job_id;
  if v_job.id is null or not public.can_edit(v_job.organization_id) then raise exception 'Not authorized'; end if;
  perform public.finalize_order_core_import(p_job_id);
  insert into tiktok_order_lines(organization_id,channel_id,order_id,sku_id,seller_sku,product_name,ordered_at,quantity,line_gmv,is_cancelled,is_sample_order,raw_payload,import_job_id)
  select v_job.organization_id,c.id,s.payload->>'order_id',coalesce(s.payload->>'sku_id',''),coalesce(s.payload->>'seller_sku',''),coalesce(s.payload->>'product_name',''),
    (s.payload->>'ordered_at')::timestamptz,coalesce((s.payload->>'quantity')::numeric,0),coalesce((s.payload->>'line_gmv')::numeric,0),
    coalesce((s.payload->>'is_cancelled')::boolean,false),v_job.dataset_type='sample_orders',coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code=coalesce(s.payload->>'channel','tiktok') where s.import_job_id=p_job_id
  on conflict(organization_id,channel_id,order_id,sku_id,seller_sku,product_name) do update set ordered_at=excluded.ordered_at,quantity=excluded.quantity,
    line_gmv=excluded.line_gmv,is_cancelled=excluded.is_cancelled,is_sample_order=tiktok_order_lines.is_sample_order or excluded.is_sample_order,
    raw_payload=excluded.raw_payload,import_job_id=excluded.import_job_id,updated_at=now();
end $$;

create function public.finalize_affiliate_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare j import_jobs%rowtype; begin select * into j from import_jobs where id=p_job_id for update;
  if j.id is null or not public.can_edit(j.organization_id) then raise exception 'Not authorized'; end if;
  insert into tiktok_affiliate_order_lines(organization_id,channel_id,order_id,product_external_id,product_name,sku_id,price,payment_amount,quantity,status,creator_username,creator_display_name,content_type,content_id,estimated_commission_base,estimated_ad_commission,actual_ad_commission,created_at,raw_payload,import_job_id)
  select j.organization_id,c.id,s.payload->>'order_id',coalesce(s.payload->>'product_external_id',''),coalesce(s.payload->>'product_name',''),coalesce(s.payload->>'sku_id',''),
    coalesce((s.payload->>'price')::numeric,0),coalesce((s.payload->>'payment_amount')::numeric,0),coalesce((s.payload->>'quantity')::numeric,0),coalesce(s.payload->>'status',''),
    coalesce(s.payload->>'creator_username',''),coalesce(am.display_name,s.payload->>'creator_username',''),coalesce(s.payload->>'content_type',''),coalesce(s.payload->>'content_id',''),
    coalesce((s.payload->>'estimated_commission_base')::numeric,0),coalesce((s.payload->>'estimated_ad_commission')::numeric,0),coalesce((s.payload->>'actual_ad_commission')::numeric,0),
    (s.payload->>'created_at')::timestamptz,coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code='tiktok' left join account_mappings am on am.organization_id=j.organization_id and am.channel_id=c.id and am.account_id=s.payload->>'creator_username'
  where s.import_job_id=p_job_id
  on conflict(organization_id,channel_id,order_id,sku_id,content_id) do update set status=excluded.status,price=excluded.price,payment_amount=excluded.payment_amount,quantity=excluded.quantity,
    creator_username=excluded.creator_username,creator_display_name=excluded.creator_display_name,estimated_commission_base=excluded.estimated_commission_base,
    estimated_ad_commission=excluded.estimated_ad_commission,actual_ad_commission=excluded.actual_ad_commission,raw_payload=excluded.raw_payload,import_job_id=excluded.import_job_id,updated_at=now();
  update orders o set is_affiliate_order=true where o.organization_id=j.organization_id and exists(select 1 from tiktok_affiliate_order_lines a where a.organization_id=j.organization_id and a.order_id=o.external_order_id and a.import_job_id=p_job_id);
  update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;

create function public.finalize_ads_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare j import_jobs%rowtype; dates date[]; begin select * into j from import_jobs where id=p_job_id for update;
  if j.id is null or not public.can_edit(j.organization_id) then raise exception 'Not authorized'; end if;
  insert into tiktok_ad_records(organization_id,channel_id,metric_date,campaign_name,campaign_id,product_external_id,product_code,creative_type,video_title,video_id,account_name,source_type,posted_at,status,authorization_type,spend,orders,cpa,revenue,roi,impressions,clicks,ctr,conversion_rate,view_2s_rate,view_6s_rate,view_25_rate,view_50_rate,view_75_rate,view_100_rate,raw_payload,import_job_id)
  select j.organization_id,c.id,(s.payload->>'metric_date')::date,coalesce(s.payload->>'campaign_name',''),s.payload->>'campaign_id',coalesce(s.payload->>'product_external_id',''),coalesce(pm.product_code,''),
    coalesce(s.payload->>'creative_type',''),coalesce(s.payload->>'video_title',''),coalesce(s.payload->>'video_id',''),coalesce(s.payload->>'account_name',''),
    case when lower(coalesce(s.payload->>'creative_type','')) like '%thẻ sản phẩm%' or lower(coalesce(s.payload->>'creative_type','')) like '%product card%' then 'product_card'
         when ih.account_name is not null then 'inhouse' else 'koc' end,
    nullif(s.payload->>'posted_at','')::timestamptz,coalesce(s.payload->>'status',''),coalesce(s.payload->>'authorization_type',''),
    coalesce((s.payload->>'spend')::numeric,0),coalesce((s.payload->>'orders')::numeric,0),coalesce((s.payload->>'cpa')::numeric,0),coalesce((s.payload->>'revenue')::numeric,0),coalesce((s.payload->>'roi')::numeric,0),
    coalesce((s.payload->>'impressions')::bigint,0),coalesce((s.payload->>'clicks')::bigint,0),coalesce((s.payload->>'ctr')::numeric,0),coalesce((s.payload->>'conversion_rate')::numeric,0),
    coalesce((s.payload->>'view_2s_rate')::numeric,0),coalesce((s.payload->>'view_6s_rate')::numeric,0),coalesce((s.payload->>'view_25_rate')::numeric,0),coalesce((s.payload->>'view_50_rate')::numeric,0),coalesce((s.payload->>'view_75_rate')::numeric,0),coalesce((s.payload->>'view_100_rate')::numeric,0),coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code='tiktok' left join product_mappings pm on pm.organization_id=j.organization_id and pm.channel_id=c.id and pm.external_product_id=s.payload->>'product_external_id'
  left join inhouse_accounts ih on ih.organization_id=j.organization_id and ih.channel_id=c.id and lower(ih.account_name)=lower(s.payload->>'account_name') where s.import_job_id=p_job_id
  on conflict(organization_id,channel_id,metric_date,campaign_id,product_external_id,video_id,account_name) do update set spend=excluded.spend,orders=excluded.orders,cpa=excluded.cpa,revenue=excluded.revenue,roi=excluded.roi,
    impressions=excluded.impressions,clicks=excluded.clicks,ctr=excluded.ctr,conversion_rate=excluded.conversion_rate,source_type=excluded.source_type,raw_payload=excluded.raw_payload,import_job_id=excluded.import_job_id,updated_at=now();
  select array_agg(distinct metric_date) into dates from tiktok_ad_records where import_job_id=p_job_id;
  delete from ad_performance_daily where organization_id=j.organization_id and metric_date=any(dates);
  insert into ad_performance_daily(organization_id,channel_id,metric_date,campaign_external_id,ad_external_id,source_type,spend,revenue,orders,impressions,clicks,conversions,import_job_id)
  select organization_id,channel_id,metric_date,campaign_id,video_id,source_type,sum(spend),sum(revenue),sum(orders),sum(impressions),sum(clicks),sum(orders),p_job_id
  from tiktok_ad_records where organization_id=j.organization_id and metric_date=any(dates) group by 1,2,3,4,5,6;
  perform refresh_dashboard_dates(j.organization_id,dates); update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;

create function public.finalize_product_analysis_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare j import_jobs%rowtype; begin select * into j from import_jobs where id=p_job_id for update;
  if j.id is null or not public.can_edit(j.organization_id) then raise exception 'Not authorized'; end if;
  insert into tiktok_product_analysis(organization_id,channel_id,metric_date,product_external_id,product_name,product_status,product_code,raw_payload,import_job_id)
  select j.organization_id,c.id,(s.payload->>'metric_date')::date,coalesce(nullif(s.payload->>'product_external_id',''),'name:'||md5(s.payload->>'product_name')),
    s.payload->>'product_name',coalesce(s.payload->>'product_status',''),coalesce(pm.product_code,''),coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code='tiktok' left join product_mappings pm on pm.organization_id=j.organization_id and pm.channel_id=c.id and pm.external_product_id=s.payload->>'product_external_id'
  where s.import_job_id=p_job_id and nullif(s.payload->>'product_name','') is not null
  on conflict(organization_id,channel_id,metric_date,product_external_id) do update set product_name=excluded.product_name,product_status=excluded.product_status,product_code=excluded.product_code,raw_payload=excluded.raw_payload,import_job_id=excluded.import_job_id,updated_at=now();
  update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;

create function public.finalize_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare kind text; org uuid; begin select dataset_type,organization_id into kind,org from import_jobs where id=p_job_id;
  if org is null or not public.can_edit(org) then raise exception 'Not authorized'; end if;
  case kind when 'orders' then perform finalize_order_import(p_job_id); when 'sample_orders' then perform finalize_order_import(p_job_id);
    when 'affiliate_orders' then perform finalize_affiliate_import(p_job_id); when 'ads' then perform finalize_ads_import(p_job_id);
    when 'product_analysis' then perform finalize_product_analysis_import(p_job_id); else raise exception 'Unsupported dataset type: %',kind; end case;
end $$;
revoke all on function public.finalize_import(uuid) from public,anon;
grant execute on function public.finalize_import(uuid) to authenticated;
