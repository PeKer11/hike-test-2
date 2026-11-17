-- Round 2 social, migration D of A-E: nearby walkers (STRANGERS). GATED.
-- NOT applied: Ariel pastes this into the Supabase SQL editor himself, and NOT before ALL of these are true:
--   1. a lawyer has reviewed the consent copy and the privacy notice (src/app/privacy/page.tsx is a draft),
--   2. a DPIA is done (location, strangers; Israel PPL Amendment 13 and GDPR Art. 35),
--   3. Ariel gives his explicit OK.
-- Not having this migration in the database is the gate: before it is pasted no stranger can be listed or contacted,
-- whatever the client or the flags do. The app flags NEXT_PUBLIC_SOCIAL_NEARBY and SOCIAL_NEARBY stay OFF until then.
--
-- PASTE ORDER: A 20261118100000, B 20261119100000, C 20261119110000 first. Then this file (D), then set the flags.
-- Safe to paste twice (idempotent).
--
-- Privacy rules: both people must have chosen audience 'public' and have a live presence row (a ~1 km cell, expires in
-- 20 minutes). Only people within 2 cells (about 2 km) of each other are visible to each other. A stranger sees a name and
-- an avatar, a rough "here / near" bucket and a time bucket, never a position, and an opaque token that changes every walk.

-- One place for the request checks and the insert. Not callable by clients.
create or replace function public._insert_walk_request(
  p_from uuid, p_to uuid, p_meet_kind text, p_meet_ref text, p_meet_name text,
  p_meet_lat numeric, p_meet_lng numeric, p_meet_in_min int)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  a public.social_profiles%rowtype;
  b public.social_profiles%rowtype;
  rid uuid;
begin
  if p_from is null or p_to is null or p_to = p_from then return null; end if;
  if p_meet_in_min is null or p_meet_in_min not in (0, 10, 15, 30, 45, 60) then return null; end if;
  select * into a from public.social_profiles where user_id = p_from;
  if not found or a.suspended_at is not null or a.presence_audience = 'off' then return null; end if;
  select * into b from public.social_profiles where user_id = p_to;
  if not found or b.suspended_at is not null or b.presence_audience = 'off' then return null; end if;
  if public.is_blocked(p_from, p_to) then return null; end if;
  if (select count(*) from public.walk_requests where from_user = p_from and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.walk_requests where from_user = p_from and created_at > now() - interval '1 day') >= 20 then
    return null;
  end if;
  if exists (select 1 from public.walk_requests r
              where r.status in ('pending', 'accepted') and r.expires_at > now()
                and ((r.from_user = p_from and r.to_user = p_to) or (r.from_user = p_to and r.to_user = p_from))) then
    return null;
  end if;
  if (select count(*) from public.walk_requests where to_user = p_to and status = 'pending' and expires_at > now()) >= 10 then
    return null;
  end if;
  delete from public.walk_requests where created_at < now() - interval '7 days';
  insert into public.walk_requests (from_user, to_user, meet_kind, meet_ref, meet_name, meet_lat, meet_lng, meet_at, expires_at)
  values (p_from, p_to, p_meet_kind, p_meet_ref,
          case when p_meet_kind = 'osm' then left(btrim(p_meet_name), 80) end,
          case when p_meet_kind = 'osm' then p_meet_lat end,
          case when p_meet_kind = 'osm' then p_meet_lng end,
          date_trunc('minute', now()) + make_interval(mins => p_meet_in_min),
          now() + make_interval(mins => p_meet_in_min + 30))
  returning id into rid;
  return rid;
exception when check_violation or not_null_violation then return null;
end; $$;

-- Friends only (unchanged behaviour), now through the shared helper.
create or replace function public.send_walk_request(
  p_to_user uuid, p_meet_kind text, p_meet_ref text, p_meet_name text,
  p_meet_lat numeric, p_meet_lng numeric, p_meet_in_min int)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null or not public.are_friends(auth.uid(), p_to_user) then return null; end if;
  return public._insert_walk_request(auth.uid(), p_to_user, p_meet_kind, p_meet_ref, p_meet_name, p_meet_lat, p_meet_lng, p_meet_in_min);
end; $$;

-- A stranger, by presence token: only when both are public, live, and within 2 cells of each other.
create or replace function public.send_walk_request_nearby(
  p_token uuid, p_meet_kind text, p_meet_ref text, p_meet_name text,
  p_meet_lat numeric, p_meet_lng numeric, p_meet_in_min int)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); me public.walk_presence%rowtype; target uuid;
begin
  if uid is null or p_token is null then return null; end if;
  select * into me from public.walk_presence where user_id = uid and audience = 'public' and expires_at > now();
  if not found then return null; end if;
  select p.user_id into target from public.walk_presence p
   where p.token = p_token and p.audience = 'public' and p.expires_at > now() and p.user_id <> uid
     and abs(p.cell_y - me.cell_y) <= 2 and abs(p.cell_x - me.cell_x) <= 2;
  if target is null then return null; end if;
  return public._insert_walk_request(uid, target, p_meet_kind, p_meet_ref, p_meet_name, p_meet_lat, p_meet_lng, p_meet_in_min);
end; $$;

-- walking_now v2: the friends branch of B, plus a nearby branch (strangers).
create or replace function public.walking_now()
returns table (token uuid, friend_id uuid, display_name text, avatar text, relation text, area_label text,
               since_bucket text, distance_bucket text, profile_visible boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (
    select sp.presence_audience as audience, wp.cell_y, wp.cell_x, wp.expires_at
      from public.social_profiles sp
      left join public.walk_presence wp on wp.user_id = sp.user_id
     where sp.user_id = auth.uid() and sp.suspended_at is null and sp.presence_audience <> 'off'
  ),
  friends as (
    select p.token, p.user_id as friend_id, sp.display_name, sp.avatar, 'friend'::text as relation, p.area_label,
           case when now() - p.since < interval '15 minutes' then 'just_started'
                when now() - p.since < interval '45 minutes' then 'about_30'
                else 'over_45' end as since_bucket,
           (select case when m.cell_y is null or m.expires_at <= now() then null
                        when greatest(abs(p.cell_y - m.cell_y), abs(p.cell_x - m.cell_x)) = 0 then 'here'
                        when greatest(abs(p.cell_y - m.cell_y), abs(p.cell_x - m.cell_x)) <= 2 then 'near'
                        else 'far' end
              from me m) as distance_bucket,
           public.can_view_profile(p.user_id) as profile_visible,
           p.updated_at
      from public.walk_presence p
      join public.social_profiles sp on sp.user_id = p.user_id and sp.suspended_at is null
     where exists (select 1 from me)
       and p.expires_at > now() and p.user_id <> auth.uid()
       and public.are_friends(auth.uid(), p.user_id)
     order by p.updated_at desc
     limit 30
  ),
  nearby as (
    select p.token, null::uuid as friend_id, sp.display_name, sp.avatar, 'nearby'::text as relation, p.area_label,
           case when now() - p.since < interval '15 minutes' then 'just_started'
                when now() - p.since < interval '45 minutes' then 'about_30'
                else 'over_45' end as since_bucket,
           case when greatest(abs(p.cell_y - m.cell_y), abs(p.cell_x - m.cell_x)) = 0 then 'here' else 'near' end as distance_bucket,
           public.can_view_profile(p.user_id) as profile_visible,
           p.updated_at
      from me m
      join public.walk_presence p on p.audience = 'public' and p.expires_at > now() and p.user_id <> auth.uid()
                                 and abs(p.cell_y - m.cell_y) <= 2 and abs(p.cell_x - m.cell_x) <= 2
      join public.social_profiles sp on sp.user_id = p.user_id and sp.suspended_at is null
     where m.audience = 'public' and m.cell_y is not null and m.expires_at > now()
       and not public.are_friends(auth.uid(), p.user_id)
       and not public.is_blocked(auth.uid(), p.user_id)
     order by p.updated_at desc
     limit 20
  )
  select f.token, f.friend_id, f.display_name, f.avatar, f.relation, f.area_label, f.since_bucket, f.distance_bucket, f.profile_visible from friends f
  union all
  select n.token, n.friend_id, n.display_name, n.avatar, n.relation, n.area_label, n.since_bucket, n.distance_bucket, n.profile_visible from nearby n;
$$;

-- The card of a nearby walker, by token. Only for a public profile (can_view_profile) and only while both are public and close.
create or replace function public.social_profile_card_by_token(p_token uuid)
returns table (user_id uuid, display_name text, avatar text, visibility text, relation text, member_since date,
               walk_count int, km_total int, top_areas text[], top_categories text[], taste_tags text[], friend_state text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.user_id, c.display_name, c.avatar, c.visibility, c.relation, c.member_since, c.walk_count, c.km_total,
         c.top_areas, c.top_categories, c.taste_tags, c.friend_state
    from public.walk_presence p
    join public.walk_presence me on me.user_id = auth.uid() and me.audience = 'public' and me.expires_at > now()
    cross join lateral public.social_profile_card(p.user_id) c
   where p.token = p_token and p.audience = 'public' and p.expires_at > now() and p.user_id <> auth.uid()
     and abs(p.cell_y - me.cell_y) <= 2 and abs(p.cell_x - me.cell_x) <= 2
     and not public.is_blocked(auth.uid(), p.user_id);
$$;

revoke all on function public._insert_walk_request(uuid, uuid, text, text, text, numeric, numeric, int) from anon, public, authenticated;
revoke all on function public.send_walk_request(uuid, text, text, text, numeric, numeric, int) from anon, public;
revoke all on function public.send_walk_request_nearby(uuid, text, text, text, numeric, numeric, int) from anon, public;
revoke all on function public.walking_now() from anon, public;
revoke all on function public.social_profile_card_by_token(uuid) from anon, public;
grant execute on function public.send_walk_request(uuid, text, text, text, numeric, numeric, int) to authenticated;
grant execute on function public.send_walk_request_nearby(uuid, text, text, text, numeric, numeric, int) to authenticated;
grant execute on function public.walking_now() to authenticated;
grant execute on function public.social_profile_card_by_token(uuid) to authenticated;
