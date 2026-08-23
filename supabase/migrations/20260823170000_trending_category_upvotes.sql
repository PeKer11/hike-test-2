-- What the app can lean on before it has learned anything about a particular
-- walker: what everyone else has voted up.
--
-- The problem this answers. A brand-new account — and a returning one whose
-- every `category_preferences` row has decayed under MIN_CATEGORY_WEIGHT — hands
-- the ranker an empty weight map, and the ranking falls back to
-- CATEGORY_BASE_SCORE plus notability plus distance. That fallback is a fixed
-- editorial guess written into a constant table in 2026-07: viewpoint 10,
-- landmark 9, museum 8, and so on down to shopping 4, identical for every walker
-- and never revised by anything anybody did. It is preference-blind by
-- construction. Cold start is exactly where a population signal is worth the
-- most, because it is the only place there is nothing better.
--
-- The data. `attraction_feedback` is the only real behavioural signal this app
-- has, and its category-level rows (`poi_name is null`) are already a per-walker
-- standing summary with a repeat count — the shape `getDownvotedCategories` and
-- `getUpvotedCategories` read. Summed across all walkers that is a usable
-- "which kinds of place do people here actually thumbs-up" ranking, and it costs
-- no new writes, no new table and no external service. There is no trending API
-- to call and no OSM popularity tag worth believing.
--
-- Upvotes only, not net of downvotes. A netted score is a claim about consensus
-- — "people agree this category is good" — and consensus needs a population to
-- be a fact about. What this function claims is much weaker and much safer:
-- somebody liked this kind of place. A category with both heavy upvotes and
-- heavy downvotes is polarizing rather than bad, and subtracting one stranger's
-- dislike from another stranger's liking, then spending the difference on a
-- third walker we know nothing about, is a stronger inference than the data
-- supports. Revisit when there is volume — see TODO.md.
--
-- Global, not per city, and that is a deliberate scope call rather than an
-- oversight. This project has on the order of two real accounts. Splitting two
-- walkers' thumbs-ups by city produces one row per city with a count of one,
-- which is noise with a `group by` around it. The mechanism is not architecturally
-- closed to geography: adding it later means a `city` or geohash column on
-- `attraction_feedback` (the rows carry lat/lng only at POI level today, so
-- category-level rows would need one written at feedback time), an extra grouping
-- key here, and a parameter on this function. Nothing about the return shape or
-- the read path has to change shape to accommodate that.

-- ---------------------------------------------------------------------------
-- The aggregate
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER, which nothing else in this schema is — `record_walk_session()`
-- is deliberately INVOKER because it only ever touches the caller's own profile
-- row, and RLS is what makes that true. This one has to read across all walkers'
-- `attraction_feedback` rows, and those carry own-rows-only RLS for the good
-- reason that they are per-user behavioural data. There is no RLS policy that
-- expresses "you may see the sum but not the rows", so the sum has to be taken
-- somewhere RLS is not in the way, and a function owned by the migration role is
-- the narrowest such place: one fixed query, no parameters, no dynamic SQL.
--
-- The leak-proofing is structural, not a matter of trusting this body to stay
-- careful. `returns table (category public.attraction_category,
-- total_occurrences bigint)` is the whole contract: two columns, one an enum with
-- nine values and the other a sum. There is no column here that could carry a
-- user_id, an osm_id, a poi_name, a coordinate or a timestamp even if a later
-- edit tried to select one — it would not type-check against the return table.
-- The body is a single grouped aggregate with no per-row passthrough, so the
-- finest granularity anything can observe is "one of the nine categories, and a
-- total". A caller cannot ask about another user, because there is no argument
-- to ask with.
--
-- Honest about the current scale: with two accounts on the project, a total of 3
-- is very likely one walker's three taps. What that discloses is "somebody who
-- uses this app has thumbs-upped museums" — no identity, no place, no time, and
-- it is read server-side and folded into a score, never returned to a browser.
-- A minimum-supporters threshold (only report a category N distinct walkers have
-- voted up) is the standard fix and is the right thing to add when there is a
-- population to threshold against; adding it today would make the function
-- return nothing at all, which is a privacy control that works by deleting the
-- feature.
--
-- STABLE, not VOLATILE: it writes nothing, and a stable function can be folded
-- into a plan rather than re-executed per row.
--
-- `set search_path = public, pg_temp` with pg_temp LAST, which is the documented
-- SECURITY DEFINER precaution: the temp schema is searched first by default, so
-- a caller who creates their own `attraction_feedback` temp table would otherwise
-- have this function aggregate it. `record_walk_session()` sets `public` alone
-- and is safe because it is INVOKER; a definer function has to be explicit.
create function public.trending_category_upvotes()
returns table (
  category public.attraction_category,
  total_occurrences bigint
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select f.category, sum(f.occurrence_count)::bigint
  from public.attraction_feedback f
  where f.signal = 'upvote'
    -- Category-level rows only, the same filter `getUpvotedCategories` uses.
    -- POI-level rows carry a category too, so counting both would let one place
    -- the walker liked count twice — once as itself and once inside the standing
    -- category summary that same tap already incremented.
    and f.poi_name is null
    -- `other` is where every unclassified POI lands, so a preference for it
    -- would mean a preference for anything at all. Dropped everywhere else in
    -- this codebase for the same reason.
    and f.category <> 'other'
  group by f.category
  -- Nothing here needs an order: the read path keys these by category and the
  -- ranker scales them against the largest. Sorting would only imply a promise
  -- about ties that the sum cannot keep.
$$;

comment on function public.trending_category_upvotes() is
  'How many category-level upvotes each attraction category has across ALL walkers. The cold-start signal: read only when a walker has no personal signal at all (no stored category preference, no tapped up- or downvote) — see getTrendingCategoryCounts in src/lib/preferences/preference-store.ts. SECURITY DEFINER because attraction_feedback is own-rows-only under RLS and this is a cross-user sum; the return table is (category, total) by design, so no individual row, place or identity can pass through it.';

-- Exactly as `record_walk_session()` does: nothing by default, and only a
-- signed-in caller. `anon` is deliberately left out — a signed-out walker
-- already gets the preference-blind ranking this is meant to improve on, and
-- that is a safe place to stay rather than a reason to expose a population
-- aggregate to the open internet.
revoke execute on function public.trending_category_upvotes() from public;
grant execute on function public.trending_category_upvotes() to authenticated;

-- The sum walks every category-level upvote row in the table. That is nothing at
-- today's volume, and it is a sequential scan the moment it is not. Partial,
-- because the function only ever looks at one signal and one target shape.
create index attraction_feedback_category_upvotes
  on public.attraction_feedback (category)
  where signal = 'upvote' and poi_name is null;
