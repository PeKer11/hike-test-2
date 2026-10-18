-- Companion memory (docs/NEXT_PHASE_PLAN.md section 3.7): event-sourced numeric
-- signals only. No free text, no coordinates, no raw tracks. Written only when
-- the walker's "Remember my preferences" consent is on (enforced in
-- src/lib/preferences/companion-memory.ts: no consent -> zero writes).

alter table public.profiles
  add column if not exists pace_by_env jsonb not null default '{}'::jsonb
    check (jsonb_typeof(pace_by_env) = 'object' and pg_column_size(pace_by_env) <= 2048),
  add column if not exists callout_level text
    check (callout_level in ('quiet', 'normal', 'chatty')),
  add column if not exists ui_language text
    check (ui_language in ('en', 'he')),
  add column if not exists typical_walk_minutes smallint
    check (typical_walk_minutes between 10 and 600),
  add column if not exists companion_prefs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(companion_prefs) = 'object' and pg_column_size(companion_prefs) <= 2048);

create table public.place_interactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Same derivation as src/lib/preferences/poi-key.ts.
  poi_key text not null check (char_length(poi_key) between 1 and 200),
  category public.attraction_category not null,
  kind text not null
    check (kind in ('visited', 'dismissed', 'declined_detour', 'added', 'offered')),
  count integer not null default 1 check (count > 0),
  -- profiles.session_count when last touched: the same clock as
  -- category_preferences, so time only passes when the walker uses the app.
  last_session integer not null default 0 check (last_session >= 0),
  last_at timestamptz not null default now(),
  unique (user_id, poi_key, kind)
);

create index place_interactions_user_idx on public.place_interactions (user_id);

create table public.walk_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Truncated to the hour; never a precise start time.
  started_hour timestamptz not null,
  -- City name only, no coordinates.
  area_label text check (char_length(area_label) <= 60),
  planned_min smallint check (planned_min between 0 and 1440),
  actual_min smallint check (actual_min between 0 and 1440),
  distance_m integer check (distance_m between 0 and 200000),
  env_minutes jsonb not null default '{}'::jsonb
    check (jsonb_typeof(env_minutes) = 'object' and pg_column_size(env_minutes) <= 1024),
  stops_planned smallint check (stops_planned between 0 and 100),
  stops_visited smallint check (stops_visited between 0 and 100),
  -- [{"kind":"pace-slow","answer":"shorten"}], at most 20 entries.
  questions jsonb not null default '[]'::jsonb
    check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) <= 20
      and pg_column_size(questions) <= 4096),
  collapse_count smallint not null default 0 check (collapse_count between 0 and 1000)
);

create index walk_summaries_user_idx on public.walk_summaries (user_id, started_hour desc);

-- The same walk written twice (double "end walk", a retry) is one row: persistWalkEnd
-- treats the unique violation as "already stored" and counts nothing a second time.
create unique index walk_summaries_identity_idx
  on public.walk_summaries (user_id, started_hour, planned_min, actual_min, distance_m);

-- ---------------------------------------------------------------------------
-- RLS: own rows only, authenticated only. `anon` and PUBLIC get nothing: this
-- project's default ACL grants table privileges to anon at creation time (see
-- 20260824090000_revoke_anon_execute.sql), so they are revoked explicitly.
-- ---------------------------------------------------------------------------

alter table public.place_interactions enable row level security;
alter table public.walk_summaries enable row level security;

revoke all on table public.place_interactions from anon, public;
revoke all on table public.walk_summaries from anon, public;

create policy "Users can read their own place interactions"
  on public.place_interactions for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own place interactions"
  on public.place_interactions for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update their own place interactions"
  on public.place_interactions for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own place interactions"
  on public.place_interactions for delete to authenticated
  using (auth.uid() = user_id);

create policy "Users can read their own walk summaries"
  on public.walk_summaries for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own walk summaries"
  on public.walk_summaries for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update their own walk summaries"
  on public.walk_summaries for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own walk summaries"
  on public.walk_summaries for delete to authenticated
  using (auth.uid() = user_id);
