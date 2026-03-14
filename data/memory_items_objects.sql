-- Rebuild the memory_items helper view/RPC objects so they include `header_image`.
-- Run this in the Supabase SQL editor after adding the `header_image` column.

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
  order by mi.memory_key asc, mi.id asc;
$$;

create or replace function public.get_children(p_parent_id bigint)
returns table (
  id bigint,
  parent_id bigint,
  memory_key integer,
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
  order by mi.memory_key asc, mi.id asc;
$$;

create or replace function public.get_children_with_path(p_focus_id bigint)
returns table (
  id bigint,
  parent_id bigint,
  memory_key integer,
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
  order by fp.memory_key asc, fp.id asc;
$$;
