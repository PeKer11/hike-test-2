-- A place shows on the Recommended map from ONE opted-in walker, labelled only "Traike user", with that walker's short public review.
-- Owner decision 2026-10-23, replacing the k >= 5 rule for this function. The review is written for display, so it is a separate, explicit field.
-- Never executed against a real database by the author. Opt-in, 48 h delay, internal-account and excluded-place filters are unchanged.

alter table public.place_recommendations add column if not exists review text check (review is null or char_length(review) <= 280);

drop function if exists public.recommended_places_in_bbox(double precision, double precision, double precision, double precision);

create function public.recommended_places_in_bbox(p_south double precision, p_west double precision, p_north double precision, p_east double precision)
returns table (poi_key text, name text, category public.attraction_category, lat double precision, lng double precision, supporters integer, tags public.place_tag[], reviews text[])
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  with eligible as (
    select r.poi_key, r.user_id, r.tags, r.category, r.name, r.lat, r.lng, r.review, r.updated_at
    from public.place_recommendations r
    join public.community_optin o on o.user_id = r.user_id
    where exists (select 1 from public.community_optin me where me.user_id = auth.uid())
      and p_south is not null and p_west is not null and p_north is not null and p_east is not null
      and p_north > p_south and p_east > p_west
      and p_north - p_south <= 0.5 and p_east - p_west <= 0.5
      and r.lat between p_south and p_north
      and r.lng between p_west and p_east
      and r.name is not null
      and r.poi_key not like 'google-%'
      and r.created_at < now() - interval '48 hours'
      and o.opted_in_at < now() - interval '48 hours'
      and not exists (select 1 from public.profiles p where p.id = r.user_id and p.is_internal)
      and not exists (select 1 from public.excluded_poi_keys x where x.poi_key = r.poi_key)
  )
  select e.poi_key,
         mode() within group (order by e.name),
         mode() within group (order by e.category),
         round(avg(e.lat)::numeric, 5)::double precision,
         round(avg(e.lng)::numeric, 5)::double precision,
         count(distinct e.user_id)::integer,
         coalesce((select array_agg(t order by t) from (select distinct unnest(e2.tags) as t from eligible e2 where e2.poi_key = e.poi_key) x), '{}'),
         coalesce((select array_agg(s.review) from (select e3.review from eligible e3 where e3.poi_key = e.poi_key and e3.review is not null order by e3.updated_at desc limit 3) s), '{}')
  from eligible e
  group by e.poi_key
  order by count(distinct e.user_id) desc
  limit 100
$$;

revoke all on function public.recommended_places_in_bbox(double precision, double precision, double precision, double precision) from public, anon;
grant execute on function public.recommended_places_in_bbox(double precision, double precision, double precision, double precision) to authenticated;
