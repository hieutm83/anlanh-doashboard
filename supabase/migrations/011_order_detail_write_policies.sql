grant insert,update on public.products,public.product_skus to authenticated;
grant insert,update,delete on public.order_items to authenticated;

create policy product_skus_write on public.product_skus
for all using (
  exists(select 1 from public.products p where p.id=product_id and public.can_edit(p.organization_id))
) with check (
  exists(select 1 from public.products p where p.id=product_id and public.can_edit(p.organization_id))
);

create policy order_items_write on public.order_items
for all using (
  exists(select 1 from public.orders o where o.id=order_id and public.can_edit(o.organization_id))
) with check (
  exists(select 1 from public.orders o where o.id=order_id and public.can_edit(o.organization_id))
);
