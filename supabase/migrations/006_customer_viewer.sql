-- Password-only customer account. The technical email is hidden by the frontend.
insert into public.organization_members (organization_id, user_id, role)
values (
  '2e769dc7-e470-4ec7-b480-e7841b30e2be',
  '6e1d4a32-d8ed-44b2-a377-6d3f55c2baf3',
  'viewer'
)
on conflict (organization_id, user_id) do update set role = excluded.role;
