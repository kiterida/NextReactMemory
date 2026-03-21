-- List-specific tags for todo items.
--
-- Tags belong to exactly one todo list, which keeps categories scoped to the
-- current project/list instead of becoming a global shared taxonomy.
create table if not exists public.memory_core_todo_tags (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  todo_list_id bigint not null references public.memory_core_todo_lists (id) on delete cascade,
  name text not null,
  color text null,
  display_order integer not null default 0
);

comment on table public.memory_core_todo_tags is 'Tags/categories that belong to a single to do list.';
comment on column public.memory_core_todo_tags.todo_list_id is 'Owning to do list. Deleting the list deletes its tags.';
comment on column public.memory_core_todo_tags.color is 'Optional display color used for chips in the widget UI.';
comment on column public.memory_core_todo_tags.display_order is 'Controls tag ordering within a single list.';

-- Join table linking todo items to one or more list-specific tags.
create table if not exists public.memory_core_todo_item_tags (
  id bigint generated always as identity primary key,
  todo_item_id bigint not null references public.memory_core_todo_items (id) on delete cascade,
  todo_tag_id bigint not null references public.memory_core_todo_tags (id) on delete cascade,
  constraint memory_core_todo_item_tags_unique unique (todo_item_id, todo_tag_id)
);

comment on table public.memory_core_todo_item_tags is 'Join table linking to do items to one or more tags.';
comment on column public.memory_core_todo_item_tags.todo_item_id is 'Deleting the item removes its tag links.';
comment on column public.memory_core_todo_item_tags.todo_tag_id is 'Deleting the tag removes its item links.';

create index if not exists memory_core_todo_tags_list_order_idx
  on public.memory_core_todo_tags (todo_list_id, display_order, name);

create index if not exists memory_core_todo_tags_list_name_idx
  on public.memory_core_todo_tags (todo_list_id, name);

create index if not exists memory_core_todo_item_tags_item_idx
  on public.memory_core_todo_item_tags (todo_item_id);

create index if not exists memory_core_todo_item_tags_tag_idx
  on public.memory_core_todo_item_tags (todo_tag_id);

create or replace function public.set_memory_core_todo_tags_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_memory_core_todo_tags_updated_at on public.memory_core_todo_tags;
create trigger set_memory_core_todo_tags_updated_at
before update on public.memory_core_todo_tags
for each row
execute function public.set_memory_core_todo_tags_updated_at();

alter table public.memory_core_todo_tags enable row level security;
alter table public.memory_core_todo_item_tags enable row level security;

drop policy if exists "memory_core_todo_tags_select_anon" on public.memory_core_todo_tags;
create policy "memory_core_todo_tags_select_anon"
on public.memory_core_todo_tags
for select
to anon, authenticated
using (true);

drop policy if exists "memory_core_todo_tags_insert_anon" on public.memory_core_todo_tags;
create policy "memory_core_todo_tags_insert_anon"
on public.memory_core_todo_tags
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_core_todo_tags_update_anon" on public.memory_core_todo_tags;
create policy "memory_core_todo_tags_update_anon"
on public.memory_core_todo_tags
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_core_todo_tags_delete_anon" on public.memory_core_todo_tags;
create policy "memory_core_todo_tags_delete_anon"
on public.memory_core_todo_tags
for delete
to anon, authenticated
using (true);

drop policy if exists "memory_core_todo_item_tags_select_anon" on public.memory_core_todo_item_tags;
create policy "memory_core_todo_item_tags_select_anon"
on public.memory_core_todo_item_tags
for select
to anon, authenticated
using (true);

drop policy if exists "memory_core_todo_item_tags_insert_anon" on public.memory_core_todo_item_tags;
create policy "memory_core_todo_item_tags_insert_anon"
on public.memory_core_todo_item_tags
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_core_todo_item_tags_update_anon" on public.memory_core_todo_item_tags;
create policy "memory_core_todo_item_tags_update_anon"
on public.memory_core_todo_item_tags
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_core_todo_item_tags_delete_anon" on public.memory_core_todo_item_tags;
create policy "memory_core_todo_item_tags_delete_anon"
on public.memory_core_todo_item_tags
for delete
to anon, authenticated
using (true);
