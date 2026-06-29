-- The function validates the caller's organization before performing bulk work.
-- Running the internal statements as the owner avoids thousands of repeated RLS checks.
alter function public.finalize_import(uuid) security definer;
revoke all on function public.finalize_import(uuid) from public,anon;
grant execute on function public.finalize_import(uuid) to authenticated;
