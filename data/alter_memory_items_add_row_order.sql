-- Add the row_order column to memory_items and rebuild the helper objects that
-- power the tree UI. Existing rows are backfilled from memory_key so the
-- current order is preserved until you start editing Item Order manually.

alter table if exists public.memory_items
add column if not exists row_order integer;

update public.memory_items
set row_order = memory_key
where row_order is null;

drop view if exists public.memory_tree_with_starred;

drop function if exists public.get_root_memory_items();
drop function if exists public.get_children(bigint);
drop function if exists public.get_children(integer);
drop function if exists public.get_children_with_path(bigint);
drop function if exists public.get_children_with_path(integer);

create or replace view public.memory_tree_with_starred as
select
  mi.id,
  mi.parent_id,
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
  coalesce(child_counts.child_count, 0) as child_count,
  (coalesce(child_counts.child_count, 0) > 0) as has_children
from public.memory_items mi
left join (
  select parent_id, count(*)::bigint as child_count
  from public.memory_items
  where parent_id is not null
  group by parent_id
) child_counts
  on child_counts.parent_id = mi.id;

create or replace function public.get_root_memory_items()
returns table (
  id bigint,
  parent_id bigint,
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
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  select
    mi.id,
    mi.parent_id,
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
    coalesce(child_counts.child_count, 0) as child_count,
    (coalesce(child_counts.child_count, 0) > 0) as has_children
  from public.memory_items mi
  left join (
    select parent_id, count(*)::bigint as child_count
    from public.memory_items
    where parent_id is not null
    group by parent_id
  ) child_counts
    on child_counts.parent_id = mi.id
  where mi.parent_id is null
  order by
    case
      when coalesce(child_counts.child_count, 0) > 0 then coalesce(mi.row_order, mi.memory_key, 2147483647)
      else coalesce(mi.memory_key, mi.row_order, 2147483647)
    end asc,
    mi.memory_key asc nulls last,
    mi.row_order asc nulls last,
    mi.id asc;
$$;

create or replace function public.get_children(p_parent_id bigint)
returns table (
  id bigint,
  parent_id bigint,
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
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  select
    mi.id,
    mi.parent_id,
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
    coalesce(child_counts.child_count, 0) as child_count,
    (coalesce(child_counts.child_count, 0) > 0) as has_children
  from public.memory_items mi
  left join (
    select parent_id, count(*)::bigint as child_count
    from public.memory_items
    where parent_id is not null
    group by parent_id
  ) child_counts
    on child_counts.parent_id = mi.id
  where mi.parent_id = p_parent_id
  order by
    case
      when coalesce(child_counts.child_count, 0) > 0 then coalesce(mi.row_order, mi.memory_key, 2147483647)
      else coalesce(mi.memory_key, mi.row_order, 2147483647)
    end asc,
    mi.memory_key asc nulls last,
    mi.row_order asc nulls last,
    mi.id asc;
$$;

create or replace function public.get_children_with_path(p_focus_id bigint)
returns table (
  id bigint,
  parent_id bigint,
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
    inner join focus_path fp on fp.parent_id = parent.id
  )
  select
    fp.id,
    fp.parent_id,
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
    coalesce(child_counts.child_count, 0) as child_count,
    (coalesce(child_counts.child_count, 0) > 0) as has_children
  from focus_path fp
  left join (
    select parent_id, count(*)::bigint as child_count
    from public.memory_items
    where parent_id is not null
    group by parent_id
  ) child_counts
    on child_counts.parent_id = fp.id
  order by
    case
      when coalesce(child_counts.child_count, 0) > 0 then coalesce(fp.row_order, fp.memory_key, 2147483647)
      else coalesce(fp.memory_key, fp.row_order, 2147483647)
    end asc,
    fp.memory_key asc nulls last,
    fp.row_order asc nulls last,
    fp.id asc;
$$;
