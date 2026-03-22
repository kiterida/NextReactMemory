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
        when mi.item_type = 'group' then 'group'
        when owned.owner_list_id is null then 'group'
        when coalesce(child_counts.child_count, 0) > 0 then 'folder'
        else 'item'
      end as next_item_type,
      case
        when roots.id is not null then false
        when mi.item_type = 'group' then false
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

select public.refresh_memory_item_metadata();
