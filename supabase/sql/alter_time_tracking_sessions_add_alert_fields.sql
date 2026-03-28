alter table if exists public.time_tracking_sessions
  add column if not exists alert_threshold_minutes integer null,
  add column if not exists alert_triggered boolean not null default false,
  add column if not exists alert_triggered_at timestamptz null;

update public.time_tracking_sessions
set alert_triggered = false
where alert_triggered is null;
