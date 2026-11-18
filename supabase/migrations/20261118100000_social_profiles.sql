-- Round 2 social, migration A of A-E: profiles, visibility, blocks, reports, safer friend reads.
-- NOT applied: Ariel pastes this into the Supabase SQL editor himself.
--
-- PASTE ORDER (all of them, only in this order, each only when its code is live and its flag decision is made):
--   A  20261118100000_social_profiles.sql    <- this file. Paste ONLY AFTER the phase 4 code is deployed:
--                                               friends_walks() stops carrying Google positions, and the P4 code resolves them.
--   B  20261119100000_walk_presence.sql      (needs A)
--   C  20261119110000_walk_requests.sql      (needs A and B)
--   D  20261125100000_nearby_walkers.sql     (needs A-C; ONLY after counsel + DPIA + Ariel's OK)
--   E  20261126100000_taste_summaries.sql    (needs A; optional)
-- Needs 20261024100000 + 20261024110000 (already in production). Safe to paste twice (idempotent).
--
-- Rules for every function here: security definer, search_path pinned, no dynamic SQL, fixed return shape,
-- revoke from anon/public (this project's default ACL grants EXECUTE to anon on create), grant to authenticated only
-- for client-callable ones. Internal helpers (is_blocked, can_view_profile, public_stops) are not callable by clients.

alter table public.profiles add column if not exists is_internal boolean not null default false;
alter table public.saved_walks add column if not exists hidden_from_profile boolean not null default false;

create table if not exists public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (
    char_length(btrim(display_name)) between 2 and 30
    and display_name !~ '[@<>/\\]'        -- no emails, markup, urls
    and display_name !~ '[0-9]{5,}'       -- no phone numbers
    and display_name !~ '[­​-‏‪-‮⁠-⁩﻿]'),   -- no invisible / bidi characters
  avatar text not null default 'backpack' check (avatar in
    ('backpack','bench','binoculars','boot','bottle','camera','footprints','hat','signpost','stick','tent','thermos')),
  visibility text not null default 'private' check (visibility in ('private','friends','public')),
  show_history boolean not null default true,
  show_taste boolean not null default false,
  presence_audience text not null default 'off' check (presence_audience in ('off','friends','public')),
  adult_attested_at timestamptz not null default now(),
  public_consent_at timestamptz,
  presence_consent_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_profiles enable row level security;
revoke all on table public.social_profiles from anon, public;
revoke insert, update on table public.social_profiles from authenticated;   -- writes only through save_social_profile()
drop policy if exists "Read own social profile" on public.social_profiles;
create policy "Read own social profile" on public.social_profiles for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Delete own social profile" on public.social_profiles;
create policy "Delete own social profile" on public.social_profiles for delete to authenticated using (auth.uid() = user_id);

-- Suspension tombstone: survives deleting the profile row, so "delete + re-create" cannot undo a suspension.
-- Service role only. The owner restores a person by deleting their row here (and clearing suspended_at on the profile).
create table if not exists public.social_suspensions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  suspended_at timestamptz not null default now()
);
alter table public.social_suspensions enable row level security;
revoke all on table public.social_suspensions from anon, authenticated, public;

create table if not exists public.user_blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from anon, public;
revoke insert, update on table public.user_blocks from authenticated;      -- block only through block_user()
drop policy if exists "See whom I blocked" on public.user_blocks;
create policy "See whom I blocked" on public.user_blocks for select to authenticated using (auth.uid() = blocker);
drop policy if exists "Unblock" on public.user_blocks;
create policy "Unblock" on public.user_blocks for delete to authenticated using (auth.uid() = blocker);
-- The blocked person can never read a block row: blocking is silent.

create table if not exists public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references auth.users (id) on delete set null,
  target uuid references auth.users (id) on delete set null,
  context text not null check (context in ('profile','presence','walk_request','walk','name')),
  reason text not null check (reason in ('harassment','spam','fake','unsafe','minor','other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','reviewed','actioned')),
  created_at timestamptz not null default now()
);
alter table public.abuse_reports enable row level security;
revoke all on table public.abuse_reports from anon, authenticated, public;  -- service role only; the owner reviews in the dashboard

-- Helpers (internal: not granted to authenticated)
create or replace function public.is_blocked(p_a uuid, p_b uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_blocks b
                 where (b.blocker = p_a and b.blocked = p_b) or (b.blocker = p_b and b.blocked = p_a));
$$;

-- are_friends v2: block-aware, and only about the caller's own relationships (was: any two ids).
-- Keeps its original parameter names (a, b) so CREATE OR REPLACE works.
create or replace function public.are_friends(a uuid, b uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() in (a, b)
     and not public.is_blocked(a, b)
     and exists (select 1 from public.friendships f
                 where f.status = 'accepted'
                   and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a)));
$$;

create or replace function public.can_view_profile(p_target uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    auth.uid() = p_target
    or exists (
      select 1 from public.social_profiles p
      join public.social_profiles me on me.user_id = auth.uid() and me.suspended_at is null   -- viewers need a profile (18+)
      where p.user_id = p_target and p.suspended_at is null
        and not public.is_blocked(auth.uid(), p_target)
        and (p.visibility = 'public' or (p.visibility = 'friends' and public.are_friends(auth.uid(), p_target)))));
$$;

-- What a stop list may show to someone else. Drops stops within 300 m of the walk start (home protection).
-- Google stops: category + place_id only. p_strict (non-friends): only stops with source 'osm' keep name/position.
create or replace function public.public_stops(p_stops jsonb, p_lat numeric, p_lng numeric, p_strict boolean)
returns jsonb language sql immutable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(
    case
      when coalesce(s->>'placeId', '') <> '' then jsonb_build_object('category', s->>'category', 'placeId', s->>'placeId')
      when p_strict and coalesce(s->>'source', '') <> 'osm' then jsonb_build_object('category', s->>'category')
      else jsonb_build_object('name', left(s->>'name', 80), 'category', s->>'category',
                              'lat', round((s->>'lat')::numeric, 5), 'lng', round((s->>'lng')::numeric, 5))
    end order by e.ord), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_stops) = 'array' then p_stops else '[]'::jsonb end)
       with ordinality as e(s, ord)
  where jsonb_typeof(s) = 'object'
    and (s->>'lat') ~ '^-?[0-9]{1,3}(\.[0-9]+)?$' and (s->>'lng') ~ '^-?[0-9]{1,3}(\.[0-9]+)?$'
    and sqrt(power(((s->>'lat')::float8 - p_lat::float8) * 111320, 2)
           + power(((s->>'lng')::float8 - p_lng::float8) * 111320 * cos(radians(p_lat::float8)), 2)) > 300;
$$;

-- Writes
create or replace function public.save_social_profile(
  p_display_name text, p_avatar text, p_visibility text, p_show_history boolean,
  p_show_taste boolean, p_presence_audience text, p_adult boolean)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  cur public.social_profiles%rowtype;
  aud text := case when p_presence_audience = 'public' then 'friends' else coalesce(p_presence_audience, 'off') end;  -- 'public' presence stays closed until migration D
begin
  if uid is null then return 'signin'; end if;
  select * into cur from public.social_profiles where user_id = uid;
  if found and cur.suspended_at is not null then return 'suspended'; end if;
  if not found and exists (select 1 from public.social_suspensions where user_id = uid) then return 'suspended'; end if;
  if not found and p_adult is not true then return 'adult_required'; end if;
  if found and cur.updated_at > now() - interval '3 seconds' then return 'rate_limited'; end if;
  if clean ~ '[­​-‏‪-‮⁠-⁩﻿]' then return 'invalid'; end if;
  if lower(clean) ~ '(traike|admin|support|official|moderator|staff|תמיכה|מנהל|צוות|טרייק)' then return 'name_reserved'; end if;
  begin
    insert into public.social_profiles as s (user_id, display_name, avatar, visibility, show_history, show_taste,
                                             presence_audience, public_consent_at, presence_consent_at)
    values (uid, clean, coalesce(p_avatar, 'backpack'), coalesce(p_visibility, 'private'), coalesce(p_show_history, true),
            coalesce(p_show_taste, false), aud,
            case when p_visibility = 'public' then now() end,
            case when aud = 'friends' then now() end)
    on conflict (user_id) do update set
      display_name = excluded.display_name, avatar = excluded.avatar, visibility = excluded.visibility,
      show_history = excluded.show_history, show_taste = excluded.show_taste, presence_audience = excluded.presence_audience,
      public_consent_at = coalesce(s.public_consent_at, excluded.public_consent_at),
      presence_consent_at = coalesce(s.presence_consent_at, excluded.presence_consent_at),
      updated_at = now();
  exception when check_violation then return 'invalid';
  end;
  return 'ok';
end; $$;

create or replace function public.block_user(p_target uuid) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_target is null or p_target = uid then return false; end if;
  if (select count(*) from public.user_blocks where blocker = uid and created_at > now() - interval '1 day') >= 50 then return false; end if;
  insert into public.user_blocks (blocker, blocked) values (uid, p_target) on conflict do nothing;
  delete from public.friendships
   where (requester_id = uid and addressee_id = p_target) or (requester_id = p_target and addressee_id = uid);
  return true;
exception when foreign_key_violation then return false;
end; $$;

-- 3 distinct reporters (profiles older than a day) within 7 days -> the target's social visibility is suspended until reviewed.
create or replace function public.report_user(p_target uuid, p_context text, p_reason text, p_note text) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null or p_target is null or p_target = uid then return false; end if;
  if (select count(*) from public.abuse_reports where reporter = uid and created_at > now() - interval '1 day') >= 10 then return false; end if;
  insert into public.abuse_reports (reporter, target, context, reason, note)
    values (uid, p_target, p_context, p_reason, nullif(left(btrim(coalesce(p_note, '')), 500), ''));
  select count(distinct r.reporter) into n
    from public.abuse_reports r
    join public.social_profiles sp on sp.user_id = r.reporter and sp.created_at < now() - interval '1 day'
   where r.target = p_target and r.created_at > now() - interval '7 days'
     and r.status = 'open'                                                          -- reports the owner already reviewed do not count
     and not exists (select 1 from public.user_blocks b where b.blocker = p_target and b.blocked = r.reporter);  -- nor do people the target blocked
  if n >= 3 then
    insert into public.social_suspensions (user_id) values (p_target) on conflict do nothing;
    update public.social_profiles set suspended_at = now(), visibility = 'private', presence_audience = 'off'
     where user_id = p_target and suspended_at is null;
  end if;
  return true;
exception when check_violation or foreign_key_violation then return false;
end; $$;

-- request_friend v2: the v1 body (20261024110000) plus a block check before any write. The same `false` hides the reason.
create or replace function public.request_friend(code text) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  target uuid;
  clean text := upper(btrim(coalesce(code, '')));
begin
  if uid is null or char_length(clean) < 6 or char_length(clean) > 12 then return false; end if;
  if (select count(*) from public.friendships where requester_id = uid and created_at > now() - interval '1 hour') >= 10
     or (select count(*) from public.friendships where requester_id = uid and status = 'pending') >= 100 then
    return false;
  end if;
  select id into target from public.profiles where friend_code = clean;
  if target is null or target = uid then return false; end if;
  if public.is_blocked(uid, target) then return false; end if;
  update public.friendships set status = 'accepted'
    where requester_id = target and addressee_id = uid and status = 'pending';
  if found then return true; end if;
  insert into public.friendships (requester_id, addressee_id) values (uid, target)
    on conflict (requester_id, addressee_id) do nothing;
  return true;
end; $$;

-- Add a friend from a public profile (no code needed). Same limits as request_friend; only public profiles.
create or replace function public.request_friend_by_id(p_target uuid) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_target is null or p_target = uid then return false; end if;
  if (select count(*) from public.friendships where requester_id = uid and created_at > now() - interval '1 hour') >= 10
     or (select count(*) from public.friendships where requester_id = uid and status = 'pending') >= 100 then
    return false;
  end if;
  if public.is_blocked(uid, p_target) or not public.can_view_profile(p_target) then return false; end if;
  update public.friendships set status = 'accepted'
    where requester_id = p_target and addressee_id = uid and status = 'pending';
  if found then return true; end if;
  insert into public.friendships (requester_id, addressee_id) values (uid, p_target)
    on conflict (requester_id, addressee_id) do nothing;
  return true;
exception when foreign_key_violation then return false;
end; $$;

-- The card others (or I) may see. Zero rows unless can_view_profile(p_target).
create or replace function public.social_profile_card(p_target uuid)
returns table (display_name text, avatar text, visibility text, relation text, member_since date,
               walk_count int, km_total int, top_areas text[], top_categories text[], taste_tags text[], friend_state text)
language sql stable security definer set search_path = public, pg_temp as $$
  select sp.display_name, sp.avatar, sp.visibility,
    case when sp.user_id = auth.uid() then 'me'
         when public.are_friends(auth.uid(), sp.user_id) then 'friend' else 'other' end,
    date_trunc('month', sp.created_at)::date,
    (select count(*)::int from public.saved_walks w
      where w.user_id = sp.user_id and w.status = 'completed' and not w.hidden_from_profile),
    (select (coalesce(sum(w.distance_m), 0) / 1000)::int from public.saved_walks w
      where w.user_id = sp.user_id and w.status = 'completed' and not w.hidden_from_profile),
    case when sp.user_id = auth.uid() or sp.show_history then
      array(select w.area_label from public.saved_walks w
             where w.user_id = sp.user_id and w.status = 'completed' and not w.hidden_from_profile and w.area_label is not null
             group by w.area_label order by count(*) desc, w.area_label limit 3)
    else '{}'::text[] end,
    case when sp.user_id = auth.uid() or sp.show_history then
      array(select c.cat from (
              select st->>'category' as cat
                from public.saved_walks w, jsonb_array_elements(w.stops) as st
               where w.user_id = sp.user_id and w.status = 'completed' and not w.hidden_from_profile
                 and jsonb_typeof(st) = 'object'
                 and st->>'category' in ('landmark','museum','park','food','viewpoint','religious','shopping','entertainment','nature')
            ) c group by c.cat order by count(*) desc, c.cat limit 3)
    else '{}'::text[] end,
    '{}'::text[],   -- taste tags: filled by migration E
    case when sp.user_id = auth.uid() then 'me'
         when public.are_friends(auth.uid(), sp.user_id) then 'friends'
         when exists (select 1 from public.friendships f where f.requester_id = auth.uid() and f.addressee_id = sp.user_id and f.status = 'pending') then 'pending_out'
         when exists (select 1 from public.friendships f where f.requester_id = sp.user_id and f.addressee_id = auth.uid() and f.status = 'pending') then 'pending_in'
         else 'none' end
  from public.social_profiles sp
  where sp.user_id = p_target and public.can_view_profile(p_target);
$$;

-- Completed, not-hidden walks of someone I may see. No title (it can start with a Google stop name), no start,
-- no route line, no time of day. The owner's own call returns the public view ("how others see me").
create or replace function public.social_profile_walks(p_target uuid, p_before timestamptz default null, p_limit int default 20)
returns table (id uuid, area_label text, walked_on date, total_min int, distance_m int, stops jsonb)
language sql stable security definer set search_path = public, pg_temp as $$
  select w.id, w.area_label, coalesce(w.completed_at, w.created_at)::date, w.total_min::int, w.distance_m,
         public.public_stops(w.stops, w.start_lat, w.start_lng, not public.are_friends(auth.uid(), p_target))
    from public.saved_walks w
    join public.social_profiles sp on sp.user_id = w.user_id
   where w.user_id = p_target and w.status = 'completed' and not w.hidden_from_profile
     and (p_target = auth.uid() or (w.visibility = 'friends' and sp.show_history and public.can_view_profile(p_target)))   -- others never see walks marked private
     and (p_before is null or coalesce(w.completed_at, w.created_at) < p_before)
   order by coalesce(w.completed_at, w.created_at) desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- list_friends v2: adds display_name + avatar (only for accepted friends or when I am the addressee), drops blocked pairs.
drop function if exists public.list_friends();
create function public.list_friends()
  returns table (friendship_id uuid, friend_id uuid, label text, status text, incoming boolean, display_name text, avatar text)
  language sql stable security definer set search_path = public, pg_temp as $$
  select f.id, o.oid,
         coalesce(case when f.status = 'accepted' or f.addressee_id = auth.uid() then sp.display_name end,
                  'Friend ' || coalesce(right(pr.friend_code, 4), '----')),
         f.status,
         (f.addressee_id = auth.uid()),
         case when f.status = 'accepted' or f.addressee_id = auth.uid() then sp.display_name end,
         case when f.status = 'accepted' or f.addressee_id = auth.uid() then sp.avatar end
    from public.friendships f
    cross join lateral (select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as oid) o
    left join public.profiles pr on pr.id = o.oid
    left join public.social_profiles sp on sp.user_id = o.oid and sp.suspended_at is null
   where auth.uid() in (f.requester_id, f.addressee_id)
     and not public.is_blocked(auth.uid(), o.oid)
   order by f.created_at desc
   limit 200;
$$;

-- friends_walks v2 (same return shape): stops projected through public_stops (no Google positions, nothing near the start).
create or replace function public.friends_walks()
  returns table (id uuid, owner_label text, title text, status text, area_label text,
                 total_min smallint, distance_m integer, stops jsonb, created_at timestamptz)
  language sql stable security definer set search_path = public, pg_temp as $$
  select w.id,
         coalesce(sp.display_name, 'Friend ' || coalesce(right(p.friend_code, 4), '----')),
         coalesce(w.area_label, 'Walk'), w.status, w.area_label, w.total_min, w.distance_m,   -- neutral title: the real one names the first stop (near home / Google content)
         public.public_stops(w.stops, w.start_lat, w.start_lng, false),
         date_trunc('day', w.created_at)                                                       -- day only, never the time of day
    from public.saved_walks w
    left join public.profiles p on p.id = w.user_id
    left join public.social_profiles sp on sp.user_id = w.user_id
   where w.visibility = 'friends'
     and w.user_id <> auth.uid()
     and (sp.user_id is null or sp.suspended_at is null)
     and public.are_friends(auth.uid(), w.user_id)
   order by w.created_at desc
   limit 50;
$$;

create or replace function public.list_my_blocks()
  returns table (user_id uuid, display_name text, avatar text, created_at timestamptz)
  language sql stable security definer set search_path = public, pg_temp as $$
  select b.blocked, sp.display_name, sp.avatar, b.created_at
    from public.user_blocks b
    left join public.social_profiles sp on sp.user_id = b.blocked
   where b.blocker = auth.uid()
   order by b.created_at desc
   limit 100;
$$;

-- Friends read each other's walks only through the RPC projections above: own rows only on the table.
drop policy if exists "Read own walks or friends' shared walks" on public.saved_walks;
drop policy if exists "Read own walks" on public.saved_walks;
create policy "Read own walks" on public.saved_walks for select to authenticated using (auth.uid() = user_id);

-- Grants
revoke all on function public.is_blocked(uuid, uuid) from anon, public, authenticated;
revoke all on function public.can_view_profile(uuid) from anon, public, authenticated;
revoke all on function public.public_stops(jsonb, numeric, numeric, boolean) from anon, public, authenticated;

revoke all on function public.are_friends(uuid, uuid) from anon, public;
revoke all on function public.save_social_profile(text, text, text, boolean, boolean, text, boolean) from anon, public;
revoke all on function public.block_user(uuid) from anon, public;
revoke all on function public.report_user(uuid, text, text, text) from anon, public;
revoke all on function public.request_friend(text) from anon, public;
revoke all on function public.request_friend_by_id(uuid) from anon, public;
revoke all on function public.social_profile_card(uuid) from anon, public;
revoke all on function public.social_profile_walks(uuid, timestamptz, int) from anon, public;
revoke all on function public.list_friends() from anon, public;
revoke all on function public.friends_walks() from anon, public;
revoke all on function public.list_my_blocks() from anon, public;

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.save_social_profile(text, text, text, boolean, boolean, text, boolean) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.report_user(uuid, text, text, text) to authenticated;
grant execute on function public.request_friend(text) to authenticated;
grant execute on function public.request_friend_by_id(uuid) to authenticated;
grant execute on function public.social_profile_card(uuid) to authenticated;
grant execute on function public.social_profile_walks(uuid, timestamptz, int) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.friends_walks() to authenticated;
grant execute on function public.list_my_blocks() to authenticated;
