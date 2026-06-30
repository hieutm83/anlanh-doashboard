-- Expose the imported TikTok product-analysis payload to authenticated dashboard users.
-- RLS on tiktok_product_analysis keeps rows scoped to the current organization.
create or replace function public.dashboard_shop_product_traffic(p_from date,p_to date,p_limit integer default 5000)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object(
    'rows',coalesce(jsonb_agg(jsonb_build_object(
      'date',metric_date,'productId',product_external_id,'productName',product_name,'rawPayload',raw_payload
    ) order by metric_date,product_name),'[]'::jsonb),
    'from',p_from,'to',p_to
  )
  from (
    select metric_date,product_external_id,product_name,raw_payload
    from public.tiktok_product_analysis
    where metric_date between p_from and p_to
    order by metric_date,product_name
    limit least(greatest(p_limit,1),20000)
  ) x;
$$;

revoke all on function public.dashboard_shop_product_traffic(date,date,integer) from public,anon;
grant execute on function public.dashboard_shop_product_traffic(date,date,integer) to authenticated;
