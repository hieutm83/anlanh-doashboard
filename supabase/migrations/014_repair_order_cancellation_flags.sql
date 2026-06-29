update public.orders
set is_cancelled = status ~* '(hủy|huỷ|cancel)', updated_at=now();

update public.tiktok_order_lines
set is_cancelled = exists(
  select 1 from public.orders o
  where o.organization_id=tiktok_order_lines.organization_id
    and o.channel_id=tiktok_order_lines.channel_id
    and o.external_order_id=tiktok_order_lines.order_id
    and o.is_cancelled
), updated_at=now();

do $$ declare org uuid; dates date[]; begin
  perform set_config('request.jwt.claim.sub','b52b313f-1ae1-4866-94c9-9d80b90b6fc5',true);
  for org in select distinct organization_id from public.orders loop
    select array_agg(distinct order_date) into dates from public.orders where organization_id=org;
    perform public.refresh_dashboard_dates(org,dates);
  end loop;
end $$;
