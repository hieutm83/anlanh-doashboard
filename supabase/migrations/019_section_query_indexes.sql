-- Support date-scoped section dashboards without scanning whole operational tables.
create index if not exists affiliate_org_created_idx on public.tiktok_affiliate_order_lines(organization_id,created_at);
create index if not exists planner_org_date_idx on public.planner_tasks(organization_id,task_date);
create index if not exists booking_campaign_org_start_idx on public.booking_campaigns(organization_id,start_date desc);
