alter table public.tiktok_affiliate_order_lines
  add column if not exists estimated_standard_commission numeric(18,2) not null default 0,
  add column if not exists actual_standard_commission numeric(18,2) not null default 0;

-- Existing raw payloads retain every source column, so new typed metrics can be backfilled.
update public.tiktok_affiliate_order_lines set
  estimated_standard_commission=coalesce(nullif(regexp_replace(raw_payload->>'Thanh toán hoa hồng tiêu chuẩn ước tính','[^0-9.-]','','g'),'')::numeric,0),
  actual_standard_commission=coalesce(nullif(regexp_replace(raw_payload->>'Thanh toán hoa hồng thực tế','[^0-9.-]','','g'),'')::numeric,0)
where estimated_standard_commission=0 and actual_standard_commission=0;

create or replace function public.finalize_affiliate_import(p_job_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare j import_jobs%rowtype;
begin
  select * into j from import_jobs where id=p_job_id for update;
  if j.id is null or not public.can_edit(j.organization_id) then raise exception 'Not authorized'; end if;
  delete from tiktok_affiliate_order_lines a where a.organization_id=j.organization_id
    and exists(select 1 from import_staging s where s.import_job_id=p_job_id and s.payload->>'order_id'=a.order_id);
  insert into tiktok_affiliate_order_lines(organization_id,channel_id,order_id,product_external_id,product_name,sku_id,price,payment_amount,quantity,status,creator_username,creator_display_name,content_type,content_id,estimated_commission_base,estimated_standard_commission,actual_standard_commission,estimated_ad_commission,actual_ad_commission,created_at,raw_payload,import_job_id)
  select j.organization_id,c.id,s.payload->>'order_id',coalesce(s.payload->>'product_external_id',''),coalesce(s.payload->>'product_name',''),coalesce(s.payload->>'sku_id',''),
    coalesce((s.payload->>'price')::numeric,0),coalesce((s.payload->>'payment_amount')::numeric,0),coalesce((s.payload->>'quantity')::numeric,0),coalesce(s.payload->>'status',''),
    coalesce(s.payload->>'creator_username',''),coalesce(am.display_name,s.payload->>'creator_username',''),coalesce(s.payload->>'content_type',''),coalesce(s.payload->>'content_id',''),
    coalesce((s.payload->>'estimated_commission_base')::numeric,0),coalesce((s.payload->>'estimated_standard_commission')::numeric,0),coalesce((s.payload->>'actual_standard_commission')::numeric,0),
    coalesce((s.payload->>'estimated_ad_commission')::numeric,0),coalesce((s.payload->>'actual_ad_commission')::numeric,0),
    (s.payload->>'created_at')::timestamptz,coalesce(s.payload->'raw_payload',s.payload),p_job_id
  from import_staging s join channels c on c.code='tiktok'
  left join account_mappings am on am.organization_id=j.organization_id and am.channel_id=c.id and am.account_id=s.payload->>'creator_username'
  where s.import_job_id=p_job_id;
  update orders o set is_affiliate_order=true where o.organization_id=j.organization_id
    and exists(select 1 from tiktok_affiliate_order_lines a where a.organization_id=j.organization_id and a.order_id=o.external_order_id and a.import_job_id=p_job_id);
  update import_jobs set status='completed',completed_at=now(),valid_rows=imported_rows where id=p_job_id;
end $$;

create or replace function public.dashboard_affiliate(p_from date,p_to date,p_limit integer default 100)
returns jsonb language sql stable security invoker set search_path=public as $$
  select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(x) order by x.revenue desc),'[]'::jsonb),'from',p_from,'to',p_to) from (
    select coalesce(nullif(creator_display_name,''),creator_username) label,sum(payment_amount) revenue,count(distinct order_id) orders,
      sum(estimated_standard_commission+estimated_ad_commission) spend,sum(quantity) quantity
    from tiktok_affiliate_order_lines where organization_id=current_organization_id()
      and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
    group by 1 order by revenue desc limit least(greatest(p_limit,1),500))x
$$;

create or replace function public.dashboard_costs(p_from date,p_to date,p_limit integer default 100)
returns jsonb language sql stable security invoker set search_path=public as $$
with base as (
  select coalesce(sum(o.net_gmv),0) gmv,count(*) orders
  from orders o where o.organization_id=current_organization_id() and o.order_date between p_from and p_to and not o.is_cancelled and not o.is_sample_order
), listed as (
  select coalesce(sum(coalesce(nullif(sm.sale_price,0),oi.gross_amount/nullif(oi.quantity,0))*oi.quantity),0) value
  from orders o join order_items oi on oi.order_id=o.id left join product_skus ps on ps.id=oi.sku_id
  left join sku_mappings sm on sm.organization_id=o.organization_id and sm.channel_id=o.channel_id and sm.external_sku_id=ps.external_sku_id
  where o.organization_id=current_organization_id() and o.order_date between p_from and p_to and not o.is_cancelled and not o.is_sample_order
), ads as (
  select coalesce(sum(spend),0)value from tiktok_ad_records where organization_id=current_organization_id() and metric_date between p_from and p_to
), affiliate as (
  select coalesce(sum(estimated_standard_commission+estimated_ad_commission),0)value from tiktok_affiliate_order_lines
  where organization_id=current_organization_id() and (created_at at time zone 'Asia/Ho_Chi_Minh')::date between p_from and p_to
), samples as (
  select count(distinct external_order_id)value from orders where organization_id=current_organization_id() and order_date between p_from and p_to and is_sample_order
), rows as (select * from (values
  ('Phí giao dịch',(select gmv*.06 from base)),('Hoa hồng nền tảng',(select gmv*.11 from base)),('Phí xử lý',(select orders*3000 from base)),
  ('Voucher Xtra',(select gmv*.04 from base)),('Chi phí khuyến mãi',greatest(0,(select value from listed)-(select gmv from base))),
  ('Chi phí Ads',(select value from ads)),('Hoa hồng KOC',(select value from affiliate)),('Đơn mẫu',(select value*30000 from samples)))v(label,spend))
select jsonb_build_object('rows',coalesce(jsonb_agg(to_jsonb(rows)),'[]'::jsonb),'from',p_from,'to',p_to) from rows
$$;

revoke all on function public.dashboard_affiliate(date,date,integer),public.dashboard_costs(date,date,integer) from public,anon;
grant execute on function public.dashboard_affiliate(date,date,integer),public.dashboard_costs(date,date,integer) to authenticated;
