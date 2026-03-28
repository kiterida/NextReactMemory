alter table public.memory_items
  add column if not exists sort_mode text;

update public.memory_items
set sort_mode = 'memory_key_asc'
where sort_mode is null;

alter table public.memory_items
  alter column sort_mode set default 'memory_key_asc';

alter table public.memory_items
  alter column sort_mode set not null;

comment on column public.memory_items.sort_mode is
  'Saved per-container child display sort. This affects UI ordering only and does not rewrite memorization keys.';

alter table public.memory_items
  drop constraint if exists memory_items_sort_mode_check;

alter table public.memory_items
  add constraint memory_items_sort_mode_check
  check (sort_mode in ('memory_key_asc', 'name_asc', 'name_desc'));

drop view if exists public.memory_tree_with_starred cascade;

create view public.memory_tree_with_starred as
with combined_child_counts as (
  select
    parent_ref.parent_id,
    count(*)::bigint as child_count
  from (
    select mi.parent_id
    from public.memory_items mi
    where mi.parent_id is not null

    union all

    select mil.parent_item_id as parent_id
    from public.memory_item_links mil
  ) parent_ref
  group by parent_ref.parent_id
)
select
  mi.id,
  mi.parent_id,
  mi.list_id,
  mi.item_type,
  mi.sort_mode,
  mi.is_locked,
  mi.is_testable,
  mi.memory_key,
  mi.row_order,
  mi.name,
  mi.memory_image,
  mi.header_image,
  mi.description,
  mi.rich_text,
  mi.code_snippet,
  mi.starred,
  mi.memory_list_key,
  mi.id as source_item_id,
  null::bigint as link_id,
  false as is_linked,
  coalesce(combined_child_counts.child_count, 0) as child_count,
  (coalesce(combined_child_counts.child_count, 0) > 0) as has_children
from public.memory_items mi
left join combined_child_counts
  on combined_child_counts.parent_id = mi.id;

drop function if exists public.get_root_memory_items();
create or replace function public.get_root_memory_items()
returns table (
  id bigint,
  parent_id bigint,
  list_id bigint,
  item_type text,
  sort_mode text,
  is_locked boolean,
  is_testable boolean,
  memory_key integer,
  row_order integer,
  name text,
  memory_image text,
  header_image text,
  description text,
  rich_text text,
  code_snippet text,
  starred boolean,
  memory_list_key integer,
  source_item_id bigint,
  link_id bigint,
  is_linked boolean,
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  select *
  from public.memory_tree_with_starred
  where parent_id is null
  order by
    case
      when has_children then coalesce(row_order, memory_key, 2147483647)
      else coalesce(memory_key, row_order, 2147483647)
    end asc,
    memory_key asc nulls last,
    row_order asc nulls last,
    id asc;
$$;

drop function if exists public.get_starred_memory_lists();
create or replace function public.get_starred_memory_lists()
returns table (
  id bigint,
  parent_id bigint,
  list_id bigint,
  item_type text,
  sort_mode text,
  is_locked boolean,
  is_testable boolean,
  memory_key integer,
  row_order integer,
  name text,
  memory_image text,
  header_image text,
  description text,
  rich_text text,
  code_snippet text,
  starred boolean,
  memory_list_key integer,
  source_item_id bigint,
  link_id bigint,
  is_linked boolean,
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  select *
  from public.memory_tree_with_starred
  where starred = true
  order by
    case
      when has_children then coalesce(row_order, memory_key, 2147483647)
      else coalesce(memory_key, row_order, 2147483647)
    end asc,
    memory_key asc nulls last,
    row_order asc nulls last,
    id asc;
$$;

drop function if exists public.get_children(bigint);
drop function if exists public.get_children(integer);
create or replace function public.get_children(p_parent_id bigint)
returns table (
  id bigint,
  parent_id bigint,
  list_id bigint,
  item_type text,
  sort_mode text,
  is_locked boolean,
  is_testable boolean,
  memory_key integer,
  row_order integer,
  name text,
  memory_image text,
  header_image text,
  description text,
  rich_text text,
  code_snippet text,
  starred boolean,
  memory_list_key integer,
  source_item_id bigint,
  link_id bigint,
  is_linked boolean,
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  with parent_config as (
    select coalesce(
      (select mi.sort_mode from public.memory_items mi where mi.id = p_parent_id),
      'memory_key_asc'
    ) as sort_mode
  ),
  combined_child_counts as (
    select
      parent_ref.parent_id,
      count(*)::bigint as child_count
    from (
      select mi.parent_id
      from public.memory_items mi
      where mi.parent_id is not null

      union all

      select mil.parent_item_id as parent_id
      from public.memory_item_links mil
    ) parent_ref
    group by parent_ref.parent_id
  ),
  direct_children as (
    select
      mi.id,
      mi.parent_id,
      mi.list_id,
      mi.item_type,
      mi.sort_mode,
      mi.is_locked,
      mi.is_testable,
      mi.memory_key,
      mi.row_order,
      mi.name,
      mi.memory_image,
      mi.header_image,
      mi.description,
      mi.rich_text,
      mi.code_snippet,
      mi.starred,
      mi.memory_list_key,
      mi.id as source_item_id,
      null::bigint as link_id,
      false as is_linked,
      coalesce(combined_child_counts.child_count, 0) as child_count,
      (coalesce(combined_child_counts.child_count, 0) > 0) as has_children
    from public.memory_items mi
    left join combined_child_counts
      on combined_child_counts.parent_id = mi.id
    where mi.parent_id = p_parent_id
  ),
  linked_children as (
    select
      linked_item.id,
      mil.parent_item_id as parent_id,
      linked_item.list_id,
      linked_item.item_type,
      linked_item.sort_mode,
      linked_item.is_locked,
      linked_item.is_testable,
      mil.memory_key,
      mil.memory_key as row_order,
      linked_item.name,
      linked_item.memory_image,
      linked_item.header_image,
      linked_item.description,
      linked_item.rich_text,
      linked_item.code_snippet,
      linked_item.starred,
      linked_item.memory_list_key,
      linked_item.id as source_item_id,
      mil.id as link_id,
      true as is_linked,
      coalesce(combined_child_counts.child_count, 0) as child_count,
      (coalesce(combined_child_counts.child_count, 0) > 0) as has_children
    from public.memory_item_links mil
    inner join public.memory_items linked_item
      on linked_item.id = mil.child_item_id
    left join combined_child_counts
      on combined_child_counts.parent_id = linked_item.id
    where mil.parent_item_id = p_parent_id
  )
  select merged_children.*
  from (
    select * from direct_children
    union all
    select * from linked_children
  ) merged_children
  cross join parent_config
  order by
    case
      when parent_config.sort_mode in ('name_asc', 'name_desc')
        and nullif(btrim(merged_children.name), '') is null
      then 1
      else 0
    end asc,
    case
      when parent_config.sort_mode = 'name_asc'
      then lower(nullif(btrim(merged_children.name), ''))
      else null
    end asc nulls last,
    case
      when parent_config.sort_mode = 'name_desc'
      then lower(nullif(btrim(merged_children.name), ''))
      else null
    end desc nulls last,
    coalesce(merged_children.memory_key, merged_children.row_order, 2147483647) asc,
    merged_children.id asc;
$$;

drop function if exists public.get_children_with_path(bigint);
drop function if exists public.get_children_with_path(integer);
create or replace function public.get_children_with_path(p_focus_id bigint)
returns table (
  id bigint,
  parent_id bigint,
  list_id bigint,
  item_type text,
  sort_mode text,
  is_locked boolean,
  is_testable boolean,
  memory_key integer,
  row_order integer,
  name text,
  memory_image text,
  header_image text,
  description text,
  rich_text text,
  code_snippet text,
  starred boolean,
  memory_list_key integer,
  source_item_id bigint,
  link_id bigint,
  is_linked boolean,
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  with recursive focus_path as (
    select
      mi.id,
      mi.parent_id,
      mi.list_id,
      mi.item_type,
      mi.sort_mode,
      mi.is_locked,
      mi.is_testable,
      mi.memory_key,
      mi.row_order,
      mi.name,
      mi.memory_image,
      mi.header_image,
      mi.description,
      mi.rich_text,
      mi.code_snippet,
      mi.starred,
      mi.memory_list_key
    from public.memory_items mi
    where mi.id = p_focus_id

    union all

    select
      parent.id,
      parent.parent_id,
      parent.list_id,
      parent.item_type,
      parent.sort_mode,
      parent.is_locked,
      parent.is_testable,
      parent.memory_key,
      parent.row_order,
      parent.name,
      parent.memory_image,
      parent.header_image,
      parent.description,
      parent.rich_text,
      parent.code_snippet,
      parent.starred,
      parent.memory_list_key
    from public.memory_items parent
    inner join focus_path fp
      on fp.parent_id = parent.id
  ),
  combined_child_counts as (
    select
      parent_ref.parent_id,
      count(*)::bigint as child_count
    from (
      select mi.parent_id
      from public.memory_items mi
      where mi.parent_id is not null

      union all

      select mil.parent_item_id as parent_id
      from public.memory_item_links mil
    ) parent_ref
    group by parent_ref.parent_id
  )
  select
    fp.id,
    fp.parent_id,
    fp.list_id,
    fp.item_type,
    fp.sort_mode,
    fp.is_locked,
    fp.is_testable,
    fp.memory_key,
    fp.row_order,
    fp.name,
    fp.memory_image,
    fp.header_image,
    fp.description,
    fp.rich_text,
    fp.code_snippet,
    fp.starred,
    fp.memory_list_key,
    fp.id as source_item_id,
    null::bigint as link_id,
    false as is_linked,
    coalesce(combined_child_counts.child_count, 0) as child_count,
    (coalesce(combined_child_counts.child_count, 0) > 0) as has_children
  from focus_path fp
  left join combined_child_counts
    on combined_child_counts.parent_id = fp.id
  order by
    fp.parent_id nulls first,
    coalesce(fp.memory_key, fp.row_order, 2147483647) asc,
    fp.id asc;
$$;
