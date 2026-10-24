-- Saved places: the walker's own list of places to reuse in new walks (added from past walks or by search).
-- Places stay in the list; `visited_at` is a mark, and "clear visited" deletes the marked ones in one go.
-- Google terms: for source 'google' only the place id (+ name/category, to show the row) is stored, NEVER coordinates
-- (re-resolve by place id when needed). OSM places keep their coordinates.
-- NOT applied to production: run only with the owner's explicit OK.

create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null check (source in ('google', 'osm')),
  -- google: place id. osm: "lat,lng" rounded to 5 decimals (stops carry no OSM id).
  place_ref text not null check (char_length(place_ref) between 1 and 300),
  label text not null check (char_length(label) between 1 and 120),
  category text not null default 'other' check (char_length(category) between 1 and 40),
  lat numeric(9, 6) check (lat between -90 and 90),
  lng numeric(9, 6) check (lng between -180 and 180),
  visited_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source, place_ref),
  -- Google places never keep coordinates; OSM places always do.
  check (
    (source = 'google' and lat is null and lng is null)
    or (source = 'osm' and lat is not null and lng is not null)
  )
);

create index saved_places_user_idx on public.saved_places (user_id, created_at desc);

alter table public.saved_places enable row level security;
revoke all on table public.saved_places from anon, public;

create policy "Read own places" on public.saved_places for select to authenticated using (auth.uid() = user_id);
create policy "Insert own places" on public.saved_places for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own places" on public.saved_places for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own places" on public.saved_places for delete to authenticated using (auth.uid() = user_id);
