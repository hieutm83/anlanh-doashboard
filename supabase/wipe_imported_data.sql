-- Wipe imported dashboard data before re-uploading files.
-- Keeps organizations, organization_members, channels, and manual lookup mappings.
-- Run in Supabase SQL Editor as project owner/postgres.

begin;

truncate table
  public.ad_performance_daily,
  public.customer_order_daily,
  public.dashboard_daily,
  public.dashboard_province_daily,
  public.import_batches,
  public.import_errors,
  public.import_staging,
  public.order_items,
  public.orders,
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
