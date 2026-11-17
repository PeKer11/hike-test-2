-- Rollback-only RLS check for migration A (social profiles). NOT run by anyone but Ariel.
--
-- How: 1) paste migration 20261118100000_social_profiles.sql first.  2) In this file replace the two placeholders
-- __USER_A__ and __USER_B__ (they appear once each in the DECLARE) with the UUIDs of two of YOUR OWN test accounts
-- (Supabase Dashboard > Authentication > Users).  3) Paste into the SQL editor and run.
-- It impersonates each user with set local role + request.jwt.claims, creates throwaway profiles/walks/friendships
-- inside ONE transaction, asserts, and ends with ROLLBACK, so nothing persists. A failed assert raises an exception that
-- names the check. Success prints: NOTICE social_rls_check: ALL CHECKS PASSED.
-- Never wire this into CI against production.

begin;

do $$
declare
  ua uuid := '__USER_A__';
  ub uuid := '__USER_B__';
  w_id uuid;
  n int;
  r text;
begin
  -- Setup as the table owner (everything below is rolled back).
  delete from public.friendships where requester_id in (ua, ub) or addressee_id in (ua, ub);
  delete from public.user_blocks where blocker in (ua, ub) or blocked in (ua, ub);
  delete from public.social_profiles where user_id in (ua, ub);
  insert into public.friendships (requester_id, addressee_id, status) values (ua, ub, 'accepted');
  insert into public.saved_walks (user_id, title, status, area_label, start_lat, start_lng, total_min, distance_m, visibility, completed_at, stops)
  values (ua, 'check walk', 'completed', 'Testville', 32.0, 34.8, 60, 3000, 'friends', now(), jsonb_build_array(
    jsonb_build_object('name', 'Near start', 'category', 'food', 'lat', 32.0005, 'lng', 34.8, 'source', 'osm'),
    jsonb_build_object('name', 'Google Cafe', 'category', 'food', 'lat', 32.01, 'lng', 34.81, 'placeId', 'ChIJabcdefghij12345', 'source', 'google'),
    jsonb_build_object('name', 'OSM Park', 'category', 'park', 'lat', 32.02, 'lng', 34.82, 'source', 'osm'),
    jsonb_build_object('name', 'Other thing', 'category', 'landmark', 'lat', 32.03, 'lng', 34.83)))
  returning id into w_id;

  -- A and B create profiles (private).
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.save_social_profile('Alpha Walker', 'boot', 'private', true, false, 'off', true) into r;
  if r <> 'ok' then raise exception 'A: save_social_profile returned %', r; end if;
  select public.save_social_profile('Traike Admin', 'boot', 'private', true, false, 'off', true) into r;
  if r <> 'name_reserved' then raise exception 'reserved name was not refused: %', r; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.save_social_profile('Beta Walker', 'camera', 'private', true, false, 'off', false) into r;
  if r <> 'adult_required' then raise exception 'B: 18+ gate missing: %', r; end if;
  select public.save_social_profile('Beta Walker', 'camera', 'private', true, false, 'off', true) into r;
  if r <> 'ok' then raise exception 'B: save_social_profile returned %', r; end if;

  -- 1. B cannot read A's rows directly.
  select count(*) into n from public.social_profiles where user_id = ua;
  if n <> 0 then raise exception 'B can read A social_profiles'; end if;
  select count(*) into n from public.saved_walks where user_id = ua;
  if n <> 0 then raise exception 'B can read A saved_walks directly (policy not tightened)'; end if;
  select count(*) into n from public.user_blocks;
  if n <> 0 then raise exception 'B sees block rows'; end if;
  -- abuse_reports is revoked from authenticated: reading it must fail with permission denied.
  begin
    select count(*) into n from public.abuse_reports;
    raise exception 'B can read abuse_reports';
  exception when insufficient_privilege then null;
  end;
  reset role;
  raise notice 'social_rls_check part 1 passed';
end $$;
rollback;

-- Part 2: projections, blocking, friends.
begin;
do $$
declare
  ua uuid := '__USER_A__';
  ub uuid := '__USER_B__';
  n int;
  s jsonb;
  ok boolean;
  names text;
begin
  delete from public.friendships where requester_id in (ua, ub) or addressee_id in (ua, ub);
  delete from public.user_blocks where blocker in (ua, ub) or blocked in (ua, ub);
  delete from public.social_profiles where user_id in (ua, ub);
  insert into public.social_profiles (user_id, display_name, avatar) values (ua, 'Alpha Walker', 'boot'), (ub, 'Beta Walker', 'camera');
  insert into public.friendships (requester_id, addressee_id, status) values (ua, ub, 'accepted');
  insert into public.saved_walks (user_id, title, status, area_label, start_lat, start_lng, total_min, distance_m, visibility, completed_at, stops)
  values (ua, 'check walk', 'completed', 'Testville', 32.0, 34.8, 60, 3000, 'friends', now(), jsonb_build_array(
    jsonb_build_object('name', 'Near start', 'category', 'food', 'lat', 32.0005, 'lng', 34.8, 'source', 'osm'),
    jsonb_build_object('name', 'Google Cafe', 'category', 'food', 'lat', 32.01, 'lng', 34.81, 'placeId', 'ChIJabcdefghij12345', 'source', 'google'),
    jsonb_build_object('name', 'OSM Park', 'category', 'park', 'lat', 32.02, 'lng', 34.82, 'source', 'osm'),
    jsonb_build_object('name', 'Other thing', 'category', 'landmark', 'lat', 32.03, 'lng', 34.83)));

  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 2. While A is private, B gets no card and no walks.
  select count(*) into n from public.social_profile_card(ua);
  if n <> 0 then raise exception 'card(A) visible to B while A is private'; end if;
  select count(*) into n from public.social_profile_walks(ua);
  if n <> 0 then raise exception 'walks(A) visible to B while A is private'; end if;
  -- 3. are_friends about a pair B is not part of is false.
  select public.are_friends(ua, gen_random_uuid()) into ok;
  if ok is distinct from false then raise exception 'are_friends answers about other people'' pairs'; end if;
  -- 3b. Internal helpers are not callable by a client.
  begin
    perform public.is_blocked(ua, ub);
    raise exception 'is_blocked is callable by authenticated';
  exception when insufficient_privilege then null; end;
  reset role;

  -- 4. A goes public and the friendship is removed: B (not a friend) sees the card and the strict projection.
  update public.social_profiles set visibility = 'public' where user_id = ua;
  delete from public.friendships where requester_id in (ua, ub);
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.social_profile_card(ua);
  if n <> 1 then raise exception 'card(A) not visible to B after A went public'; end if;
  select w.stops into s from public.social_profile_walks(ua) w limit 1;
  if jsonb_array_length(s) <> 3 then raise exception 'strict projection should keep 3 of 4 stops (home one dropped), got %', jsonb_array_length(s); end if;
  if s::text like '%Near start%' then raise exception 'a stop within 300 m of the start leaked'; end if;
  if s::text like '%Google Cafe%' then raise exception 'a Google stop name leaked'; end if;
  if s::text like '%Other thing%' then raise exception 'a non-OSM stop name leaked to a non-friend'; end if;
  if s::text not like '%OSM Park%' then raise exception 'the OSM stop should keep its name'; end if;
  if s::text not like '%ChIJabcdefghij12345%' then raise exception 'the Google place_id should be kept'; end if;
  reset role;

  -- 5. As friends, the non-Google stop keeps its name; Google still has none.
  insert into public.friendships (requester_id, addressee_id, status) values (ua, ub, 'accepted');
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select w.stops into s from public.social_profile_walks(ua) w limit 1;
  if s::text not like '%Other thing%' then raise exception 'a friend should see the non-Google stop name'; end if;
  if s::text like '%Google Cafe%' then raise exception 'a Google stop name leaked to a friend'; end if;
  select count(*) into n from public.friends_walks();
  if n <> 1 then raise exception 'friends_walks should return the shared walk, got %', n; end if;
  select f.stops::text into names from public.friends_walks() f limit 1;
  if names like '%Google Cafe%' or names like '%Near start%' then raise exception 'friends_walks leaked Google or home-adjacent stops'; end if;
  reset role;

  -- 6. A blocks B: friendship gone, card empty, are_friends false, B cannot add A, B sees no block row.
  perform set_config('request.jwt.claims', json_build_object('sub', ua, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.block_user(ub) into ok;
  if ok is not true then raise exception 'block_user failed'; end if;
  reset role;
  select count(*) into n from public.friendships where requester_id in (ua, ub);
  if n <> 0 then raise exception 'block_user did not remove the friendship'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub', ub, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select public.are_friends(ub, ua) into ok;
  if ok is not false then raise exception 'are_friends true after block'; end if;
  select count(*) into n from public.social_profile_card(ua);
  if n <> 0 then raise exception 'card(A) visible to B after A blocked B'; end if;
  select public.request_friend_by_id(ua) into ok;
  if ok is not false then raise exception 'request_friend_by_id worked on a blocker'; end if;
  select count(*) into n from public.user_blocks;
  if n <> 0 then raise exception 'the blocked person can see block rows'; end if;
  reset role;

  raise notice 'social_rls_check: ALL CHECKS PASSED';
end $$;
rollback;
