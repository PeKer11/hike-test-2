-- Social layer S1 + S2 (docs/PERSONALIZATION_SOCIAL_PLAN.md §4.3, §4.4, §4.6).
-- Everything here is dormant until the app is built with NEXT_PUBLIC_SOCIAL=1
-- and a walker has opted in; with the flag off nothing calls these functions.
--
-- Never executed against a real database by the author of this file.
--
-- Guarantees, enforced HERE and not only in the app:
--   * contributes nothing unless the walker opted in (`community_optin`), and
--     an opted-out walker's rows stop counting immediately (the opt-in row is
--     the join condition, not a refreshed copy);
--   * k-anonymity: a place is reported only when >= 5 DISTINCT opted-in
--     walkers upvoted it (S2: >= 3 distinct neighbours, and >= 5 neighbours);
--   * a 48 hour delay on both the vote and the opt-in, so a single new vote or
--     a single new opt-in cannot be differenced out of a count;
--   * counts are rounded to buckets ('5+', '10+', '25+'); S2 returns no count;
--   * the return tables are fixed: (poi_key, bucket) and (poi_key, categories).
--     No user id, no coordinate, no name, no timestamp can pass through;
--   * only public OSM-mapped places (osm_id is not null), never name@coords
--     rows that could name a private place; category 'other' is dropped;
--   * the caller must be signed in AND opted in (one toggle = take part and
--     see), at most 50 keys per call, and only keys the caller already holds
--     are answered: this is a lookup, never a way to list places. The key
--     restriction is enforced by the API route only, NOT by the database; a
--     caller using the RPC directly can probe any OSM key. TODO: DB-side rate
--     limit. The caller's own vote is excluded from the k >= 5 count.
-- The TypeScript twin of the constants is src/lib/social/aggregates.ts; a test
-- fails if the two drift apart.

create table public.community_optin (
  user_id uuid primary key references auth.users (id) on delete cascade,
  opted_in_at timestamptz not null default now()
);

-- The 48 h delay is only a guarantee if the clock is the server's. Whatever a
-- client sends for opted_in_at (or for a vote's created_at / updated_at on
-- insert) is replaced with now(), so neither can be backdated past the delay.
-- (Updates already stamp updated_at via set_updated_at(); community_optin has
-- no update policy at all.)
create function public.force_insert_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'community_optin' then
    new.opted_in_at = now();
  else
    new.created_at = now();
    new.updated_at = now();
  end if;
  return new;
end;
$$;

revoke execute on function public.force_insert_timestamps() from public, anon;

create trigger community_optin_force_timestamps
  before insert on public.community_optin
  for each row execute function public.force_insert_timestamps();

create trigger attraction_feedback_force_insert_timestamps
  before insert on public.attraction_feedback
  for each row execute function public.force_insert_timestamps();

alter table public.community_optin enable row level security;
revoke all on table public.community_optin from anon, public;

create policy "Users can read their own community opt-in"
  on public.community_optin for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own community opt-in"
  on public.community_optin for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can delete their own community opt-in"
  on public.community_optin for delete to authenticated
  using (auth.uid() = user_id);

-- Lookup by poi_key across all walkers' upvotes.
create index attraction_feedback_poi_upvotes
  on public.attraction_feedback (poi_key)
  where signal = 'upvote' and osm_id is not null;

-- ---------------------------------------------------------------------------
-- S1: how many walkers like this place (bucketed)
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER for the same reason as trending_category_upvotes(): the
-- source rows are own-rows-only under RLS and no policy can express "the sum,
-- not the rows". search_path is pinned with pg_temp last.
create function public.community_place_support(p_poi_keys text[])
returns table (
  poi_key text,
  supporters_bucket text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select s.poi_key,
         case when s.n >= 25 then '25+'
              when s.n >= 10 then '10+'
              else '5+' end
  from (
    select f.poi_key, count(distinct f.user_id) as n
    from public.attraction_feedback f
    join public.community_optin o on o.user_id = f.user_id
    where exists (select 1 from public.community_optin me where me.user_id = auth.uid())
      and f.user_id <> auth.uid()
      and p_poi_keys is not null
      and cardinality(p_poi_keys) between 1 and 50
      and f.poi_key = any (p_poi_keys)
      and f.signal = 'upvote'
      and f.osm_id is not null and f.osm_id <> ''
      and f.category <> 'other'
      and f.updated_at < now() - interval '48 hours'
      and o.opted_in_at < now() - interval '48 hours'
    group by f.poi_key
    having count(distinct f.user_id) >= 5
  ) s
$$;

comment on function public.community_place_support(text[]) is
  'S1. For the given OSM place keys, a bucketed supporter count (5+/10+/25+) among opted-in walkers, only where >= 5 distinct walkers upvoted it, votes and opt-ins older than 48 h. Returns (poi_key, bucket) only. Caller must be opted in. SECURITY DEFINER; fixed return table, no user id, coordinate or timestamp can pass through.';

revoke execute on function public.community_place_support(text[]) from public, anon;
grant execute on function public.community_place_support(text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- S2: walkers with a similar taste liked this
-- ---------------------------------------------------------------------------
-- Taste vector = category_preferences, sentiment-signed, occurrence_count
-- capped at 5 (the app's decay is NOT applied here: a coarser similarity than
-- the ranker's, deliberately). Computed inside the function and never returned.
-- Neighbours: opted-in (48 h old) walkers with cosine >= 0.6, top 20. Fewer
-- than 5 neighbours => nothing. A place needs >= 3 distinct neighbours'
-- upvotes. The explanation categories are the caller's own top (up to) two
-- liked categories that >= 3 neighbours also like: no count, no identity.
create function public.similar_walkers_places(p_poi_keys text[])
returns table (
  poi_key text,
  reason_categories text[]
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with
  guard as (
    select 1 as ok
    where auth.uid() is not null
      and exists (select 1 from public.community_optin m where m.user_id = auth.uid())
      and p_poi_keys is not null
      and cardinality(p_poi_keys) between 1 and 50
  ),
  me as (
    select c.category,
           (case when c.sentiment = 'like' then 1.0 else -1.0 end)
             * least(c.occurrence_count, 5) as w
    from public.category_preferences c, guard
    where c.user_id = auth.uid() and c.category <> 'other'
  ),
  me_norm as (
    select sqrt(sum(w * w)) as n from me
  ),
  theirs as (
    select c.user_id, c.category,
           (case when c.sentiment = 'like' then 1.0 else -1.0 end)
             * least(c.occurrence_count, 5) as w
    from public.category_preferences c
    join public.community_optin o on o.user_id = c.user_id
    where c.user_id <> auth.uid()
      and c.category <> 'other'
      and o.opted_in_at < now() - interval '48 hours'
  ),
  scored as (
    select t.user_id,
           sum(t.w * coalesce(me.w, 0))
             / (sqrt(sum(t.w * t.w)) * (select n from me_norm)) as cosine
    from theirs t
    left join me on me.category = t.category
    group by t.user_id
    having (select n from me_norm) > 0
  ),
  neighbours as (
    select user_id from scored
    where cosine >= 0.6
    order by cosine desc, user_id
    limit 20
  ),
  enough as (
    select 1 as ok from neighbours having count(*) >= 5
  ),
  shared as (
    select me.category
    from me
    join public.category_preferences c
      on c.category = me.category
     and c.sentiment = 'like'
     and c.user_id in (select user_id from neighbours)
    where me.w > 0
    group by me.category, me.w
    having count(distinct c.user_id) >= 3
    order by count(distinct c.user_id) desc, me.w desc, me.category
    limit 2
  ),
  reasons as (
    select array_agg(category::text order by category::text) as cats from shared
  )
  select f.poi_key, r.cats
  from public.attraction_feedback f
  join neighbours n on n.user_id = f.user_id
  cross join reasons r
  where exists (select 1 from enough)
    and r.cats is not null
    and f.poi_key = any (p_poi_keys)
    and f.signal = 'upvote'
    and f.osm_id is not null and f.osm_id <> ''
    and f.category <> 'other'
    and f.updated_at < now() - interval '48 hours'
    and not exists (
      select 1 from public.attraction_feedback mine
      where mine.user_id = auth.uid()
        and mine.poi_key = f.poi_key
        and mine.signal = 'downvote'
    )
  group by f.poi_key, r.cats
  having count(distinct f.user_id) >= 3
$$;

comment on function public.similar_walkers_places(text[]) is
  'S2. For the given OSM place keys, those upvoted by >= 3 distinct similar-taste opted-in walkers (cosine >= 0.6 on category_preferences, >= 5 neighbours, 48 h delays), with the caller''s own shared liked categories as the reason. Returns (poi_key, categories) only: no counts, no identities. Caller must be opted in. SECURITY DEFINER.';

revoke execute on function public.similar_walkers_places(text[]) from public, anon;
grant execute on function public.similar_walkers_places(text[]) to authenticated;
