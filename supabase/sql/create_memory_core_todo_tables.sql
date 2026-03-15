create table if not exists public.memory_core_todo_lists (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  name text not null,
  memory_item_id bigint null references public.memory_items (id) on delete set null
);

create table if not exists public.memory_core_todo_items (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  todo_list_id bigint not null references public.memory_core_todo_lists (id) on delete cascade,
  name text not null,
  due_date date null,
  priority text not null default 'Normal',
  item_order integer not null default 0,
  is_completed boolean not null default false,
  constraint memory_core_todo_items_priority_check
    check (priority in ('Normal', 'High', 'Urgent'))
);

create index if not exists memory_core_todo_lists_memory_item_idx
  on public.memory_core_todo_lists (memory_item_id);

create index if not exists memory_core_todo_lists_name_idx
  on public.memory_core_todo_lists (name);

create index if not exists memory_core_todo_items_list_order_idx
  on public.memory_core_todo_items (todo_list_id, item_order);

create index if not exists memory_core_todo_items_list_priority_order_idx
  on public.memory_core_todo_items (todo_list_id, priority, item_order);

create index if not exists memory_core_todo_items_due_date_idx
  on public.memory_core_todo_items (due_date);

create or replace function public.set_memory_core_todo_lists_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.set_memory_core_todo_items_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_memory_core_todo_lists_updated_at on public.memory_core_todo_lists;
create trigger set_memory_core_todo_lists_updated_at
before update on public.memory_core_todo_lists
for each row
execute function public.set_memory_core_todo_lists_updated_at();

drop trigger if exists set_memory_core_todo_items_updated_at on public.memory_core_todo_items;
create trigger set_memory_core_todo_items_updated_at
before update on public.memory_core_todo_items
for each row
execute function public.set_memory_core_todo_items_updated_at();

alter table public.memory_core_todo_lists enable row level security;
alter table public.memory_core_todo_items enable row level security;

drop policy if exists "memory_core_todo_lists_select_anon" on public.memory_core_todo_lists;
create policy "memory_core_todo_lists_select_anon"
on public.memory_core_todo_lists
for select
to anon, authenticated
using (true);

drop policy if exists "memory_core_todo_lists_insert_anon" on public.memory_core_todo_lists;
create policy "memory_core_todo_lists_insert_anon"
on public.memory_core_todo_lists
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_core_todo_lists_update_anon" on public.memory_core_todo_lists;
create policy "memory_core_todo_lists_update_anon"
on public.memory_core_todo_lists
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_core_todo_lists_delete_anon" on public.memory_core_todo_lists;
create policy "memory_core_todo_lists_delete_anon"
on public.memory_core_todo_lists
for delete
to anon, authenticated
using (true);

drop policy if exists "memory_core_todo_items_select_anon" on public.memory_core_todo_items;
create policy "memory_core_todo_items_select_anon"
on public.memory_core_todo_items
for select
to anon, authenticated
using (true);

drop policy if exists "memory_core_todo_items_insert_anon" on public.memory_core_todo_items;
create policy "memory_core_todo_items_insert_anon"
on public.memory_core_todo_items
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_core_todo_items_update_anon" on public.memory_core_todo_items;
create policy "memory_core_todo_items_update_anon"
on public.memory_core_todo_items
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_core_todo_items_delete_anon" on public.memory_core_todo_items;
create policy "memory_core_todo_items_delete_anon"
on public.memory_core_todo_items
for delete
to anon, authenticated
using (true);

-- Example: select a todo list with all items.
select
  tl.id,
  tl.name,
  tl.memory_item_id,
  mi.name as memory_item_name,
  json_agg(
    json_build_object(
      'id', ti.id,
      'name', ti.name,
      'due_date', ti.due_date,
      'priority', ti.priority,
      'item_order', ti.item_order,
      'is_completed', ti.is_completed
    )
    order by
      case ti.priority
        when 'Urgent' then 1
        when 'High' then 2
        else 3
      end,
      ti.item_order asc
  ) as items
from public.memory_core_todo_lists tl
left join public.memory_items mi
  on mi.id = tl.memory_item_id
left join public.memory_core_todo_items ti
  on ti.todo_list_id = tl.id
where tl.id = 12
group by tl.id, tl.name, tl.memory_item_id, mi.name;

-- Example: select items sorted by priority and item_order.
select
  id,
  todo_list_id,
  name,
  due_date,
  priority,
  item_order,
  is_completed
from public.memory_core_todo_items
where todo_list_id = 12
order by
  case priority
    when 'Urgent' then 1
    when 'High' then 2
    else 3
  end,
  item_order asc;

-- Example: batch update item_order after drag-and-drop.
update public.memory_core_todo_items as target
set item_order = source.item_order
from (
  values
    (101, 0),
    (103, 1),
    (102, 2)
) as source (id, item_order)
where target.id = source.id
  and target.todo_list_id = 12;
