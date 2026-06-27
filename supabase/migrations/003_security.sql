alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;

create policy organizations_read on public.organizations for select using (exists(select 1 from public.organization_members m where m.organization_id=id and m.user_id=auth.uid()));
create policy members_read on public.organization_members for select using (user_id=auth.uid());

do $$ declare t text; begin
  foreach t in array array['products','creator_accounts','import_jobs','orders','ad_performance_daily','product_performance_daily','traffic_performance_daily','booking_campaigns','planner_tasks','dashboard_daily'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I on public.%I for select using (organization_id=public.current_organization_id())',t||'_read',t);
    execute format('create policy %I on public.%I for all using (public.can_edit(organization_id)) with check (public.can_edit(organization_id))',t||'_write',t);
  end loop;
end $$;

alter table public.product_skus enable row level security;
create policy product_skus_read on public.product_skus for select using (exists(select 1 from public.products p where p.id=product_id and p.organization_id=current_organization_id()));
alter table public.order_items enable row level security;
create policy order_items_read on public.order_items for select using (exists(select 1 from public.orders o where o.id=order_id and o.organization_id=current_organization_id()));

alter table public.import_batches enable row level security;
alter table public.import_staging enable row level security;
alter table public.import_errors enable row level security;
create policy import_batches_access on public.import_batches for all using (exists(select 1 from public.import_jobs j where j.id=import_job_id and public.can_edit(j.organization_id)));
create policy import_staging_access on public.import_staging for all using (exists(select 1 from public.import_jobs j where j.id=import_job_id and public.can_edit(j.organization_id)));
create policy import_errors_access on public.import_errors for all using (exists(select 1 from public.import_jobs j where j.id=import_job_id and public.can_edit(j.organization_id)));

grant usage on schema public to authenticated;
grant select on public.channels to authenticated;
grant select on all tables in schema public to authenticated;
grant insert,update,delete on public.import_jobs,public.import_batches,public.import_staging,public.import_errors to authenticated;
grant insert,update on public.orders,public.ad_performance_daily,public.product_performance_daily,public.traffic_performance_daily to authenticated;
grant insert,update,delete on public.dashboard_daily to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant execute on function public.begin_import(text,text,bigint),public.import_generic_batch(uuid,integer,jsonb),public.finalize_import(uuid),public.dashboard_overview(date,date,date,date,text),public.dashboard_order_page(date,date,text,text,integer) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('imports','imports',false,524288000,array['text/csv','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) on conflict(id) do nothing;
create policy import_files_read on storage.objects for select to authenticated using(bucket_id='imports' and (storage.foldername(name))[1]=public.current_organization_id()::text);
create policy import_files_write on storage.objects for insert to authenticated with check(bucket_id='imports' and (storage.foldername(name))[1]=public.current_organization_id()::text and public.can_edit(public.current_organization_id()));
