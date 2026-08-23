-- Two changes to how a category preference is stored, both from Ariel's review
-- of 20260823090000 the same day.
--
-- 1. A stated DISLIKE stops deleting the row. It writes a row with the opposite
--    polarity instead, so "no shopping streets" counts AGAINST shopping in the
--    ranker rather than merely stopping the boost — and, because it is an
--    ordinary row, it decays on the same clock as everything else instead of
--    being a permanent on/off flag. Deleting also had a bug behind it: a deleted
--    row is absent from the weight map, and the ranker reads absence as "we have
--    never asked", so a text dislike handed the category straight back to the
--    exploration slot. A tap downvote on the same category was barred from
--    exploration outright. That asymmetry is what this closes.
--
-- 2. The decay clock stops running on the calendar. `last_seen_at` measured
--    wall-clock time since the taste was last stated, so a walker who did not
--    open the app for three months came back to a profile that had forgotten
--    them — even though nothing they did could have changed their mind. The
--    clock is now the walker's own usage: `profiles.session_count`, incremented
--    once per successfully built walk plan, and `last_seen_session`, the value
--    that counter had when the taste was last confirmed. The decay input is
--    `session_count - last_seen_session`, so time only passes when the walker
--    actually uses the app.
--
-- `first_seen_at` and `last_seen_at` are kept and still written. They are no
-- longer the decay input, but `last_seen_at` still breaks ties between two
-- equally-weighted tastes, and `first_seen_at` is still the only record of how
-- long a taste has been held — the reasoning the previous migration gave for
-- keeping it does not change here.

-- ---------------------------------------------------------------------------
-- 1. Polarity
-- ---------------------------------------------------------------------------

-- Mirrors `PreferenceSentiment` in src/lib/preferences/preference-extractor.ts,
-- which is the shape the extraction prompt has always returned. Keep both in
-- sync, the same way `attraction_category` mirrors `AttractionCategory`.
create type public.preference_sentiment as enum ('like', 'dislike');

-- A separate polarity column rather than a signed `occurrence_count`, because
-- the two answer different questions and a signed count would conflate them:
-- the count means "how many separate texts have stated this", which is a
-- positive quantity whichever direction the statement pointed in, and the
-- ranker's dislike magnitude deliberately does NOT scale with it (see
-- CATEGORY_DISLIKE_WEIGHT). Signing the count would also make its `> 0` check
-- unstateable and leave 0 as a meaningless third state.
--
-- Defaults to 'like' so every row that already exists — all of which were
-- written by the like branch, since the dislike branch used to delete — reads
-- back as exactly what it was.
alter table public.category_preferences
  add column sentiment public.preference_sentiment not null default 'like';

-- ---------------------------------------------------------------------------
-- 2. The session clock
-- ---------------------------------------------------------------------------

-- One scalar per walker, like `walking_pace_min_per_km` next to it: a value
-- overwritten wholesale with no history worth keeping. An append-only
-- `walk_sessions` table would be the shape to reach for if anything wanted to
-- know WHEN each walk happened, but nothing does — the decay only needs "how
-- many since", and a count(*) on every ranker read is a worse answer to that
-- than an integer that is already coming back with the profile.
alter table public.profiles
  add column session_count integer not null default 0
    check (session_count >= 0);

comment on column public.profiles.session_count is
  'How many walk plans this walker has successfully built. The clock the category_preferences decay runs on — see categoryPreferenceWeight in preference-extractor.ts. Incremented by public.record_walk_session().';

-- Which session number the taste was last confirmed at. `current - this` is the
-- decay input, so a row written during session 7 and read during session 7 is
-- undecayed, exactly as a row written "now" used to be.
--
-- Zero for every row that already exists, alongside `session_count` starting at
-- zero for every profile: the counter did not exist before this migration, so
-- there is no usage history to recover, and starting both sides at zero is the
-- conservative reading — every existing taste is undecayed on migration day and
-- begins ageing from the walker's next real walk. The previous migration made
-- the same call for the same reason when it set both timestamps to now().
alter table public.category_preferences
  add column last_seen_session integer not null default 0
    check (last_seen_session >= 0);

comment on column public.category_preferences.last_seen_session is
  'profiles.session_count at the moment this preference was last stated. The decay input is (current session_count - this), not elapsed days — a walker who was away for three months has not changed their mind.';

comment on column public.category_preferences.last_seen_at is
  'When the walker last stated this. No longer the decay clock (see last_seen_session) — kept because it still breaks ties between equally-weighted tastes, and because it is the only human-readable record of when a row last moved.';

-- The 2026-08-23 09:00 migration's comment on this index says a dislike deletes
-- the row outright. It no longer does — a dislike writes a `sentiment` of
-- 'dislike' on the same one-row-per-(walker, category) key, which is what makes
-- the flip from like to dislike (and back) an update rather than a second row.
comment on index public.category_preferences_user_category is
  'One row per (walker, category), whichever direction the walker last stated. A dislike flips `sentiment` on this row rather than deleting it (changed 2026-08-23 14:00) — so flipping an opinion is an update, and the polarity is always the walker''s current one.';

-- ---------------------------------------------------------------------------
-- 3. Incrementing the counter
-- ---------------------------------------------------------------------------

-- One statement rather than a read-then-write from the application, for two
-- reasons. It is atomic, so two builds that overlap cannot both read 6 and both
-- write 7. And `on conflict do update` is what removes the "this walker has no
-- profile row yet" branch — a signed-in walker who has never had a profile row
-- written gets one here, at session 1, without the application needing to know
-- which case it is in.
--
-- Security invoker (the default) on purpose: it runs as the caller, so the RLS
-- policies on `profiles` are what decide whose row moves, and `auth.uid()` is
-- the only walker it can touch. There is no service-role path anywhere in this
-- feature and this does not add one.
create function public.record_walk_session()
returns integer
language sql
security invoker
set search_path = public
as $$
  insert into public.profiles (id, session_count)
  values (auth.uid(), 1)
  on conflict (id) do update
    set session_count = profiles.session_count + 1
  returning session_count;
$$;

comment on function public.record_walk_session() is
  'Count one real usage occasion for the signed-in walker and return the new total. Called once per successfully built walk plan (src/app/api/walk-plan/route.ts), not per API call — a pace-triggered re-time of a walk already in progress is not a new session.';

revoke execute on function public.record_walk_session() from public;
grant execute on function public.record_walk_session() to authenticated;
