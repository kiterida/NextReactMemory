create table if not exists public.memory_core_widgets (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  user_id text not null,
  dashboard_id text not null default 'main',
  widget_type text not null,
  title text not null,
  position_x integer not null default 0,
  position_y integer not null default 0,
  width integer not null default 6,
  height integer not null default 1,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  config jsonb not null default '{}'::jsonb
);

alter table public.memory_core_widgets enable row level security;

create index if not exists memory_core_widgets_user_dashboard_idx
  on public.memory_core_widgets (user_id, dashboard_id, sort_order);

create index if not exists memory_core_widgets_widget_type_idx
  on public.memory_core_widgets (widget_type);

create or replace function public.set_memory_core_widgets_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_memory_core_widgets_updated_at on public.memory_core_widgets;

create trigger set_memory_core_widgets_updated_at
before update on public.memory_core_widgets
for each row
execute function public.set_memory_core_widgets_updated_at();

-- This app currently uses NextAuth for app login plus the public Supabase anon
-- key in the browser. That means widget queries run as the `anon` database role,
-- not as a Supabase Auth user. These policies allow the current client-side
-- widget flow to work.
--
-- If you later move widget CRUD to a Next.js server route/action with a
-- Supabase service role key, replace these broad policies with server-side
-- authorization checks.
drop policy if exists "memory_core_widgets_select_anon" on public.memory_core_widgets;
create policy "memory_core_widgets_select_anon"
on public.memory_core_widgets
for select
to anon, authenticated
using (true);

drop policy if exists "memory_core_widgets_insert_anon" on public.memory_core_widgets;
create policy "memory_core_widgets_insert_anon"
on public.memory_core_widgets
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_core_widgets_update_anon" on public.memory_core_widgets;
create policy "memory_core_widgets_update_anon"
on public.memory_core_widgets
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_core_widgets_delete_anon" on public.memory_core_widgets;
create policy "memory_core_widgets_delete_anon"
on public.memory_core_widgets
for delete
to anon, authenticated
using (true);

insert into public.memory_core_widgets (
  user_id,
  dashboard_id,
  widget_type,
  title,
  position_x,
  position_y,
  width,
  height,
  sort_order,
  config
) values (
  'jaicuyler@gmail.com',
  'main',
  'current_courses',
  'Current Courses',
  0,
  0,
  6,
  2,
  0,
  jsonb_build_object('memoryItemId', '123')
);

insert into public.memory_core_widgets (
  user_id,
  dashboard_id,
  widget_type,
  title,
  position_x,
  position_y,
  width,
  height,
  sort_order,
  config
) values (
  'jaicuyler@gmail.com',
  'main',
  'history',
  'Recent History',
  6,
  0,
  4,
  2,
  1,
  jsonb_build_object('maxItems', 8)
);
