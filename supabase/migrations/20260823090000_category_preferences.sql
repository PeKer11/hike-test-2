-- Category preferences with a decay: one row per (walker, category), carrying
-- enough state to compute a weight at read time instead of a flat membership
-- test.
--
-- What this replaces. `profiles.preferred_categories` is a flat, monotonic,
-- unbounded `attraction_category[]`: every `like` the preference pass ever
-- detects is appended, only an explicit `dislike` ever removes one, and each
-- entry is worth a flat `PREFERRED_CATEGORY_BOOST` (+4) forever. Twenty prompts
-- in, a walker carries six "preferred" categories, at which point the signal
-- stops discriminating — nearly everything is preferred — and the ranker's
-- exploration branch starves, because `withExplorationPick` excludes every
-- category in the array from ever being explored into. See the 2026-08-21 entry
-- in TODO.md, which found this while measuring something else.
--
-- Its own table rather than a jsonb blob on `profiles`, following the
-- `standing_facts` precedent ("own table because the lifetimes are different").
-- `profiles` holds settings that are overwritten wholesale (pace); this is a
-- growing set of evidence rows with per-row timestamps, an occurrence count and
-- a decay clock. A blob would also keep the read-modify-write of the whole
-- value that `saveCategoryPreferences` does today, where a unique key makes the
-- per-category upsert well defined.
--
-- No importance/strength tier, unlike `standing_facts`, and deliberately.
-- `PREFERENCE_EXTRACTION_SYSTEM_PROMPT` is built end to end around "never
-- guess, an empty list is the normal answer" and only emits explicit taste
-- language, so the stored population is uniform in confidence by construction —
-- there is no weak tier for a tier field to separate. (17 real paired Gemini
-- calls on 2026-08-21 bear that out; see TODO.md.) Facts genuinely spread
-- across importance because a dietary rule and a soft leaning are both
-- extractable and both worth storing. Adding a tier here would mean asking the
-- model to start emitting the low-confidence preferences it is currently told
-- to suppress, which changes what gets learned rather than how it is weighted.

create table public.category_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category public.attraction_category not null,
  -- How many separate texts have stated this liking. Sets the height of the
  -- boost (see categoryPreferenceWeight in preference-extractor.ts); the cap is
  -- applied in TS, not here, so the curve lives in one place.
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  -- When the walker first said it. Never moves. Not read by the scorer — the
  -- decay clock runs off last_seen_at — but it is the only record of how long a
  -- taste has been held, and it costs one column to keep.
  first_seen_at timestamptz not null default now(),
  -- When they last said it. This is the decay clock: every repeat resets it, so
  -- "stated five times and not mentioned in a year" is a real thing the row can
  -- express, and decays like one.
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- `other` is dropped by the parser and by the prompt: every unclassified POI
  -- lands in it, so a preference for it would tell the planner to favour
  -- anything at all. Enforced here too, since the enum itself allows it.
  constraint category_preferences_not_other check (category <> 'other')
);

-- One row per (walker, category). This is what makes the upsert a repeat rather
-- than a second row, exactly as `standing_facts_user_key` does for facts. No
-- partial predicate here: there is no superseded state to exclude, because a
-- `dislike` deletes the row outright (see saveCategoryPreferences).
create unique index category_preferences_user_category
  on public.category_preferences (user_id, category);

create index category_preferences_user_idx
  on public.category_preferences (user_id);

create trigger category_preferences_set_updated_at
  before update on public.category_preferences
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Data migration: carry every existing array over.
--
-- The array never recorded WHEN anything was said, so there is no history to
-- recover and both timestamps are set to now(). That is the assumption, and it
-- is the conservative one: every migrated category starts at full weight
-- (CATEGORY_BOOST_BASE = 4, the old flat boost exactly) and begins its decay
-- from the migration rather than from a date we would have had to invent.
-- Backdating to profiles.created_at would silently zero a preference the walker
-- may have stated yesterday.
--
-- occurrence_count = 1 for the same reason: the array carried no count, and 1
-- is what "we know it was said at least once" means. Claiming more would
-- invent evidence the column exists to stop us inventing.
--
-- Net effect on migration day: byte-for-byte the ranking behaviour of the flat
-- boost. The two only diverge as time passes or the walker repeats themselves.
-- ---------------------------------------------------------------------------

insert into public.category_preferences (user_id, category)
select p.id, c
from public.profiles p
cross join lateral unnest(p.preferred_categories) as c
where c <> 'other'
on conflict (user_id, category) do nothing;

-- Kept, not dropped, and read by nothing on this branch. A build running the
-- pre-decay code still selects this column, and dropping it before the branch
-- ships would degrade that build to "no saved preferences" for every walker.
-- The drop is a follow-up once this ships — see TODO.md.
comment on column public.profiles.preferred_categories is
  'SUPERSEDED 2026-08-23 by public.category_preferences. Copied across by that migration and no longer read or written. Frozen at its migration-day value; drop once the decay path has shipped.';

-- ---------------------------------------------------------------------------
-- RLS — the same four own-rows-only policies as standing_facts.
-- ---------------------------------------------------------------------------

alter table public.category_preferences enable row level security;

create policy "Users can read their own category preferences"
  on public.category_preferences
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own category preferences"
  on public.category_preferences
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own category preferences"
  on public.category_preferences
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own category preferences"
  on public.category_preferences
  for delete
  to authenticated
  using (auth.uid() = user_id);
