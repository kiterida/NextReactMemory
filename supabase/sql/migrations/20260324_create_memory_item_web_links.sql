create table if not exists public.memory_item_web_links (
  id bigint generated always as identity primary key,
  memory_item_id bigint not null references public.memory_items (id) on delete cascade,
  link_heading text not null,
  url text not null,
  description text null,
  image_url text null,
  row_order bigint null,
  created_at timestamptz not null default now()
);

comment on table public.memory_item_web_links is
  'Structured web links attached to memory_items rows.';

comment on column public.memory_item_web_links.memory_item_id is
  'The memory item that owns this structured web link.';

comment on column public.memory_item_web_links.link_heading is
  'Display heading shown for the structured web link.';

comment on column public.memory_item_web_links.url is
  'Destination URL for the structured web link.';

comment on column public.memory_item_web_links.image_url is
  'Optional preview image URL attached to the structured web link.';

comment on column public.memory_item_web_links.row_order is
  'Optional ordering key for the structured web link within its memory item.';

create index if not exists memory_item_web_links_memory_item_id_idx
  on public.memory_item_web_links (memory_item_id);

create index if not exists memory_item_web_links_memory_item_id_row_order_idx
  on public.memory_item_web_links (memory_item_id, row_order);

alter table public.memory_item_web_links enable row level security;

drop policy if exists "memory_item_web_links_select_anon" on public.memory_item_web_links;
create policy "memory_item_web_links_select_anon"
on public.memory_item_web_links
for select
to anon, authenticated
using (true);

drop policy if exists "memory_item_web_links_insert_anon" on public.memory_item_web_links;
create policy "memory_item_web_links_insert_anon"
on public.memory_item_web_links
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_item_web_links_update_anon" on public.memory_item_web_links;
create policy "memory_item_web_links_update_anon"
on public.memory_item_web_links
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_item_web_links_delete_anon" on public.memory_item_web_links;
create policy "memory_item_web_links_delete_anon"
on public.memory_item_web_links
for delete
to anon, authenticated
using (true);

