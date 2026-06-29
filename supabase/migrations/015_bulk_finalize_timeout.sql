-- Bulk imports perform set-based upserts across raw, normalized and aggregate tables.
-- Override the short API default only for these guarded SECURITY DEFINER functions.
alter function public.finalize_import(uuid) set statement_timeout='60s';
alter function public.finalize_order_import(uuid) set statement_timeout='60s';
alter function public.finalize_order_core_import(uuid) set statement_timeout='60s';
alter function public.finalize_affiliate_import(uuid) set statement_timeout='60s';
alter function public.finalize_ads_import(uuid) set statement_timeout='60s';
alter function public.finalize_product_analysis_import(uuid) set statement_timeout='60s';
