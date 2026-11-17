-- Round 2 social, migration B of A-E: "walking now" for friends (coarse presence).
-- NOT applied: Ariel pastes this into the Supabase SQL editor himself.
--
-- PASTE ORDER: A 20261118100000_social_profiles.sql FIRST (this needs social_profiles, are_friends v2, can_view_profile),
-- then this file (B). Only after the phase 6 code is deployed and the profile flag decision is made.
-- Later: C 20261119110000_walk_requests.sql, D 20261125100000_nearby_walkers.sql (counsel + DPIA first), E 20261126100000_taste_summaries.sql.
-- Safe to paste twice (idempotent).
--
-- Privacy: no coordinates are stored. Only a ~1 km grid cell (floor(lat*100), floor(lng*100)) and the walk's city label.
-- Rows expire 20 minutes after the last update and are deleted at walk end, when going ghost, and when the audience is turned off.
-- No client can select this table: only the functions below.

create table if not exists public.walk_presence (
  user_id uuid primary key references public.social_profiles (user_id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,      -- opaque, new every walk; strangers (phase 8) see only this
  cell_y integer not null check (cell_y between -9000 and 9000),    -- floor(lat * 100)
  cell_x integer not null check (cell_x between -18000 and 18000),  -- floor(lng * 100)
  area_label text check (area_label is null or char_length(area_label) <= 60),
  audience text not null check (audience in ('friends','public')),
  since timestamptz not null,                                 -- rounded down to 15 min
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists walk_presence_cell_idx on public.walk_presence (cell_y, cell_x);
create index if not exists walk_presence_expires_idx on public.walk_presence (expires_at);
alter table public.walk_presence enable row level security;
revoke all on table public.walk_presence from anon, authenticated, public;   -- no policies: functions only

create or replace function public.set_my_presence(p_cell_y integer, p_cell_x integer, p_area text, p_new_walk boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); prof public.social_profiles%rowtype; cur public.walk_presence%rowtype; fresh boolean;
begin
  if uid is null then return false; end if;
  select * into prof from public.social_profiles where user_id = uid;
  if not found or prof.suspended_at is not null or prof.presence_audience = 'off' then
    delete from public.walk_presence where user_id = uid; return false;
  end if;
  delete from public.walk_presence where expires_at < now() - interval '10 minutes';          -- housekeeping
  select * into cur from public.walk_presence where user_id = uid;
  -- a "new walk" may move anywhere, at most once per 10 minutes
  fresh := not found or cur.expires_at <= now() or (coalesce(p_new_walk, false) and cur.updated_at < now() - interval '10 minutes');
  if found and not fresh then
    if cur.updated_at > now() - interval '60 seconds' then return true; end if;                -- one write a minute
    if abs(p_cell_y - cur.cell_y) > 3 or abs(p_cell_x - cur.cell_x) > 3 then return false; end if;  -- no jumps
  end if;
  insert into public.walk_presence as w (user_id, cell_y, cell_x, area_label, audience, since, expires_at, updated_at)
  values (uid, p_cell_y, p_cell_x, nullif(left(btrim(coalesce(p_area, '')), 60), ''), prof.presence_audience,
          to_timestamp(floor(extract(epoch from now()) / 900) * 900), now() + interval '20 minutes', now())
  on conflict (user_id) do update set
    token = case when fresh then gen_random_uuid() else w.token end,
    since = case when fresh then excluded.since else w.since end,
    cell_y = excluded.cell_y, cell_x = excluded.cell_x, area_label = excluded.area_label,
    audience = excluded.audience, expires_at = excluded.expires_at, updated_at = now();
  return true;
exception when check_violation then return false;
end; $$;

create or replace function public.clear_my_presence() returns void
  language sql security definer set search_path = public, pg_temp as $$
  delete from public.walk_presence where user_id = auth.uid();
$$;

-- Friends who are walking now. Reciprocity: the caller needs their own profile (not suspended) with presence on.
-- This version is friends only; migration D replaces it to add nearby strangers.
create or replace function public.walking_now()
returns table (token uuid, friend_id uuid, display_name text, avatar text, relation text, area_label text,
               since_bucket text, distance_bucket text, profile_visible boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with me as (
    select wp.cell_y, wp.cell_x, wp.expires_at
      from public.social_profiles sp
      left join public.walk_presence wp on wp.user_id = sp.user_id
     where sp.user_id = auth.uid() and sp.suspended_at is null and sp.presence_audience <> 'off'
  )
  select p.token, p.user_id, sp.display_name, sp.avatar, 'friend'::text, p.area_label,
         case when now() - p.since < interval '15 minutes' then 'just_started'
              when now() - p.since < interval '45 minutes' then 'about_30'
              else 'over_45' end,
         (select case when m.cell_y is null or m.expires_at <= now() then null
                      when greatest(abs(p.cell_y - m.cell_y), abs(p.cell_x - m.cell_x)) = 0 then 'here'
                      when greatest(abs(p.cell_y - m.cell_y), abs(p.cell_x - m.cell_x)) <= 2 then 'near'
                      else 'far' end
            from me m),
         public.can_view_profile(p.user_id)
    from public.walk_presence p
    join public.social_profiles sp on sp.user_id = p.user_id and sp.suspended_at is null
   where exists (select 1 from me)
     and p.expires_at > now()
     and p.user_id <> auth.uid()
     and public.are_friends(auth.uid(), p.user_id)
   order by p.updated_at desc
   limit 30;
$$;

-- Turning the audience off, or a suspension, removes the presence row at once; a changed audience is copied onto it.
create or replace function public.social_profiles_presence_guard() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.presence_audience = 'off' or new.suspended_at is not null then
    delete from public.walk_presence where user_id = new.user_id;
  else
    update public.walk_presence set audience = new.presence_audience where user_id = new.user_id;
  end if;
  return new;
end; $$;
drop trigger if exists social_profiles_presence_guard on public.social_profiles;
create trigger social_profiles_presence_guard
  after update of presence_audience, suspended_at on public.social_profiles
  for each row execute function public.social_profiles_presence_guard();

revoke all on function public.set_my_presence(integer, integer, text, boolean) from anon, public;
revoke all on function public.clear_my_presence() from anon, public;
revoke all on function public.walking_now() from anon, public;
revoke all on function public.social_profiles_presence_guard() from anon, public, authenticated;
grant execute on function public.set_my_presence(integer, integer, text, boolean) to authenticated;
grant execute on function public.clear_my_presence() to authenticated;
grant execute on function public.walking_now() to authenticated;
