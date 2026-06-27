-- Bootstrap the first production tenant and administrator.
insert into public.organizations (id, name, timezone)
values ('2e769dc7-e470-4ec7-b480-e7841b30e2be', 'An Lanh Farm', 'Asia/Ho_Chi_Minh')
on conflict (id) do update set
  name = excluded.name,
  timezone = excluded.timezone;

insert into public.organization_members (organization_id, user_id, role)
values (
  '2e769dc7-e470-4ec7-b480-e7841b30e2be',
  'b52b313f-1ae1-4866-94c9-9d80b90b6fc5',
  'admin'
)
on conflict (organization_id, user_id) do update set role = excluded.role;
