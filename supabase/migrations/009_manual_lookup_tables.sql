-- Manually maintained reference data migrated from Lookup and JsonDB_AccountMap.
create table public.product_mappings (
  organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels,
  external_product_id text not null,
  product_code text not null,
  updated_at timestamptz not null default now(),
  primary key(organization_id,channel_id,external_product_id)
);

create table public.sku_mappings (
  organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels,
  external_sku_id text not null,
  seller_sku text not null,
  sale_price numeric(18,2) not null default 0,
  product_name text not null default '',
  updated_at timestamptz not null default now(),
  primary key(organization_id,channel_id,external_sku_id)
);

create table public.account_mappings (
  organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels,
  account_id text not null,
  display_name text not null,
  account_type text not null default 'koc' check(account_type in ('koc','inhouse','unknown')),
  updated_at timestamptz not null default now(),
  primary key(organization_id,channel_id,account_id)
);

create table public.inhouse_accounts (
  organization_id uuid not null references public.organizations on delete cascade,
  channel_id smallint not null references public.channels,
  account_name text not null,
  updated_at timestamptz not null default now(),
  primary key(organization_id,channel_id,account_name)
);

do $$ declare t text; begin
  foreach t in array array['product_mappings','sku_mappings','account_mappings','inhouse_accounts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy %I on public.%I for select using (organization_id=public.current_organization_id())',t||'_read',t);
    execute format('create policy %I on public.%I for all using (public.can_edit(organization_id)) with check (public.can_edit(organization_id))',t||'_write',t);
  end loop;
end $$;

grant select,insert,update,delete on public.product_mappings,public.sku_mappings,public.account_mappings,public.inhouse_accounts to authenticated;

create index product_mappings_code_idx on public.product_mappings(organization_id,product_code);
create index sku_mappings_seller_idx on public.sku_mappings(organization_id,seller_sku);
create index account_mappings_name_idx on public.account_mappings(organization_id,display_name);
