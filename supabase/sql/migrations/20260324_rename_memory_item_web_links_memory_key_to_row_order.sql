do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memory_item_web_links'
      and column_name = 'memory_key'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memory_item_web_links'
      and column_name = 'row_order'
  ) then
    alter table public.memory_item_web_links
      rename column memory_key to row_order;
  end if;
end
$$;

drop index if exists public.memory_item_web_links_memory_item_id_memory_key_idx;

create index if not exists memory_item_web_links_memory_item_id_row_order_idx
  on public.memory_item_web_links (memory_item_id, row_order);

comment on column public.memory_item_web_links.row_order is
  'Optional ordering key for the structured web link within its memory item.';
