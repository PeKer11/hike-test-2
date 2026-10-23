-- Social: recommended places on the map (docs/SOCIAL_PLAN_V2.md). Never executed against a real database by the author.
--   * a recommendation now carries the place's public coordinates and name so it can be drawn on a map;
--   * recommended_places_in_bbox returns only places that >= 5 distinct, opted-in, non-internal walkers recommended
--     at least 48 h ago (the same rule as place_recommendation_support), never who they are, and caps the box and the rows
--     so it cannot be used to walk the whole table.

alter table public.place_recommendations
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180),
  add column name text check (char_length(name) between 1 and 120);

create or replace function public.recommended_places_in_bbox(p_south double precision, p_west double precision, p_north double precision, p_east double precision)
returns table (poi_key text, name text, category public.attraction_category, lat double precision, lng double precision, supporters_bucket text, tags public.place_tag[])
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with eligible as (
    select r.poi_key, r.user_id, r.tags, r.category, r.name, r.lat, r.lng
    from public.place_recommendations r
    join public.community_optin o on o.user_id = r.user_id
    where exists (select 1 from public.community_optin me where me.user_id = auth.uid())
      and r.user_id <> auth.uid()
      and p_south is not null and p_west is not null and p_north is not null and p_east is not null
      and p_north > p_south and p_east > p_west
      and p_north - p_south <= 0.5 and p_east - p_west <= 0.5
      and r.lat between p_south and p_north
      and r.lng between p_west and p_east
      and r.name is not null
      and r.created_at < now() - interval '48 hours'
      and o.opted_in_at < now() - interval '48 hours'
      and not exists (select 1 from public.profiles p where p.id = r.user_id and p.is_internal)
      and not exists (select 1 from public.excluded_poi_keys x where x.poi_key = r.poi_key)
  ),
  places as (
    select e.poi_key,
           count(distinct e.user_id) as n,
           mode() within group (order by e.name) as name,
           mode() within group (order by e.category) as category,
           avg(e.lat) as lat,
           avg(e.lng) as lng
    from eligible e
    group by e.poi_key
    having count(distinct e.user_id) >= 5
  ),
  tag_counts as (
    select e.poi_key, t as tag, count(distinct e.user_id) as n
    from eligible e, unnest(e.tags) as t
    group by e.poi_key, t
    having count(distinct e.user_id) >= 5
  )
  select p.poi_key, p.name, p.category, round(p.lat::numeric, 5)::double precision, round(p.lng::numeric, 5)::double precision,
         case when p.n >= 25 then '25+' when p.n >= 10 then '10+' else '5+' end,
         coalesce((select array_agg(tc.tag order by tc.n desc, tc.tag) from tag_counts tc where tc.poi_key = p.poi_key), '{}')
  from places p
  order by p.n desc
  limit 100
$$;

revoke all on function public.recommended_places_in_bbox(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.recommended_places_in_bbox(double precision, double precision, double precision, double precision) to authenticated;
