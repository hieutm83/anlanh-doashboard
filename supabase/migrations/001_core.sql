create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'editor', 'viewer');
create type public.import_status as enum ('pending', 'processing', 'completed', 'failed', 'cancelled');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'Asia/Ho_Chi_Minh',
  created_at timestamptz not null default now()
);
create table public.organization_members (
  organization_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
create or replace function public.current_organization_id() returns uuid language sql stable security invoker
as $$ select organization_id from public.organization_members where user_id = auth.uid() order by created_at limit 1 $$;
create or replace function public.can_edit(p_org uuid) returns boolean language sql stable security invoker
as $$ select exists(select 1 from public.organization_members where organization_id=p_org and user_id=auth.uid() and role in ('admin','editor')) $$;

create table public.channels (
  id smallint generated always as identity primary key,
  code text not null unique check (code in ('tiktok','shopee')),
  name text not null
);
insert into public.channels(code,name) values ('tiktok','TikTok Shop'),('shopee','Shopee');

create table public.products (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels, external_product_id text not null, name text not null,
  normalized_name text not null default '', status text not null default 'active', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id,channel_id,external_product_id)
);
create table public.product_skus (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products on delete cascade,
  external_sku_id text not null default '', seller_sku text not null default '', sku_name text not null default '', unit_cost numeric(18,2) not null default 0,
  unique(product_id,external_sku_id,seller_sku)
);
create table public.creator_accounts (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels, external_creator_id text not null, account_name text not null,
  display_name text not null default '', account_type text not null default 'unknown', unique(organization_id,channel_id,external_creator_id)
);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
  dataset_type text not null, original_filename text not null, storage_path text, file_hash text, status public.import_status not null default 'pending',
  total_rows bigint not null default 0, valid_rows bigint not null default 0, invalid_rows bigint not null default 0, imported_rows bigint not null default 0,
  last_batch_no integer not null default -1, started_by uuid not null default auth.uid() references auth.users,
  started_at timestamptz not null default now(), completed_at timestamptz, error_summary jsonb not null default '{}'::jsonb
);
create unique index import_file_dedupe on public.import_jobs(organization_id,dataset_type,file_hash) where file_hash is not null and status='completed';
create index import_jobs_status_idx on public.import_jobs(organization_id,status,started_at desc);
create table public.import_batches (
  id uuid primary key default gen_random_uuid(), import_job_id uuid not null references public.import_jobs on delete cascade,
  batch_no integer not null, row_count integer not null, status public.import_status not null default 'pending', attempt_count integer not null default 1,
  processed_at timestamptz, error_message text, unique(import_job_id,batch_no)
);
create table public.import_staging (
  import_job_id uuid not null references public.import_jobs on delete cascade, batch_no integer not null, row_no bigint generated always as identity,
  payload jsonb not null, primary key(import_job_id,row_no)
);
create table public.import_errors (
  id bigint generated always as identity primary key, import_job_id uuid not null references public.import_jobs on delete cascade,
  row_number bigint not null, column_name text not null, error_code text not null, error_message text not null, raw_value text, raw_row jsonb
);
create index import_errors_job_idx on public.import_errors(import_job_id,row_number);

create table public.orders (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels, external_order_id text not null, ordered_at timestamptz not null, order_date date generated always as ((ordered_at at time zone 'Asia/Ho_Chi_Minh')::date) stored,
  status text not null default '', is_cancelled boolean not null default false, is_sample_order boolean not null default false, is_affiliate_order boolean not null default false,
  customer_name text not null default '', province text not null default '', gross_amount numeric(18,2) not null default 0, discount_amount numeric(18,2) not null default 0,
  net_gmv numeric(18,2) not null default 0, currency char(3) not null default 'VND', import_job_id uuid references public.import_jobs,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(organization_id,channel_id,external_order_id)
);
create index orders_range_idx on public.orders(organization_id,channel_id,order_date);
create index orders_status_idx on public.orders(organization_id,order_date,status);
create index orders_cursor_idx on public.orders(organization_id,order_date desc,id desc);
create table public.order_items (
  id bigint generated always as identity primary key, order_id uuid not null references public.orders on delete cascade,
  product_id uuid references public.products, sku_id uuid references public.product_skus, quantity numeric(14,3) not null default 1,
  gross_amount numeric(18,2) not null default 0, discount_amount numeric(18,2) not null default 0, net_amount numeric(18,2) not null default 0
);
create index order_items_order_idx on public.order_items(order_id);
create index order_items_product_idx on public.order_items(product_id,order_id);

create table public.ad_performance_daily (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels, metric_date date not null, creator_id uuid references public.creator_accounts, product_id uuid references public.products,
  campaign_external_id text not null default '', ad_external_id text not null default '', source_type text not null default 'unknown',
  spend numeric(18,2) not null default 0, revenue numeric(18,2) not null default 0, orders numeric(14,2) not null default 0,
  impressions bigint not null default 0, clicks bigint not null default 0, conversions numeric(14,2) not null default 0, import_job_id uuid references public.import_jobs,
  unique(organization_id,channel_id,metric_date,campaign_external_id,ad_external_id,product_id)
);
create index ads_range_idx on public.ad_performance_daily(organization_id,channel_id,metric_date);
create index ads_product_idx on public.ad_performance_daily(organization_id,product_id,metric_date);
create index ads_creator_idx on public.ad_performance_daily(organization_id,creator_id,metric_date);

create table public.product_performance_daily (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels, metric_date date not null, product_id uuid not null references public.products,
  visitors bigint not null default 0, page_views bigint not null default 0, buyers bigint not null default 0, orders bigint not null default 0,
  units_sold numeric(14,2) not null default 0, gmv numeric(18,2) not null default 0, refund_amount numeric(18,2) not null default 0, import_job_id uuid references public.import_jobs,
  unique(organization_id,channel_id,metric_date,product_id)
);
create index product_perf_idx on public.product_performance_daily(organization_id,product_id,metric_date);
create table public.traffic_performance_daily (
  id bigint generated always as identity primary key, organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels, metric_date date not null, product_id uuid references public.products, source_name text not null,
  visitors bigint not null default 0, product_views bigint not null default 0, add_to_cart bigint not null default 0, checkout bigint not null default 0,
  buyers bigint not null default 0, orders bigint not null default 0, gmv numeric(18,2) not null default 0, import_job_id uuid references public.import_jobs
);
create index traffic_range_idx on public.traffic_performance_daily(organization_id,channel_id,metric_date,source_name);

create table public.booking_campaigns (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
  name text not null, status text not null default 'draft', start_date date, end_date date, budget numeric(18,2) not null default 0, description text not null default '', created_by uuid default auth.uid(), created_at timestamptz default now()
);
create table public.booking_creators (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.booking_campaigns on delete cascade,
  creator_id uuid references public.creator_accounts, creator_name_snapshot text not null, agreed_fee numeric(18,2) not null default 0,
  commission_rate numeric(12,6) not null default 0, approved boolean not null default false, status text not null default 'pending', notes text not null default ''
);
create index booking_creators_campaign_idx on public.booking_creators(campaign_id);
create table public.booking_orders (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.booking_campaigns on delete cascade,
  booking_creator_id uuid references public.booking_creators on delete cascade, product_id uuid references public.products,
  external_order_code text not null default '', amount numeric(18,2) not null default 0, status text not null default ''
);
create index booking_orders_campaign_idx on public.booking_orders(campaign_id,booking_creator_id);
create table public.booking_videos (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.booking_campaigns on delete cascade,
  booking_creator_id uuid references public.booking_creators on delete cascade, product_id uuid references public.products,
  video_url text not null default '', ads_code text not null default '', brief_url text not null default '', status text not null default '', published_at timestamptz
);
create index booking_videos_campaign_idx on public.booking_videos(campaign_id,booking_creator_id);

create table public.planner_tasks (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users, task_date date not null, title text not null, status text not null default 'todo', priority smallint not null default 0, sort_order integer not null default 0, metadata jsonb not null default '{}'
);
create index planner_tasks_date_idx on public.planner_tasks(organization_id,owner_id,task_date);

-- Small, durable daily aggregates are cheaper than repeatedly scanning facts.
create table public.dashboard_daily (
  organization_id uuid not null references public.organizations on delete cascade, channel_id smallint not null references public.channels,
  metric_date date not null, revenue numeric(18,2) not null default 0, orders bigint not null default 0, customers bigint not null default 0,
  ad_spend numeric(18,2) not null default 0, ad_revenue numeric(18,2) not null default 0, updated_at timestamptz not null default now(),
  primary key(organization_id,channel_id,metric_date)
);
create index dashboard_daily_range_idx on public.dashboard_daily(organization_id,metric_date,channel_id);
