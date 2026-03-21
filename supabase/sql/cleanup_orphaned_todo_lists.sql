-- Remove orphaned todo lists that are no longer owned by any todo_list widget.
--
-- A todo list is considered referenced when there is a row in memory_core_widgets
-- with widget_type = 'todo_list' and config->>'todo_list_id' matching the list id.
-- Deleting the orphaned list relies on ON DELETE CASCADE to automatically remove
-- all related rows from public.memory_core_todo_items.

with referenced_todo_lists as (
  select distinct (config->>'todo_list_id')::bigint as todo_list_id
  from public.memory_core_widgets
  where widget_type = 'todo_list'
    and coalesce(config->>'todo_list_id', '') ~ '^\d+$'
),
orphaned_todo_lists as (
  select tl.id
  from public.memory_core_todo_lists tl
  left join referenced_todo_lists refs
    on refs.todo_list_id = tl.id
  where refs.todo_list_id is null
)
delete from public.memory_core_todo_lists tl
using orphaned_todo_lists orphaned
where tl.id = orphaned.id;
