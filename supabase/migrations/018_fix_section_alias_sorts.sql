do $$
declare definition text;
begin
  select pg_get_functiondef('public.dashboard_section(text,date,date,integer)'::regprocedure) into definition;
  definition:=replace(definition,'order by x.task_date,x.sort_order','order by x.date,x.sort_order');
  definition:=replace(definition,'order by x.start_date desc','order by x.date desc');
  execute definition;
end $$;
