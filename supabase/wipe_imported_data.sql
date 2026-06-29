-- Full wipe for old dashboard/import data before re-uploading files.
-- Keeps only project configuration:
-- organizations, organization_members, channels, product_mappings, sku_mappings,
-- account_mappings, and inhouse_accounts.
-- Run in Supabase SQL Editor with role postgres/project owner.

begin;

truncate table
  public.ad_performance_daily,
  public.booking_campaigns,
  public.booking_creators,
  public.booking_orders,
  public.booking_videos,
  public.creator_accounts,
  public.customer_order_daily,
  public.dashboard_daily,
  public.dashboard_province_daily,
  public.import_batches,
  public.import_errors,
  public.import_staging,
  public.order_items,
  public.orders,
  public.planner_tasks,
  public.product_performance_daily,
  public.product_skus,
  public.products,
  public.tiktok_ad_records,
  public.tiktok_affiliate_order_lines,
  public.tiktok_order_lines,
  public.tiktok_product_analysis,
  public.traffic_performance_daily
restart identity cascade;

delete from storage.objects where bucket_id = 'imports';
delete from public.import_jobs;

commit;

select 'tiktok_order_lines' as table_name, count(*) as rows_left from public.tiktok_order_lines
union all select 'tiktok_affiliate_order_lines', count(*) from public.tiktok_affiliate_order_lines
union all select 'tiktok_ad_records', count(*) from public.tiktok_ad_records
union all select 'tiktok_product_analysis', count(*) from public.tiktok_product_analysis
union all select 'orders', count(*) from public.orders
union all select 'order_items', count(*) from public.order_items
union all select 'dashboard_daily', count(*) from public.dashboard_daily
union all select 'import_jobs', count(*) from public.import_jobs;
