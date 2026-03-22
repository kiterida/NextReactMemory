alter table public.memory_items
  add column if not exists list_id bigint null,
  add column if not exists item_type text null,
  add column if not exists is_testable boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'memory_items_list_id_fkey'
      and conrelid = 'public.memory_items'::regclass
  ) then
    alter table public.memory_items
      add constraint memory_items_list_id_fkey
      foreign key (list_id) references public.memory_items (id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'memory_items_item_type_check'
      and conrelid = 'public.memory_items'::regclass
  ) then
    alter table public.memory_items
      add constraint memory_items_item_type_check
      check (item_type in ('group', 'list', 'folder', 'item'));
  end if;
end
$$;

create index if not exists memory_items_parent_id_idx
  on public.memory_items (parent_id);

create index if not exists memory_items_list_id_idx
  on public.memory_items (list_id);

create index if not exists memory_items_item_type_idx
  on public.memory_items (item_type);

create index if not exists memory_items_list_testable_idx
  on public.memory_items (list_id, is_testable, item_type, memory_key, row_order);

comment on column public.memory_items.list_id is 'Logical owning memory list root. Tree hierarchy still uses parent_id.';
comment on column public.memory_items.item_type is 'group=list organizer outside a list, list=logical test root, folder=folder within list, item=testable entry.';
comment on column public.memory_items.is_testable is 'Controls whether the node should appear in memory tests.';

create or replace function public.refresh_memory_item_metadata()
returns void
language plpgsql
as $$
begin
  with recursive list_roots as (
    select mi.id
    from public.memory_items mi
    where mi.item_type = 'list'
       or mi.memory_list_key is not null
  ),
  owned_nodes as (
    select
      lr.id as owner_list_id,
      lr.id as node_id
    from list_roots lr

    union all

    select
      owned.owner_list_id,
      child.id as node_id
    from owned_nodes owned
    inner join public.memory_items child
      on child.parent_id = owned.node_id
    where not exists (
      select 1
      from list_roots nested_root
      where nested_root.id = child.id
        and nested_root.id <> owned.owner_list_id
    )
  ),
  child_counts as (
    select
      parent_id as id,
      count(*)::bigint as child_count
    from public.memory_items
    where parent_id is not null
    group by parent_id
  ),
  classified as (
    select
      mi.id,
      case
        when roots.id is not null then mi.id
        else owned.owner_list_id
      end as next_list_id,
      case
        when roots.id is not null then 'list'
        when owned.owner_list_id is null then 'group'
        when coalesce(child_counts.child_count, 0) > 0 then 'folder'
        else 'item'
      end as next_item_type,
      case
        when roots.id is not null then false
        when owned.owner_list_id is null then false
        when coalesce(child_counts.child_count, 0) > 0 then coalesce(mi.is_testable, false)
        else true
      end as next_is_testable
    from public.memory_items mi
    left join list_roots roots
      on roots.id = mi.id
    left join owned_nodes owned
      on owned.node_id = mi.id
    left join child_counts
      on child_counts.id = mi.id
  )
  update public.memory_items mi
  set
    list_id = classified.next_list_id,
    item_type = classified.next_item_type,
    is_testable = classified.next_is_testable
  from classified
  where mi.id = classified.id;
end;
$$;

-- Backfill assumptions:
-- 1. Existing rows with memory_list_key are the authoritative current list roots.
-- 2. Nodes outside any such list become grouping nodes.
-- 3. Descendants inherit the nearest ancestor list root as list_id ownership.
select public.refresh_memory_item_metadata();

drop view if exists public.memory_tree_with_starred;

drop function if exists public.get_root_memory_items();
drop function if exists public.get_children(bigint);
drop function if exists public.get_children(integer);
drop function if exists public.get_children_with_path(bigint);
drop function if exists public.get_children_with_path(integer);
drop function if exists public.get_memory_item_owner_list_id(bigint);
drop function if exists public.get_memory_list_descendants(bigint);
drop function if exists public.get_memory_list_testable_nodes(bigint);
drop function if exists public.get_memory_subtree_testable_nodes(bigint);
drop function if exists public.move_memory_items(bigint[], bigint);

create or replace view public.memory_tree_with_starred as
select
  mi.id,
  mi.parent_id,
  mi.list_id,
  mi.item_type,
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
  list_id bigint,
  item_type text,
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
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  select
    mi.id,
    mi.parent_id,
    mi.list_id,
    mi.item_type,
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
  list_id bigint,
  item_type text,
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
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  select
    mi.id,
    mi.parent_id,
    mi.list_id,
    mi.item_type,
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
  list_id bigint,
  item_type text,
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
    inner join focus_path fp on fp.parent_id = parent.id
  )
  select
    fp.id,
    fp.parent_id,
    fp.list_id,
    fp.item_type,
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

create or replace function public.get_memory_item_owner_list_id(p_item_id bigint)
returns bigint
language sql
stable
as $$
  select mi.list_id
  from public.memory_items mi
  where mi.id = p_item_id
  limit 1;
$$;

create or replace function public.get_memory_list_descendants(p_list_id bigint)
returns table (
  id bigint,
  parent_id bigint,
  list_id bigint,
  item_type text,
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
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  select *
  from public.memory_tree_with_starred
  where list_id = p_list_id
    and id <> p_list_id
  order by
    row_order asc nulls last,
    memory_key asc nulls last,
    id asc;
$$;

create or replace function public.get_memory_list_testable_nodes(p_list_id bigint)
returns table (
  id bigint,
  parent_id bigint,
  list_id bigint,
  item_type text,
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
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  select mtws.*
  from public.memory_tree_with_starred mtws
  where mtws.list_id = p_list_id
    and mtws.is_testable = true
    and mtws.item_type <> 'group'
    and not exists (
      with recursive ancestors as (
        select parent.id, parent.parent_id, parent.item_type
        from public.memory_items current_item
        inner join public.memory_items parent
          on parent.id = current_item.parent_id
        where current_item.id = mtws.id

        union all

        select parent.id, parent.parent_id, parent.item_type
        from public.memory_items parent
        inner join ancestors a
          on parent.id = a.parent_id
      )
      select 1
      from ancestors
      where item_type = 'group'
    )
  order by
    memory_key asc nulls last,
    row_order asc nulls last,
    id asc;
$$;

create or replace function public.get_memory_subtree_testable_nodes(p_root_id bigint)
returns table (
  id bigint,
  parent_id bigint,
  list_id bigint,
  item_type text,
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
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
  with recursive subtree as (
    select mi.id, mi.parent_id, mi.item_type
    from public.memory_items mi
    where mi.id = p_root_id

    union all

    select child.id, child.parent_id, child.item_type
    from public.memory_items child
    inner join subtree s on child.parent_id = s.id
    where s.item_type <> 'group'
      and child.item_type <> 'group'
  )
  select mtws.*
  from public.memory_tree_with_starred mtws
  inner join subtree s on s.id = mtws.id
  where mtws.is_testable = true
    and mtws.item_type <> 'group'
    and not (mtws.id = p_root_id and mtws.item_type = 'list')
  order by
    mtws.memory_key asc nulls last,
    mtws.row_order asc nulls last,
    mtws.id asc;
$$;

create or replace function public.move_memory_items(p_item_ids bigint[], p_new_parent_id bigint)
returns void
language plpgsql
as $$
begin
  update public.memory_items
  set parent_id = p_new_parent_id
  where id = any (p_item_ids);

  perform public.refresh_memory_item_metadata();
end;
$$;
