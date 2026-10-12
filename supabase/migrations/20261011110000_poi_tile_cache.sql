-- Shared POI tile cache (docs/NEXT_PHASE_PLAN.md section 2.2 A / roadmap E1).
-- Server-only (service role): no user columns, no client access. Stores only
-- OSM / Wikipedia / Commons / landcover payloads, NEVER Google data. ODbL
-- attribution is shown where the data is displayed.
-- TTLs are applied by the reader from fetched_at (OSM 24 h, Wikipedia 7 d,
-- Commons 7 d, landcover none); see src/lib/places/tile-cache.ts.

create table public.poi_tile_cache (
  -- z15 slippy tile, "15/x/y".
  tile_key text not null check (tile_key ~ '^[0-9]{1,2}/[0-9]+/[0-9]+$'),
  source text not null check (source in ('osm', 'wikipedia', 'commons', 'landcover')),
  query_version smallint not null,
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  primary key (tile_key, source, query_version)
);

create index poi_tile_cache_fetched_idx on public.poi_tile_cache (fetched_at);

-- RLS on with NO policies: authenticated/anon see nothing; the service role
-- bypasses RLS. Privileges are revoked as well (default ACL grants anon).
alter table public.poi_tile_cache enable row level security;
revoke all on table public.poi_tile_cache from anon, authenticated, public;
