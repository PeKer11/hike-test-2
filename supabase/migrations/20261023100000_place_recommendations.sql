-- Social R1: "recommend this place" (docs/SOCIAL_PLAN_V2.md §2.1).
-- Dormant until NEXT_PUBLIC_SOCIAL=1. Never executed against a real database by the author of this file.
--
-- A walker's recommendation is a deliberate action, separate from the end-of-walk
-- thumbs. It always shapes the walker's own walks; others see it only as an
-- aggregate: >= 5 distinct opted-in walkers, rows and opt-ins older than 48 h,
-- bucketed (5+/10+/25+), no user id, coordinate or timestamp in the result.

create type public.place_tag as enum
  ('view', 'shade', 'quiet', 'kids', 'coffee', 'food', 'photo', 'accessible', 'sunset');

create table public.place_recommendations (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- OSM place (osm-node-123) or a Google place id (google-<placeId>): both are stable ids, never name@coords.
  poi_key text not null check (poi_key ~ '^(osm-(node|way|relation)-[0-9]{1,15}|google-[A-Za-z0-9_-]{10,200})$'),
  category public.attraction_category not null,
  tags public.place_tag[] not null default '{}' check (cardinality(tags) <= 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, poi_key)
);

-- Server clock only, so a recommendation cannot be backdated past the 48 h delay.
create trigger place_recommendations_force_insert_timestamps
  before insert on public.place_recommendations
  for each row execute function public.force_insert_timestamps();

alter table public.place_recommendations enable row level security;
revoke all on table public.place_recommendations from anon, public;

create policy "Users can read their own recommendations"
  on public.place_recommendations for select to authenticated using (auth.uid() = user_id);
create policy "Users can insert their own recommendations"
  on public.place_recommendations for insert to authenticated with check (auth.uid() = user_id);
create policy "Users can update their own recommendations"
  on public.place_recommendations for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own recommendations"
  on public.place_recommendations for delete to authenticated using (auth.uid() = user_id);

create index place_recommendations_poi on public.place_recommendations (poi_key);

-- Aggregate for others: (poi_key, bucket, tags chosen by >= 5 distinct walkers).
create function public.place_recommendation_support(p_poi_keys text[])
returns table (
  poi_key text,
  supporters_bucket text,
  tags public.place_tag[]
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with eligible as (
    select r.poi_key, r.user_id, r.tags
    from public.place_recommendations r
    join public.community_optin o on o.user_id = r.user_id
    where exists (select 1 from public.community_optin me where me.user_id = auth.uid())
      and r.user_id <> auth.uid()
      and p_poi_keys is not null
      and cardinality(p_poi_keys) between 1 and 50
      and r.poi_key = any (p_poi_keys)
      and r.created_at < now() - interval '48 hours'
      and o.opted_in_at < now() - interval '48 hours'
  ),
  places as (
    select poi_key, count(distinct user_id) as n
    from eligible group by poi_key having count(distinct user_id) >= 5
  ),
  tag_counts as (
    select e.poi_key, t as tag, count(distinct e.user_id) as n
    from eligible e, unnest(e.tags) as t
    group by e.poi_key, t
    having count(distinct e.user_id) >= 5
  )
  select p.poi_key,
         case when p.n >= 25 then '25+' when p.n >= 10 then '10+' else '5+' end,
         coalesce((select array_agg(tc.tag order by tc.n desc, tc.tag) from tag_counts tc where tc.poi_key = p.poi_key), '{}')
  from places p
$$;

comment on function public.place_recommendation_support(text[]) is
  'R1. Bucketed number of opted-in walkers who recommended each place (>= 5 distinct, rows and opt-ins older than 48 h) plus tags chosen by >= 5 of them. Fixed return table. Caller must be opted in.';

revoke execute on function public.place_recommendation_support(text[]) from public, anon;
grant execute on function public.place_recommendation_support(text[]) to authenticated;
