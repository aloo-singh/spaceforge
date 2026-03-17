-- SpaceForge analytics review queries
-- Copy-paste into the Supabase SQL editor as needed.

-- 1. Recent events ordered by time
select
  id,
  event,
  "timestamp",
  session_id,
  route,
  version,
  source,
  properties
from public.analytics_events
order by "timestamp" desc
limit 100;

-- 2. Sessions with first_success
select distinct
  session_id
from public.analytics_events
where event = 'first_success'
order by session_id;

-- 3. Sessions with export_completed
select distinct
  session_id
from public.analytics_events
where event = 'export_completed'
order by session_id;

-- 4. Count of events by type
select
  event,
  count(*) as event_count
from public.analytics_events
group by event
order by event_count desc, event asc;

-- 5. Sessions where shared_wall_disambiguation_used occurred
select
  session_id,
  min("timestamp") as first_seen_at,
  count(*) as disambiguation_uses
from public.analytics_events
where event = 'shared_wall_disambiguation_used'
group by session_id
order by first_seen_at desc;

-- 6. Recent session_summary events with extracted properties
select
  "timestamp",
  session_id,
  coalesce((properties ->> 'durationMs')::bigint, 0) as duration_ms,
  coalesce((properties ->> 'roomsCreated')::int, 0) as rooms_created,
  coalesce((properties ->> 'roomRenames')::int, 0) as room_renames,
  coalesce((properties ->> 'exportsStarted')::int, 0) as exports_started,
  coalesce((properties ->> 'exportsCompleted')::int, 0) as exports_completed,
  coalesce((properties ->> 'settingsOpened')::int, 0) as settings_opened,
  coalesce((properties ->> 'onboardingStarted')::boolean, false) as onboarding_started,
  coalesce((properties ->> 'onboardingCompleted')::boolean, false) as onboarding_completed,
  coalesce((properties ->> 'firstActionOccurred')::boolean, false) as first_action_occurred,
  coalesce((properties ->> 'firstSuccessOccurred')::boolean, false) as first_success_occurred
from public.analytics_events
where event = 'session_summary'
order by "timestamp" desc
limit 50;

-- 7. Full event trail for a specific session
select
  id,
  event,
  "timestamp",
  session_id,
  route,
  version,
  properties
from public.analytics_events
where session_id = 'REPLACE_WITH_SESSION_ID'
order by "timestamp" asc;

-- 8. Simple session funnel by key milestone
with session_flags as (
  select
    session_id,
    bool_or(event = 'app_opened') as opened,
    bool_or(event = 'editor_loaded') as editor_loaded,
    bool_or(event = 'first_action') as first_action,
    bool_or(event = 'first_success') as first_success,
    bool_or(event = 'export_completed') as export_completed
  from public.analytics_events
  group by session_id
)
select
  count(*) as total_sessions,
  count(*) filter (where opened) as opened_sessions,
  count(*) filter (where editor_loaded) as editor_loaded_sessions,
  count(*) filter (where first_action) as first_action_sessions,
  count(*) filter (where first_success) as first_success_sessions,
  count(*) filter (where export_completed) as export_completed_sessions
from session_flags;

-- 9. Sessions with room renaming
select
  session_id,
  count(*) as rename_count,
  min("timestamp") as first_rename_at
from public.analytics_events
where event = 'room_renamed'
group by session_id
order by first_rename_at desc;