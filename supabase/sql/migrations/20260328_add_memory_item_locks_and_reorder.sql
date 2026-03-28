alter table public.memory_items
  add column if not exists is_locked boolean not null default false;

comment on column public.memory_items.is_locked is
  'Locks a list root so its descendant structure cannot be reordered or structurally changed.';

create or replace function public.resequence_memory_parent_entries(p_parent_id bigint)
returns void
language plpgsql
as $$
declare
  v_start_key integer := 0;
  v_temp_start_key integer := 0;
begin
  if p_parent_id is null then
    perform 1
    from public.memory_items mi
    where mi.parent_id is null
    for update;
  else
    perform 1
    from public.memory_items mi
    where mi.parent_id = p_parent_id
    for update;

    perform 1
    from public.memory_item_links mil
    where mil.parent_item_id = p_parent_id
    for update;
  end if;

  select coalesce(min(entry_sort_key), 0), coalesce(max(entry_sort_key), 0) + 1000000
  into v_start_key, v_temp_start_key
  from (
    select coalesce(mi.memory_key, mi.row_order, 0) as entry_sort_key
    from public.memory_items mi
    where (p_parent_id is null and mi.parent_id is null)
       or mi.parent_id = p_parent_id

    union all

    select coalesce(mil.memory_key, 0) as entry_sort_key
    from public.memory_item_links mil
    where p_parent_id is not null
      and mil.parent_item_id = p_parent_id
  ) ordered_entries;

  with ordered_entries as (
    select
      'item'::text as entry_kind,
      mi.id as entry_id,
      coalesce(mi.memory_key, mi.row_order, 2147483647) as sort_key
    from public.memory_items mi
    where (p_parent_id is null and mi.parent_id is null)
       or mi.parent_id = p_parent_id

    union all

    select
      'link'::text as entry_kind,
      mil.id as entry_id,
      coalesce(mil.memory_key, 2147483647) as sort_key
    from public.memory_item_links mil
    where p_parent_id is not null
      and mil.parent_item_id = p_parent_id
  ),
  numbered_entries as (
    select
      entry_kind,
      entry_id,
      row_number() over (order by sort_key, entry_kind, entry_id) - 1 as position_index
    from ordered_entries
  )
  update public.memory_items mi
  set
    memory_key = v_temp_start_key + numbered_entries.position_index,
    row_order = v_temp_start_key + numbered_entries.position_index
  from numbered_entries
  where numbered_entries.entry_kind = 'item'
    and mi.id = numbered_entries.entry_id;

  if p_parent_id is not null then
    with ordered_entries as (
      select
        'item'::text as entry_kind,
        mi.id as entry_id,
        coalesce(mi.memory_key, mi.row_order, 2147483647) as sort_key
      from public.memory_items mi
      where mi.parent_id = p_parent_id

      union all

      select
        'link'::text as entry_kind,
        mil.id as entry_id,
        coalesce(mil.memory_key, 2147483647) as sort_key
      from public.memory_item_links mil
      where mil.parent_item_id = p_parent_id
    ),
    numbered_entries as (
      select
        entry_kind,
        entry_id,
        row_number() over (order by sort_key, entry_kind, entry_id) - 1 as position_index
      from ordered_entries
    )
    update public.memory_item_links mil
    set memory_key = v_temp_start_key + numbered_entries.position_index
    from numbered_entries
    where numbered_entries.entry_kind = 'link'
      and mil.id = numbered_entries.entry_id;
  end if;

  with ordered_entries as (
    select
      'item'::text as entry_kind,
      mi.id as entry_id,
      coalesce(mi.memory_key, mi.row_order, 2147483647) as sort_key
    from public.memory_items mi
    where (p_parent_id is null and mi.parent_id is null)
       or mi.parent_id = p_parent_id

    union all

    select
      'link'::text as entry_kind,
      mil.id as entry_id,
      coalesce(mil.memory_key, 2147483647) as sort_key
    from public.memory_item_links mil
    where p_parent_id is not null
      and mil.parent_item_id = p_parent_id
  ),
  numbered_entries as (
    select
      entry_kind,
      entry_id,
      v_start_key + row_number() over (order by sort_key, entry_kind, entry_id) - 1 as next_key
    from ordered_entries
  )
  update public.memory_items mi
  set
    memory_key = numbered_entries.next_key,
    row_order = numbered_entries.next_key
  from numbered_entries
  where numbered_entries.entry_kind = 'item'
    and mi.id = numbered_entries.entry_id;

  if p_parent_id is not null then
    with ordered_entries as (
      select
        'item'::text as entry_kind,
        mi.id as entry_id,
        coalesce(mi.memory_key, mi.row_order, 2147483647) as sort_key
      from public.memory_items mi
      where mi.parent_id = p_parent_id

      union all

      select
        'link'::text as entry_kind,
        mil.id as entry_id,
        coalesce(mil.memory_key, 2147483647) as sort_key
      from public.memory_item_links mil
      where mil.parent_item_id = p_parent_id
    ),
    numbered_entries as (
      select
        entry_kind,
        entry_id,
        v_start_key + row_number() over (order by sort_key, entry_kind, entry_id) - 1 as next_key
      from ordered_entries
    )
    update public.memory_item_links mil
    set memory_key = numbered_entries.next_key
    from numbered_entries
    where numbered_entries.entry_kind = 'link'
      and mil.id = numbered_entries.entry_id;
  end if;
end;
$$;

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
  select *
  from (
    select * from direct_children
    union all
    select * from linked_children
  ) merged_children
  order by
    coalesce(memory_key, row_order, 2147483647) asc,
    id asc;
$$;

drop function if exists public.get_children_with_path(bigint);
drop function if exists public.get_children_with_path(integer);
create or replace function public.get_children_with_path(p_focus_id bigint)
returns table (
  id bigint,
  parent_id bigint,
  list_id bigint,
  item_type text,
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

create or replace function public.set_memory_list_lock_state(
  p_list_item_id bigint,
  p_is_locked boolean
)
returns table (
  id bigint,
  is_locked boolean
)
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.memory_items mi
    where mi.id = p_list_item_id
      and mi.item_type = 'list'
  ) then
    raise exception 'Only list items can be locked or unlocked.';
  end if;

  return query
  update public.memory_items mi
  set is_locked = p_is_locked
  where mi.id = p_list_item_id
  returning mi.id::bigint, mi.is_locked;
end;
$$;

create or replace function public.move_memory_items(
  p_item_ids bigint[],
  p_new_parent_id bigint
)
returns void
language plpgsql
as $$
declare
  v_old_parent_token bigint;
  v_destination_next_key integer := 0;
  v_old_parent_tokens bigint[] := '{}';
begin
  if coalesce(array_length(p_item_ids, 1), 0) = 0 then
    return;
  end if;

  if p_new_parent_id is not null and p_new_parent_id = any (p_item_ids) then
    raise exception 'An item cannot be moved into itself.';
  end if;

  select coalesce(array_agg(distinct coalesce(mi.parent_id, -1)), '{}')
  into v_old_parent_tokens
  from public.memory_items mi
  where mi.id = any (p_item_ids);

  if exists (
    select 1
    from public.memory_items mi
    inner join public.memory_items locked_list
      on locked_list.id = mi.list_id
     and locked_list.item_type = 'list'
     and locked_list.is_locked = true
    where mi.id = any (p_item_ids)
      and mi.id <> coalesce(mi.list_id, -1)
  ) then
    raise exception 'This list is locked. Structural changes are disabled.';
  end if;

  if p_new_parent_id is not null then
    if not exists (
      select 1
      from public.memory_items mi
      where mi.id = p_new_parent_id
    ) then
      raise exception 'The destination parent was not found.';
    end if;

    if exists (
      select 1
      from public.memory_items destination
      inner join public.memory_items locked_list
        on locked_list.id = destination.list_id
       and locked_list.item_type = 'list'
       and locked_list.is_locked = true
      where destination.id = p_new_parent_id
    ) then
      raise exception 'This list is locked. Structural changes are disabled.';
    end if;

    if exists (
      with recursive moving_subtree as (
        select mi.id
        from public.memory_items mi
        where mi.id = any (p_item_ids)

        union all

        select child.id
        from public.memory_items child
        inner join moving_subtree ms
          on child.parent_id = ms.id
      )
      select 1
      from moving_subtree
      where id = p_new_parent_id
    ) then
      raise exception 'You cannot move an item into one of its descendants.';
    end if;
  end if;

  select coalesce(max(existing_keys.memory_key), -1) + 1
  into v_destination_next_key
  from (
    select mi.memory_key
    from public.memory_items mi
    where (
      (p_new_parent_id is null and mi.parent_id is null)
      or mi.parent_id = p_new_parent_id
    )
      and not (mi.id = any (p_item_ids))

    union all

    select mil.memory_key
    from public.memory_item_links mil
    where p_new_parent_id is not null
      and mil.parent_item_id = p_new_parent_id
  ) existing_keys;

  with ordered_moving_items as (
    select
      mi.id,
      row_number() over (
        order by coalesce(mi.memory_key, mi.row_order, 2147483647), mi.id
      ) - 1 as row_offset
    from public.memory_items mi
    where mi.id = any (p_item_ids)
  )
  update public.memory_items mi
  set
    parent_id = p_new_parent_id,
    memory_key = v_destination_next_key + ordered_moving_items.row_offset,
    row_order = v_destination_next_key + ordered_moving_items.row_offset
  from ordered_moving_items
  where mi.id = ordered_moving_items.id;

  foreach v_old_parent_token in array v_old_parent_tokens loop
    perform public.resequence_memory_parent_entries(
      case
        when v_old_parent_token = -1 then null
        else v_old_parent_token
      end
    );
  end loop;

  perform public.resequence_memory_parent_entries(p_new_parent_id);
  perform public.refresh_memory_item_metadata();
end;
$$;

create or replace function public.reorder_memory_items_within_parent(
  p_moved_item_id bigint,
  p_target_item_id bigint,
  p_insert_position text default 'before'
)
returns void
language plpgsql
as $$
declare
  v_parent_id bigint;
  v_target_parent_id bigint;
  v_start_key integer := 0;
  v_temp_start_key integer := 0;
  v_insert_index integer := 0;
  v_insert_position text := case when lower(coalesce(p_insert_position, 'before')) = 'after' then 'after' else 'before' end;
begin
  if p_moved_item_id = p_target_item_id then
    return;
  end if;

  select mi.parent_id
  into v_parent_id
  from public.memory_items mi
  where mi.id = p_moved_item_id;

  if not found then
    raise exception 'The moved item was not found.';
  end if;

  select mi.parent_id
  into v_target_parent_id
  from public.memory_items mi
  where mi.id = p_target_item_id;

  if not found then
    raise exception 'The target item was not found.';
  end if;

  if v_parent_id is distinct from v_target_parent_id then
    raise exception 'Sibling reorder is only allowed within the same parent.';
  end if;

  if exists (
    select 1
    from public.memory_items mi
    inner join public.memory_items locked_list
      on locked_list.id = mi.list_id
     and locked_list.item_type = 'list'
     and locked_list.is_locked = true
    where mi.id in (p_moved_item_id, p_target_item_id)
      and mi.id <> coalesce(mi.list_id, -1)
  ) then
    raise exception 'This list is locked. Reordering is disabled.';
  end if;

  if v_parent_id is not null and exists (
    select 1
    from public.memory_items destination
    inner join public.memory_items locked_list
      on locked_list.id = destination.list_id
     and locked_list.item_type = 'list'
     and locked_list.is_locked = true
    where destination.id = v_parent_id
  ) then
    raise exception 'This list is locked. Reordering is disabled.';
  end if;

  if v_parent_id is null then
    perform 1
    from public.memory_items mi
    where mi.parent_id is null
    for update;
  else
    perform 1
    from public.memory_items mi
    where mi.parent_id = v_parent_id
    for update;

    perform 1
    from public.memory_item_links mil
    where mil.parent_item_id = v_parent_id
    for update;
  end if;

  select coalesce(min(entry_sort_key), 0), coalesce(max(entry_sort_key), 0) + 1000000
  into v_start_key, v_temp_start_key
  from (
    select coalesce(mi.memory_key, mi.row_order, 0) as entry_sort_key
    from public.memory_items mi
    where (v_parent_id is null and mi.parent_id is null)
       or mi.parent_id = v_parent_id

    union all

    select coalesce(mil.memory_key, 0) as entry_sort_key
    from public.memory_item_links mil
    where v_parent_id is not null
      and mil.parent_item_id = v_parent_id
  ) all_entries;

  with ordered_entries as (
    select
      entry_kind,
      entry_id,
      row_number() over (order by sort_key, entry_kind, entry_id) as absolute_position
    from (
      select
        'item'::text as entry_kind,
        mi.id as entry_id,
        coalesce(mi.memory_key, mi.row_order, 2147483647) as sort_key
      from public.memory_items mi
      where (v_parent_id is null and mi.parent_id is null)
         or mi.parent_id = v_parent_id

      union all

      select
        'link'::text as entry_kind,
        mil.id as entry_id,
        coalesce(mil.memory_key, 2147483647) as sort_key
      from public.memory_item_links mil
      where v_parent_id is not null
        and mil.parent_item_id = v_parent_id
    ) sortable_entries
  ),
  remaining_entries as (
    select
      entry_kind,
      entry_id,
      row_number() over (order by absolute_position) as remaining_position
    from ordered_entries
    where not (entry_kind = 'item' and entry_id = p_moved_item_id)
  )
  select case
    when v_insert_position = 'after' then remaining_position + 1
    else remaining_position
  end
  into v_insert_index
  from remaining_entries
  where entry_kind = 'item'
    and entry_id = p_target_item_id;

  with ordered_entries as (
    select
      entry_kind,
      entry_id,
      row_number() over (order by sort_key, entry_kind, entry_id) as absolute_position
    from (
      select
        'item'::text as entry_kind,
        mi.id as entry_id,
        coalesce(mi.memory_key, mi.row_order, 2147483647) as sort_key
      from public.memory_items mi
      where (v_parent_id is null and mi.parent_id is null)
         or mi.parent_id = v_parent_id

      union all

      select
        'link'::text as entry_kind,
        mil.id as entry_id,
        coalesce(mil.memory_key, 2147483647) as sort_key
      from public.memory_item_links mil
      where v_parent_id is not null
        and mil.parent_item_id = v_parent_id
    ) sortable_entries
  ),
  remaining_entries as (
    select
      entry_kind,
      entry_id,
      row_number() over (order by absolute_position) as remaining_position
    from ordered_entries
    where not (entry_kind = 'item' and entry_id = p_moved_item_id)
  ),
  final_positions as (
    select
      remaining_entries.entry_kind,
      remaining_entries.entry_id,
      case
        when remaining_entries.remaining_position >= v_insert_index then remaining_entries.remaining_position + 1
        else remaining_entries.remaining_position
      end as final_position
    from remaining_entries

    union all

    select
      'item'::text as entry_kind,
      p_moved_item_id as entry_id,
      v_insert_index as final_position
  ),
  numbered_entries as (
    select
      final_positions.entry_kind,
      final_positions.entry_id,
      row_number() over (
        order by final_positions.final_position, final_positions.entry_kind, final_positions.entry_id
      ) - 1 as position_index
    from final_positions
  )
  update public.memory_items mi
  set
    memory_key = v_temp_start_key + numbered_entries.position_index,
    row_order = v_temp_start_key + numbered_entries.position_index
  from numbered_entries
  where numbered_entries.entry_kind = 'item'
    and mi.id = numbered_entries.entry_id;

  if v_parent_id is not null then
    with ordered_entries as (
      select
        entry_kind,
        entry_id,
        row_number() over (order by sort_key, entry_kind, entry_id) as absolute_position
      from (
        select
          'item'::text as entry_kind,
          mi.id as entry_id,
          coalesce(mi.memory_key, mi.row_order, 2147483647) as sort_key
        from public.memory_items mi
        where mi.parent_id = v_parent_id

        union all

        select
          'link'::text as entry_kind,
          mil.id as entry_id,
          coalesce(mil.memory_key, 2147483647) as sort_key
        from public.memory_item_links mil
        where mil.parent_item_id = v_parent_id
      ) sortable_entries
    ),
    remaining_entries as (
      select
        entry_kind,
        entry_id,
        row_number() over (order by absolute_position) as remaining_position
      from ordered_entries
      where not (entry_kind = 'item' and entry_id = p_moved_item_id)
    ),
    final_positions as (
      select
        remaining_entries.entry_kind,
        remaining_entries.entry_id,
        case
          when remaining_entries.remaining_position >= v_insert_index then remaining_entries.remaining_position + 1
          else remaining_entries.remaining_position
        end as final_position
      from remaining_entries

      union all

      select
        'item'::text as entry_kind,
        p_moved_item_id as entry_id,
        v_insert_index as final_position
    ),
    numbered_entries as (
      select
        final_positions.entry_kind,
        final_positions.entry_id,
        row_number() over (
          order by final_positions.final_position, final_positions.entry_kind, final_positions.entry_id
        ) - 1 as position_index
      from final_positions
    )
    update public.memory_item_links mil
    set memory_key = v_temp_start_key + numbered_entries.position_index
    from numbered_entries
    where numbered_entries.entry_kind = 'link'
      and mil.id = numbered_entries.entry_id;
  end if;

  with ordered_entries as (
    select
      entry_kind,
      entry_id,
      row_number() over (order by sort_key, entry_kind, entry_id) as absolute_position
    from (
      select
        'item'::text as entry_kind,
        mi.id as entry_id,
        coalesce(mi.memory_key, mi.row_order, 2147483647) as sort_key
      from public.memory_items mi
      where (v_parent_id is null and mi.parent_id is null)
         or mi.parent_id = v_parent_id

      union all

      select
        'link'::text as entry_kind,
        mil.id as entry_id,
        coalesce(mil.memory_key, 2147483647) as sort_key
      from public.memory_item_links mil
      where v_parent_id is not null
        and mil.parent_item_id = v_parent_id
    ) sortable_entries
  ),
  remaining_entries as (
    select
      entry_kind,
      entry_id,
      row_number() over (order by absolute_position) as remaining_position
    from ordered_entries
    where not (entry_kind = 'item' and entry_id = p_moved_item_id)
  ),
  final_positions as (
    select
      remaining_entries.entry_kind,
      remaining_entries.entry_id,
      case
        when remaining_entries.remaining_position >= v_insert_index then remaining_entries.remaining_position + 1
        else remaining_entries.remaining_position
      end as final_position
    from remaining_entries

    union all

    select
      'item'::text as entry_kind,
      p_moved_item_id as entry_id,
      v_insert_index as final_position
  ),
  numbered_entries as (
    select
      final_positions.entry_kind,
      final_positions.entry_id,
      v_start_key + row_number() over (
        order by final_positions.final_position, final_positions.entry_kind, final_positions.entry_id
      ) - 1 as next_key
    from final_positions
  )
  update public.memory_items mi
  set
    memory_key = numbered_entries.next_key,
    row_order = numbered_entries.next_key
  from numbered_entries
  where numbered_entries.entry_kind = 'item'
    and mi.id = numbered_entries.entry_id;

  if v_parent_id is not null then
    with ordered_entries as (
      select
        entry_kind,
        entry_id,
        row_number() over (order by sort_key, entry_kind, entry_id) as absolute_position
      from (
        select
          'item'::text as entry_kind,
          mi.id as entry_id,
          coalesce(mi.memory_key, mi.row_order, 2147483647) as sort_key
        from public.memory_items mi
        where mi.parent_id = v_parent_id

        union all

        select
          'link'::text as entry_kind,
          mil.id as entry_id,
          coalesce(mil.memory_key, 2147483647) as sort_key
        from public.memory_item_links mil
        where mil.parent_item_id = v_parent_id
      ) sortable_entries
    ),
    remaining_entries as (
      select
        entry_kind,
        entry_id,
        row_number() over (order by absolute_position) as remaining_position
      from ordered_entries
      where not (entry_kind = 'item' and entry_id = p_moved_item_id)
    ),
    final_positions as (
      select
        remaining_entries.entry_kind,
        remaining_entries.entry_id,
        case
          when remaining_entries.remaining_position >= v_insert_index then remaining_entries.remaining_position + 1
          else remaining_entries.remaining_position
        end as final_position
      from remaining_entries

      union all

      select
        'item'::text as entry_kind,
        p_moved_item_id as entry_id,
        v_insert_index as final_position
    ),
    numbered_entries as (
      select
        final_positions.entry_kind,
        final_positions.entry_id,
        v_start_key + row_number() over (
          order by final_positions.final_position, final_positions.entry_kind, final_positions.entry_id
        ) - 1 as next_key
      from final_positions
    )
    update public.memory_item_links mil
    set memory_key = numbered_entries.next_key
    from numbered_entries
    where numbered_entries.entry_kind = 'link'
      and mil.id = numbered_entries.entry_id;
  end if;
end;
$$;





