-- Friends RPCs. NOT applied to production: run only with the owner's explicit OK.
-- All functions are security definer, pin search_path, and are callable by signed-in users only.
-- Privacy: no email or auth.users data is ever returned; a friend is labelled 'Friend ' + last 4 chars of their code;
-- friends_walks() returns no start coordinates and only walks with visibility = 'friends' from ACCEPTED friends.

create or replace function public.my_friend_code() returns text
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  code text;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
  tries int := 0;
begin
  if uid is null then return null; end if;
  select friend_code into code from public.profiles where id = uid;
  if code is not null then return code; end if;
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.profiles (id, friend_code) values (uid, code)
        on conflict (id) do update set friend_code = excluded.friend_code where public.profiles.friend_code is null;
      select friend_code into code from public.profiles where id = uid;
      return code;
    exception when unique_violation then
      tries := tries + 1;
      if tries > 5 then return null; end if;
    end;
  end loop;
end;
$$;

-- true = a request now exists (or you are already friends); false = anything else. Unknown code, own code and
-- rate-limited all look the same, so a code's existence is not revealed.
create or replace function public.request_friend(code text) returns boolean
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  target uuid;
  clean text := upper(btrim(coalesce(code, '')));
begin
  if uid is null or char_length(clean) < 6 or char_length(clean) > 12 then return false; end if;
  -- Rate limit: at most 10 requests per hour and 100 outstanding pending requests.
  if (select count(*) from public.friendships where requester_id = uid and created_at > now() - interval '1 hour') >= 10
     or (select count(*) from public.friendships where requester_id = uid and status = 'pending') >= 100 then
    return false;
  end if;
  select id into target from public.profiles where friend_code = clean;
  if target is null or target = uid then return false; end if;
  -- They already asked me: accept instead of creating a second row.
  update public.friendships set status = 'accepted'
    where requester_id = target and addressee_id = uid and status = 'pending';
  if found then return true; end if;
  insert into public.friendships (requester_id, addressee_id) values (uid, target)
    on conflict (requester_id, addressee_id) do nothing;
  return true;
end;
$$;

create or replace function public.list_friends()
  returns table (friendship_id uuid, friend_id uuid, label text, status text, incoming boolean)
  language sql stable security definer set search_path = public as $$
  select f.id,
         case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end,
         'Friend ' || coalesce(right(o.friend_code, 4), '----'),
         f.status,
         (f.addressee_id = auth.uid())
  from public.friendships f
  left join public.profiles o on o.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where auth.uid() in (f.requester_id, f.addressee_id)
  order by f.created_at desc
  limit 200;
$$;

create or replace function public.friends_walks()
  returns table (id uuid, owner_label text, title text, status text, area_label text,
                 total_min smallint, distance_m integer, stops jsonb, created_at timestamptz)
  language sql stable security definer set search_path = public as $$
  select w.id,
         'Friend ' || coalesce(right(p.friend_code, 4), '----'),
         w.title, w.status, w.area_label, w.total_min, w.distance_m, w.stops, w.created_at
  from public.saved_walks w
  left join public.profiles p on p.id = w.user_id
  where w.visibility = 'friends'
    and w.user_id <> auth.uid()
    and public.are_friends(auth.uid(), w.user_id)
  order by w.created_at desc
  limit 50;
$$;

revoke all on function public.my_friend_code() from anon, public;
revoke all on function public.request_friend(text) from anon, public;
revoke all on function public.list_friends() from anon, public;
revoke all on function public.friends_walks() from anon, public;
grant execute on function public.my_friend_code() to authenticated;
grant execute on function public.request_friend(text) to authenticated;
grant execute on function public.list_friends() to authenticated;
grant execute on function public.friends_walks() to authenticated;
