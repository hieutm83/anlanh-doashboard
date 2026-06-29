-- Migration 016 referenced the pre-alias date name in the Shopee JSON aggregate.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.dashboard_section(text,date,date,integer)'::regprocedure) into definition;
  execute replace(definition,'order by x.metric_date','order by x.label');
end $$;
