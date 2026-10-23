-- Social G0 (docs/SOCIAL_PLAN_V2.md §0 gaps 1 and 3). Never executed against a real database by the author.
--   * internal / test accounts never count towards any aggregate (two test accounts + three friends must not reach k = 5);
--   * places that must never be reported (military sites, deny zones) are listed in excluded_poi_keys and joined out.
-- NOT done here: a database-side limit on probing arbitrary keys through the RPC (the API route still enforces
-- "only keys you already hold"); tracked in TODO.md.

alter table public.profiles add column is_internal boolean not null default false;

create table public.excluded_poi_keys (
  poi_key text primary key,
  reason text not null default 'deny_zone'
);
alter table public.excluded_poi_keys enable row level security;
revoke all on table public.excluded_poi_keys from anon, authenticated, public;
-- no policies: only the service role (a server job using safety-zones.ts) writes it; the functions below read it as definer.

create or replace function public.community_place_support(p_poi_keys text[])
returns table (poi_key text, supporters_bucket text)
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
      and not exists (select 1 from public.profiles p where p.id = f.user_id and p.is_internal)
      and not exists (select 1 from public.excluded_poi_keys x where x.poi_key = f.poi_key)
    group by f.poi_key
    having count(distinct f.user_id) >= 5
  ) s
$$;

create or replace function public.place_recommendation_support(p_poi_keys text[])
returns table (poi_key text, supporters_bucket text, tags public.place_tag[])
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
      and not exists (select 1 from public.profiles p where p.id = r.user_id and p.is_internal)
      and not exists (select 1 from public.excluded_poi_keys x where x.poi_key = r.poi_key)
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
