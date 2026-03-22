create table if not exists public.memory_test_sessions (
  id bigint generated always as identity primary key,
  memory_list_id bigint not null references public.memory_items (id) on delete cascade,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz null,
  total_items integer not null default 0,
  correct_count integer not null default 0,
  incorrect_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  constraint memory_test_sessions_total_items_check check (total_items >= 0),
  constraint memory_test_sessions_correct_count_check check (correct_count >= 0),
  constraint memory_test_sessions_incorrect_count_check check (incorrect_count >= 0)
);

create table if not exists public.memory_test_results (
  id bigint generated always as identity primary key,
  session_id bigint not null references public.memory_test_sessions (id) on delete cascade,
  memory_item_id bigint not null references public.memory_items (id) on delete cascade,
  was_correct boolean not null,
  answered_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint memory_test_results_session_item_unique unique (session_id, memory_item_id)
);

create index if not exists memory_test_sessions_memory_list_completed_idx
  on public.memory_test_sessions (memory_list_id, completed_at desc nulls last, started_at desc);

create index if not exists memory_test_sessions_started_at_idx
  on public.memory_test_sessions (started_at desc);

create index if not exists memory_test_results_session_answered_idx
  on public.memory_test_results (session_id, answered_at asc);

create index if not exists memory_test_results_memory_item_answered_idx
  on public.memory_test_results (memory_item_id, answered_at desc);

create index if not exists memory_test_results_was_correct_idx
  on public.memory_test_results (was_correct);

alter table public.memory_test_sessions enable row level security;
alter table public.memory_test_results enable row level security;

drop policy if exists "memory_test_sessions_select_anon" on public.memory_test_sessions;
create policy "memory_test_sessions_select_anon"
on public.memory_test_sessions
for select
to anon, authenticated
using (true);

drop policy if exists "memory_test_sessions_insert_anon" on public.memory_test_sessions;
create policy "memory_test_sessions_insert_anon"
on public.memory_test_sessions
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_test_sessions_update_anon" on public.memory_test_sessions;
create policy "memory_test_sessions_update_anon"
on public.memory_test_sessions
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_test_sessions_delete_anon" on public.memory_test_sessions;
create policy "memory_test_sessions_delete_anon"
on public.memory_test_sessions
for delete
to anon, authenticated
using (true);

drop policy if exists "memory_test_results_select_anon" on public.memory_test_results;
create policy "memory_test_results_select_anon"
on public.memory_test_results
for select
to anon, authenticated
using (true);

drop policy if exists "memory_test_results_insert_anon" on public.memory_test_results;
create policy "memory_test_results_insert_anon"
on public.memory_test_results
for insert
to anon, authenticated
with check (true);

drop policy if exists "memory_test_results_update_anon" on public.memory_test_results;
create policy "memory_test_results_update_anon"
on public.memory_test_results
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "memory_test_results_delete_anon" on public.memory_test_results;
create policy "memory_test_results_delete_anon"
on public.memory_test_results
for delete
to anon, authenticated
using (true);
