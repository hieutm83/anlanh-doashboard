create or replace function public.dashboard_customer_portrait(p_from date,p_to date,p_limit integer default 100)
returns jsonb language sql stable security invoker set search_path=public as $$
with scoped as (
  select public.normalize_province(province) province,net_gmv,external_order_id,customer_name
  from orders o join channels c on c.id=o.channel_id where o.organization_id=current_organization_id() and c.code='tiktok'
    and o.order_date between p_from and p_to and not o.is_cancelled and not o.is_sample_order
), rows as (
  select province label,province,sum(net_gmv)revenue,count(distinct external_order_id)orders,count(distinct nullif(customer_name,''))customers
  from scoped group by province order by revenue desc limit least(greatest(p_limit,1),500)
), summary as (
  select coalesce(sum(net_gmv),0)revenue,count(distinct external_order_id)orders,count(distinct nullif(customer_name,''))customers from scoped
)
select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(rows)order by revenue desc)from rows),'[]'::jsonb),
  'summary',(select to_jsonb(summary)from summary),'from',p_from,'to',p_to)
$$;
revoke all on function public.dashboard_customer_portrait(date,date,integer) from public,anon;
grant execute on function public.dashboard_customer_portrait(date,date,integer) to authenticated;
