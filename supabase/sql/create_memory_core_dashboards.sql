create extension if not exists pgcrypto;

create table if not exists public.memory_core_dashboards (
  id text primary key default gen_random_uuid()::text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id text not null,
  name text not null,
  description text,
  icon text,
  color text,
  display_order integer not null default 0,
  is_default boolean not null default false
);

alter table public.memory_core_dashboards enable row level security;

create index if not exists memory_core_dashboards_user_order_idx
  on public.memory_core_dashboards (user_id, display_order, created_at);

create unique index if not exists memory_core_dashboards_user_name_idx
  on public.memory_core_dashboards (user_id, name);

create unique index if not exists memory_core_dashboards_user_default_idx
  on public.memory_core_dashboards (user_id)
  where is_default = true;

create or replace function public.set_memory_core_dashboards_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_memory_core_dashboards_updated_at on public.memory_core_dashboards;

create trigger set_memory_core_dashboards_updated_at
before update on public.memory_core_dashboards
for each row
execute function public.set_memory_core_dashboards_updated_at();

drop policy if exists "memory_core_dashboards_select_anon" on public.memory_core_dashboards;
create policy "memory_core_dashboards_select_anon"
on public.memory_core_dashboards
for select
to anon, authenticated
using (true);

drop policy if exists "memory_core_dashboards_insert_anon" on public.memory_core_dashboards;
create policy "memory_core_dashboards_insert_anon"
on public.memory_core_dashboards
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_core_dashboards_update_anon" on public.memory_core_dashboards;
create policy "memory_core_dashboards_update_anon"
on public.memory_core_dashboards
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_core_dashboards_delete_anon" on public.memory_core_dashboards;
create policy "memory_core_dashboards_delete_anon"
on public.memory_core_dashboards
for delete
to anon, authenticated
using (true);

alter table public.memory_core_widgets
  add column if not exists dashboard_id text;

with widget_owners as (
  select distinct user_id
  from public.memory_core_widgets
  where user_id is not null
),
seed_dashboards as (
  select
    owner.user_id,
    seed.name,
    seed.description,
    seed.icon,
    seed.color,
    seed.display_order,
    seed.is_default
  from widget_owners owner
  cross join (
    values
      ('Training', 'Training dashboard', 'school', '#2e7d32', 0, true),
      ('Projects', 'Projects dashboard', 'folder', '#1565c0', 1, false),
      ('Memory Revision', 'Memory revision dashboard', 'psychology', '#6a1b9a', 2, false),
      ('Analytics', 'Analytics dashboard', 'analytics', '#ef6c00', 3, false)
  ) as seed(name, description, icon, color, display_order, is_default)
),
inserted_dashboards as (
  insert into public.memory_core_dashboards (
    user_id,
    name,
    description,
    icon,
    color,
    display_order,
    is_default
  )
  select
    seed_dashboards.user_id,
    seed_dashboards.name,
    seed_dashboards.description,
    seed_dashboards.icon,
    seed_dashboards.color,
    seed_dashboards.display_order,
    seed_dashboards.is_default
  from seed_dashboards
  on conflict (user_id, name) do update
  set
    description = excluded.description,
    icon = excluded.icon,
    color = excluded.color,
    display_order = excluded.display_order,
    is_default = excluded.is_default
  returning id, user_id, name, is_default
),
default_dashboards as (
  select id, user_id
  from inserted_dashboards
  where is_default = true

  union

  select id, user_id
  from public.memory_core_dashboards
  where is_default = true
)
update public.memory_core_widgets as widgets
set dashboard_id = defaults.id
from default_dashboards defaults
where widgets.user_id = defaults.user_id
  and (
    widgets.dashboard_id is null
    or widgets.dashboard_id = ''
    or widgets.dashboard_id = 'main'
  );

alter table public.memory_core_widgets
  alter column dashboard_id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'memory_core_widgets_dashboard_id_fkey'
  ) then
    alter table public.memory_core_widgets
      add constraint memory_core_widgets_dashboard_id_fkey
      foreign key (dashboard_id)
      references public.memory_core_dashboards(id)
      on delete cascade;
  end if;
end
$$;

create index if not exists memory_core_widgets_dashboard_id_idx
  on public.memory_core_widgets (dashboard_id);

create index if not exists memory_core_widgets_user_dashboard_display_idx
  on public.memory_core_widgets (user_id, dashboard_id, display_order);
