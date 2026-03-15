alter table public.memory_core_widgets
  add column if not exists display_order integer not null default 0,
  add column if not exists is_collapsed boolean not null default false;

with ordered_widgets as (
  select
    id,
    row_number() over (
      partition by user_id, dashboard_id
      order by sort_order asc, created_at asc, id asc
    ) - 1 as stable_display_order
  from public.memory_core_widgets
)
update public.memory_core_widgets as widgets
set display_order = ordered_widgets.stable_display_order
from ordered_widgets
where widgets.id = ordered_widgets.id;

create index if not exists memory_core_widgets_user_dashboard_display_idx
  on public.memory_core_widgets (user_id, dashboard_id, display_order);
