-- Precomputed ESA WorldCover components per geohash6 cell, for the imagery
-- ("detected") tier. Not user data. Written only by the service role (the
-- precompute script); the app reads it with the request's client.
--
-- Safety: the cache holds raw land-cover patches only. Every patch still goes
-- through the safety zones and the per-candidate hazard filter at read time.

create table public.landcover_cells (
  cell           text primary key,
  components     jsonb not null default '[]'::jsonb,
  computed_at    timestamptz not null default now(),
  source_version text not null default 'worldcover-2021-v200'
);

alter table public.landcover_cells enable row level security;

-- Select-only for app roles. No insert/update/delete policy: writes go through
-- the service role, which bypasses RLS.
create policy landcover_cells_select
  on public.landcover_cells
  for select
  to anon, authenticated
  using (true);

revoke all on public.landcover_cells from anon, authenticated, public;
grant select on public.landcover_cells to anon, authenticated;
