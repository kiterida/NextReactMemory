create table if not exists public.memory_item_links (
  id bigint generated always as identity primary key,
  parent_item_id bigint not null references public.memory_items (id) on delete cascade,
  child_item_id bigint not null references public.memory_items (id) on delete cascade,
  memory_key integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint memory_item_links_parent_memory_key_key unique (parent_item_id, memory_key),
  constraint memory_item_links_parent_child_key unique (parent_item_id, child_item_id),
  constraint memory_item_links_parent_child_check check (parent_item_id <> child_item_id)
);

comment on table public.memory_item_links is
  'Linked appearances of existing memory_items rows inside another parent list/folder.';

comment on column public.memory_item_links.parent_item_id is
  'Destination parent where the linked appearance should render.';

comment on column public.memory_item_links.child_item_id is
  'Source memory_items row that provides the rendered content.';

comment on column public.memory_item_links.memory_key is
  'Ordering key for the linked appearance inside the destination parent.';

create index if not exists memory_item_links_parent_item_id_idx
  on public.memory_item_links (parent_item_id);

create index if not exists memory_item_links_child_item_id_idx
  on public.memory_item_links (child_item_id);

create index if not exists memory_item_links_parent_memory_key_idx
  on public.memory_item_links (parent_item_id, memory_key);

create index if not exists memory_items_parent_id_idx
  on public.memory_items (parent_id);

alter table public.memory_item_links enable row level security;

drop policy if exists "memory_item_links_select_anon" on public.memory_item_links;
create policy "memory_item_links_select_anon"
on public.memory_item_links
for select
to anon, authenticated
using (true);

drop policy if exists "memory_item_links_insert_anon" on public.memory_item_links;
create policy "memory_item_links_insert_anon"
on public.memory_item_links
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_item_links_update_anon" on public.memory_item_links;
create policy "memory_item_links_update_anon"
on public.memory_item_links
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_item_links_delete_anon" on public.memory_item_links;
create policy "memory_item_links_delete_anon"
on public.memory_item_links
for delete
to anon, authenticated
using (true);

create or replace function public.is_memory_key_available_in_parent(
  p_parent_item_id bigint,
  p_memory_key integer,
  p_exclude_item_id bigint default null,
  p_exclude_link_id bigint default null
)
returns boolean
language sql
stable
as $$
  select
    not exists (
      select 1
      from public.memory_items mi
      where mi.parent_id = p_parent_item_id
        and mi.memory_key = p_memory_key
        and (p_exclude_item_id is null or mi.id <> p_exclude_item_id)
    )
    and not exists (
      select 1
      from public.memory_item_links mil
      where mil.parent_item_id = p_parent_item_id
        and mil.memory_key = p_memory_key
        and (p_exclude_link_id is null or mil.id <> p_exclude_link_id)
    );
$$;

create or replace function public.validate_memory_item_link()
returns trigger
language plpgsql
as $$
begin
  if new.parent_item_id = new.child_item_id then
    raise exception 'A memory item cannot be linked into itself.';
  end if;

  if exists (
    select 1
    from public.memory_items mi
    where mi.id = new.child_item_id
      and mi.parent_id = new.parent_item_id
  ) then
    raise exception 'That memory item already exists as a direct child in the destination parent.';
  end if;

  if not public.is_memory_key_available_in_parent(
    new.parent_item_id,
    new.memory_key,
    null,
    coalesce(new.id, -1)
  ) then
    raise exception 'memory_key % is already used in destination parent %.', new.memory_key, new.parent_item_id;
  end if;

  if exists (
    with recursive reachable(node_id) as (
      select new.child_item_id

      union

      select edges.node_id
      from reachable r
      inner join (
        select child.parent_id as from_id, child.id as node_id
        from public.memory_items child

        union

        select linked.parent_item_id as from_id, linked.child_item_id as node_id
        from public.memory_item_links linked
      ) edges
        on edges.from_id = r.node_id
    )
    select 1
    from reachable
    where node_id = new.parent_item_id
  ) then
    raise exception 'This link would create a recursive loop in the memory tree.';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_memory_item_link on public.memory_item_links;
create trigger validate_memory_item_link
before insert or update of parent_item_id, child_item_id, memory_key
on public.memory_item_links
for each row
execute function public.validate_memory_item_link();

create or replace function public.validate_memory_item_direct_child_constraints()
returns trigger
language plpgsql
as $$
begin
  if new.parent_id is null or new.memory_key is null then
    return new;
  end if;

  if exists (
    select 1
    from public.memory_item_links mil
    where mil.parent_item_id = new.parent_id
      and mil.child_item_id = new.id
  ) then
    raise exception 'This memory item is already linked into the destination parent.';
  end if;

  if not public.is_memory_key_available_in_parent(
    new.parent_id,
    new.memory_key,
    new.id,
    null
  ) then
    raise exception 'memory_key % is already used in destination parent %.', new.memory_key, new.parent_id;
  end if;

  return new;
end;
$$;

drop trigger if exists validate_memory_item_direct_child_constraints on public.memory_items;
create trigger validate_memory_item_direct_child_constraints
before insert or update of parent_id, memory_key
on public.memory_items
for each row
execute function public.validate_memory_item_direct_child_constraints();

drop view if exists public.memory_tree_with_starred;

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
  where mi.parent_id is null
  order by
    case
      when coalesce(combined_child_counts.child_count, 0) > 0 then coalesce(mi.row_order, mi.memory_key, 2147483647)
      else coalesce(mi.memory_key, mi.row_order, 2147483647)
    end asc,
    mi.memory_key asc nulls last,
    mi.row_order asc nulls last,
    mi.id asc;
$$;

drop function if exists public.get_starred_memory_lists();
create or replace function public.get_starred_memory_lists()
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
  source_item_id bigint,
  link_id bigint,
  is_linked boolean,
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
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
  where mi.starred = true
  order by
    case
      when coalesce(combined_child_counts.child_count, 0) > 0 then coalesce(mi.row_order, mi.memory_key, 2147483647)
      else coalesce(mi.memory_key, mi.row_order, 2147483647)
    end asc,
    mi.memory_key asc nulls last,
    mi.row_order asc nulls last,
    mi.id asc;
$$;

drop function if exists public.count_memory_item_descendants(bigint);
create or replace function public.count_memory_item_descendants(p_item_id bigint)
returns bigint
language sql
stable
as $$
  with recursive descendants(id, path) as (
    select
      mi.id,
      array[mi.id]::bigint[] as path
    from public.memory_items mi
    where mi.parent_id = p_item_id

    union all

    select
      child.id,
      d.path || child.id
    from public.memory_items child
    inner join descendants d
      on child.parent_id = d.id
    where not child.id = any(d.path)
  )
  select count(distinct id)::bigint
  from descendants;
$$;

drop function if exists public.delete_memory_item_tree(bigint);
create or replace function public.delete_memory_item_tree(p_item_id bigint)
returns bigint
language sql
as $$
  with recursive descendants(id, path) as (
    select
      mi.id,
      array[mi.id]::bigint[] as path
    from public.memory_items mi
    where mi.id = p_item_id

    union all

    select
      child.id,
      d.path || child.id
    from public.memory_items child
    inner join descendants d
      on child.parent_id = d.id
    where not child.id = any(d.path)
  ),
  deleted as (
    delete from public.memory_items
    where id in (select distinct id from descendants)
    returning id
  )
  select count(*)::bigint
  from deleted;
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
  source_item_id bigint,
  link_id bigint,
  is_linked boolean,
  child_count bigint,
  has_children boolean
)
language sql
stable
as $$
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
  ),
  direct_children as (
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
      mi.id as source_item_id,
      null::bigint as link_id,
      false as is_linked
    from public.memory_items mi
    where mi.parent_id = p_parent_id
  ),
  linked_children as (
    select
      linked_item.id,
      mil.parent_item_id as parent_id,
      linked_item.list_id,
      linked_item.item_type,
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
      true as is_linked
    from public.memory_item_links mil
    inner join public.memory_items linked_item
      on linked_item.id = mil.child_item_id
    where mil.parent_item_id = p_parent_id
  ),
  merged_children as (
    select * from direct_children
    union all
    select * from linked_children
  )
  select
    merged_children.id,
    merged_children.parent_id,
    merged_children.list_id,
    merged_children.item_type,
    merged_children.is_testable,
    merged_children.memory_key,
    merged_children.row_order,
    merged_children.name,
    merged_children.memory_image,
    merged_children.header_image,
    merged_children.description,
    merged_children.rich_text,
    merged_children.code_snippet,
    merged_children.starred,
    merged_children.memory_list_key,
    merged_children.source_item_id,
    merged_children.link_id,
    merged_children.is_linked,
    coalesce(combined_child_counts.child_count, 0) as child_count,
    (coalesce(combined_child_counts.child_count, 0) > 0) as has_children
  from merged_children
  left join combined_child_counts
    on combined_child_counts.parent_id = merged_children.source_item_id
  order by
    coalesce(merged_children.memory_key, merged_children.row_order, 2147483647) asc,
    merged_children.row_order asc nulls last,
    merged_children.id asc;
$$;

drop function if exists public.get_children_with_path(bigint);
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
    case
      when coalesce(combined_child_counts.child_count, 0) > 0 then coalesce(fp.row_order, fp.memory_key, 2147483647)
      else coalesce(fp.memory_key, fp.row_order, 2147483647)
    end asc,
    fp.memory_key asc nulls last,
    fp.row_order asc nulls last,
    fp.id asc;
$$;





