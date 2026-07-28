-- Initial schema for the AI Walking Companion user profile + feedback loop.
--
-- Two tables only:
--   profiles            — one row per authenticated user, holds learned/declared preferences
--   attraction_feedback — per-user signal on a specific POI or on a whole category
--
-- Attractions are not stored anywhere in this app (they come fresh from
-- Overpass on every walk), so feedback rows carry enough denormalized info to
-- recognize the same POI again later.

-- Mirrors AttractionCategory in src/lib/types/walk-plan.ts. Keep both in sync.
create type public.attraction_category as enum (
  'landmark',
  'museum',
  'park',
  'food',
  'viewpoint',
  'religious',
  'shopping',
  'entertainment',
  'nature',
  'other'
);

create type public.group_preference as enum ('solo', 'group');

create type public.feedback_signal as enum ('upvote', 'downvote', 'skip');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Learned over time from actual GPS pace, not asked for at signup.
  walking_pace_min_per_km numeric(4, 1)
    check (walking_pace_min_per_km is null
      or (walking_pace_min_per_km > 0 and walking_pace_min_per_km <= 60)),
  preferred_categories public.attraction_category[] not null default '{}',
  -- Overrides the per-category default visit duration when the user
  -- consistently spends more or less time at stops.
  typical_visit_minutes integer
    check (typical_visit_minutes is null
      or (typical_visit_minutes > 0 and typical_visit_minutes <= 480)),
  group_preference public.group_preference,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can insert their own profile"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "Users can delete their own profile"
  on public.profiles
  for delete
  to authenticated
  using (auth.uid() = id);

-- Every new auth user gets an empty profile so the app never has to branch on
-- "profile missing" versus "profile empty".
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- attraction_feedback
-- ---------------------------------------------------------------------------

create table public.attraction_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  signal public.feedback_signal not null,
  category public.attraction_category not null,
  -- Overpass element id (Attraction.id), e.g. "node/1234567". Null when the
  -- feedback is about a whole category rather than one POI.
  osm_id text,
  poi_name text,
  lat numeric(9, 6) check (lat is null or (lat >= -90 and lat <= 90)),
  lng numeric(9, 6) check (lng is null or (lng >= -180 and lng <= 180)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A row is either category-level (no POI fields at all) or POI-level (name
  -- and coordinates required, osm_id optional since Overpass ids are not
  -- guaranteed stable across OSM edits).
  constraint attraction_feedback_target_shape check (
    (poi_name is null and lat is null and lng is null and osm_id is null)
    or (poi_name is not null and lat is not null and lng is not null)
  )
);

-- Identity of the feedback target. OSM id when we have one, otherwise the
-- name plus coordinates rounded to ~11 m so the same POI re-fetched from
-- Overpass with slightly different geometry still matches. Empty string marks
-- category-level feedback.
alter table public.attraction_feedback
  add column poi_key text generated always as (
    coalesce(
      nullif(osm_id, ''),
      case
        when poi_name is null then ''
        else lower(poi_name) || '@'
          || round(lat, 4)::text || ',' || round(lng, 4)::text
      end
    )
  ) stored;

-- One standing signal per user per target; a new vote upserts the old one.
create unique index attraction_feedback_user_target_key
  on public.attraction_feedback (user_id, category, poi_key);

create index attraction_feedback_user_signal_idx
  on public.attraction_feedback (user_id, signal);

create trigger attraction_feedback_set_updated_at
  before update on public.attraction_feedback
  for each row
  execute function public.set_updated_at();

alter table public.attraction_feedback enable row level security;

create policy "Users can read their own feedback"
  on public.attraction_feedback
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own feedback"
  on public.attraction_feedback
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own feedback"
  on public.attraction_feedback
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own feedback"
  on public.attraction_feedback
  for delete
  to authenticated
  using (auth.uid() = user_id);
