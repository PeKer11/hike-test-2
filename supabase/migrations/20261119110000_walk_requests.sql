-- Round 2 social, migration C of A-E: "walk together" requests between friends.
-- NOT applied: Ariel pastes this into the Supabase SQL editor himself.
--
-- PASTE ORDER: A 20261118100000_social_profiles.sql, then B 20261119100000_walk_presence.sql, THEN this file (C),
-- only after the phase 7 code is deployed. Later: D 20261125100000_nearby_walkers.sql (counsel + DPIA first),
-- E 20261126100000_taste_summaries.sql. Safe to paste twice (idempotent).
--
-- No free text anywhere: a request carries a public meeting place, a time and fixed note codes. No live location is shared.
-- Meeting place: an OSM key + name + position (open data), or a Google place_id ONLY (Maps Platform terms).
-- No client can touch the table: only the functions below.

create table if not exists public.walk_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.social_profiles (user_id) on delete cascade,
  to_user uuid not null references public.social_profiles (user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  meet_kind text not null check (meet_kind in ('osm','google')),
  meet_ref text not null check (char_length(meet_ref) between 5 and 200),
  meet_name text check (meet_name is null or char_length(meet_name) between 1 and 80),
  meet_lat numeric(9,6),
  meet_lng numeric(9,6),
  check ((meet_kind = 'osm' and meet_ref ~ '^osm-(node|way|relation)-[0-9]{1,15}$'
          and meet_name is not null and meet_lat is not null and meet_lng is not null)
      or (meet_kind = 'google' and meet_ref ~ '^[A-Za-z0-9_-]{10,200}$'
          and meet_name is null and meet_lat is null and meet_lng is null)),
  meet_at timestamptz not null,
  from_note text check (from_note in ('on_my_way','late_10','here','cant_make_it')),
  to_note text check (to_note in ('on_my_way','late_10','here','cant_make_it')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (from_user <> to_user)
);
create index if not exists walk_requests_to_idx on public.walk_requests (to_user, created_at desc);
create index if not exists walk_requests_from_idx on public.walk_requests (from_user, created_at desc);
alter table public.walk_requests enable row level security;
revoke all on table public.walk_requests from anon, authenticated, public;   -- functions only

-- Every refusal returns null, so the caller cannot tell the reasons apart.
create or replace function public.send_walk_request(
  p_to_user uuid, p_meet_kind text, p_meet_ref text, p_meet_name text,
  p_meet_lat numeric, p_meet_lng numeric, p_meet_in_min int)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  a public.social_profiles%rowtype;
  b public.social_profiles%rowtype;
  rid uuid;
begin
  if uid is null or p_to_user is null or p_to_user = uid then return null; end if;
  if p_meet_in_min is null or p_meet_in_min not in (0, 10, 15, 30, 45, 60) then return null; end if;
  select * into a from public.social_profiles where user_id = uid;
  if not found or a.suspended_at is not null or a.presence_audience = 'off' then return null; end if;
  select * into b from public.social_profiles where user_id = p_to_user;
  if not found or b.suspended_at is not null or b.presence_audience = 'off' then return null; end if;
  if not public.are_friends(uid, p_to_user) then return null; end if;   -- D adds nearby walkers through a separate function
  if (select count(*) from public.walk_requests where from_user = uid and created_at > now() - interval '1 hour') >= 5
     or (select count(*) from public.walk_requests where from_user = uid and created_at > now() - interval '1 day') >= 20 then
    return null;
  end if;
  if exists (select 1 from public.walk_requests r
              where r.status in ('pending', 'accepted') and r.expires_at > now()
                and ((r.from_user = uid and r.to_user = p_to_user) or (r.from_user = p_to_user and r.to_user = uid))) then
    return null;
  end if;
  if (select count(*) from public.walk_requests where to_user = p_to_user and status = 'pending' and expires_at > now()) >= 10 then
    return null;
  end if;
  delete from public.walk_requests where created_at < now() - interval '7 days';   -- housekeeping
  insert into public.walk_requests (from_user, to_user, meet_kind, meet_ref, meet_name, meet_lat, meet_lng, meet_at, expires_at)
  values (uid, p_to_user, p_meet_kind, p_meet_ref,
          case when p_meet_kind = 'osm' then left(btrim(p_meet_name), 80) end,
          case when p_meet_kind = 'osm' then p_meet_lat end,
          case when p_meet_kind = 'osm' then p_meet_lng end,
          date_trunc('minute', now()) + make_interval(mins => p_meet_in_min),
          now() + make_interval(mins => p_meet_in_min + 30))
  returning id into rid;
  return rid;
exception when check_violation or not_null_violation then return null;
end; $$;

create or replace function public.respond_walk_request(p_id uuid, p_accept boolean) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.walk_requests r
     set status = case when p_accept is true then 'accepted' else 'declined' end, responded_at = now(), updated_at = now()
   where r.id = p_id and r.to_user = auth.uid() and r.status = 'pending' and r.expires_at > now()
     and not public.is_blocked(r.from_user, r.to_user);
  return found;
end; $$;

create or replace function public.cancel_walk_request(p_id uuid) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.walk_requests r set status = 'cancelled', updated_at = now()
   where r.id = p_id and auth.uid() in (r.from_user, r.to_user)
     and r.status in ('pending', 'accepted') and r.expires_at > now();
  return found;
end; $$;

-- A fixed note ("on my way", ...). The first note is free; after that, one change per 15 seconds.
create or replace function public.set_walk_request_note(p_id uuid, p_note text) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if p_note is null or p_note not in ('on_my_way', 'late_10', 'here', 'cant_make_it') then return false; end if;
  update public.walk_requests r
     set from_note = case when r.from_user = auth.uid() then p_note else r.from_note end,
         to_note = case when r.to_user = auth.uid() then p_note else r.to_note end,
         updated_at = now()
   where r.id = p_id and auth.uid() in (r.from_user, r.to_user)
     and r.status = 'accepted' and r.expires_at > now()
     and (r.updated_at <= now() - interval '15 seconds'
          or (r.from_user = auth.uid() and r.from_note is null)
          or (r.to_user = auth.uid() and r.to_note is null));
  return found;
end; $$;

create or replace function public.my_walk_requests()
returns table (id uuid, direction text, status text, other_id uuid, other_name text, other_avatar text,
               meet_kind text, meet_ref text, meet_name text, meet_lat numeric, meet_lng numeric, meet_at timestamptz,
               my_note text, their_note text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id,
         case when r.from_user = auth.uid() then 'out' else 'in' end,
         case when r.status in ('pending', 'accepted') and r.expires_at <= now() then 'expired' else r.status end,
         o.oid, sp.display_name, sp.avatar,
         r.meet_kind, r.meet_ref, r.meet_name, r.meet_lat, r.meet_lng, r.meet_at,
         case when r.from_user = auth.uid() then r.from_note else r.to_note end,
         case when r.from_user = auth.uid() then r.to_note else r.from_note end,
         r.created_at
    from public.walk_requests r
    cross join lateral (select case when r.from_user = auth.uid() then r.to_user else r.from_user end as oid) o
    left join public.social_profiles sp on sp.user_id = o.oid
   where auth.uid() in (r.from_user, r.to_user)
     and r.created_at > now() - interval '24 hours'
     and not public.is_blocked(auth.uid(), o.oid)
   order by r.created_at desc
   limit 20;
$$;

-- Blocking someone cancels every open request between the two.
create or replace function public.user_blocks_side_effects() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update public.walk_requests set status = 'cancelled', updated_at = now()
   where status in ('pending', 'accepted')
     and ((from_user = new.blocker and to_user = new.blocked) or (from_user = new.blocked and to_user = new.blocker));
  return new;
end; $$;
drop trigger if exists user_blocks_side_effects on public.user_blocks;
create trigger user_blocks_side_effects after insert on public.user_blocks
  for each row execute function public.user_blocks_side_effects();

revoke all on function public.send_walk_request(uuid, text, text, text, numeric, numeric, int) from anon, public;
revoke all on function public.respond_walk_request(uuid, boolean) from anon, public;
revoke all on function public.cancel_walk_request(uuid) from anon, public;
revoke all on function public.set_walk_request_note(uuid, text) from anon, public;
revoke all on function public.my_walk_requests() from anon, public;
revoke all on function public.user_blocks_side_effects() from anon, public, authenticated;
grant execute on function public.send_walk_request(uuid, text, text, text, numeric, numeric, int) to authenticated;
grant execute on function public.respond_walk_request(uuid, boolean) to authenticated;
grant execute on function public.cancel_walk_request(uuid) to authenticated;
grant execute on function public.set_walk_request_note(uuid, text) to authenticated;
grant execute on function public.my_walk_requests() to authenticated;
