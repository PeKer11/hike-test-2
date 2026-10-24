-- Walk history + friends. NOT applied to production: run only with the owner's explicit OK.
-- saved_walks: every walk the walker built (planned), finished (completed) or bookmarked (saved), with its stops,
-- so the app can list it, the chat can recall it ("like yesterday, other pizzeria"), and friends can see it.
-- Stop names/coordinates are stored in `stops`; Google-sourced names are the open "Google content storage" item.

create table public.saved_walks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  status text not null default 'planned' check (status in ('planned', 'saved', 'completed')),
  -- City name only.
  area_label text check (char_length(area_label) <= 60),
  start_lat numeric(9, 6) not null check (start_lat between -90 and 90),
  start_lng numeric(9, 6) not null check (start_lng between -180 and 180),
  total_min smallint check (total_min between 0 and 1440),
  distance_m integer check (distance_m between 0 and 200000),
  -- [{"name":"...","category":"food","lat":0,"lng":0,"placeId":"..."}], in walking order.
  stops jsonb not null default '[]'::jsonb
    check (jsonb_typeof(stops) = 'array' and jsonb_array_length(stops) <= 40 and pg_column_size(stops) <= 16384),
  -- Re-planning inputs ("walk it again"): the limits the walk was built with.
  params jsonb not null default '{}'::jsonb
    check (jsonb_typeof(params) = 'object' and pg_column_size(params) <= 4096),
  visibility text not null default 'private' check (visibility in ('private', 'friends')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index saved_walks_user_idx on public.saved_walks (user_id, created_at desc);

-- friend_code: how a walker is found by a friend. Short, random, regenerable.
alter table public.profiles add column if not exists friend_code text unique
  check (friend_code is null or char_length(friend_code) between 6 and 12);

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users (id) on delete cascade,
  addressee_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);

create index friendships_addressee_idx on public.friendships (addressee_id);

alter table public.saved_walks enable row level security;
alter table public.friendships enable row level security;
revoke all on table public.saved_walks from anon, public;
revoke all on table public.friendships from anon, public;

create or replace function public.are_friends(a uuid, b uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester_id = a and addressee_id = b) or (requester_id = b and addressee_id = a))
  );
$$;
revoke all on function public.are_friends(uuid, uuid) from anon, public;
grant execute on function public.are_friends(uuid, uuid) to authenticated;

create policy "Read own walks or friends' shared walks"
  on public.saved_walks for select to authenticated
  using (auth.uid() = user_id or (visibility = 'friends' and public.are_friends(auth.uid(), user_id)));
create policy "Insert own walks" on public.saved_walks for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own walks" on public.saved_walks for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own walks" on public.saved_walks for delete to authenticated using (auth.uid() = user_id);

create policy "Read own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
create policy "Request a friendship" on public.friendships for insert to authenticated
  with check (auth.uid() = requester_id and status = 'pending');
create policy "Accept a request" on public.friendships for update to authenticated
  using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id);
create policy "End a friendship" on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id));
