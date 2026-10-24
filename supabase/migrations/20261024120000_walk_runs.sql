-- Walk runs: every time a saved walk is walked (or walked again) is one run of that ONE walk, so "Walk again"
-- groups under the walk instead of adding a new walk each time. NOT applied to production: run only with the owner's explicit OK.
-- Needs 20261024100000_saved_walks_friends.sql first. A walk with no runs is a draft (built, never walked).

create table public.walk_runs (
  id uuid primary key default gen_random_uuid(),
  walk_id uuid not null references public.saved_walks (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  minutes smallint check (minutes between 0 and 1440),
  distance_m integer check (distance_m between 0 and 200000),
  check (finished_at is null or finished_at >= started_at)
);

create index walk_runs_walk_idx on public.walk_runs (walk_id, started_at desc);
create index walk_runs_user_idx on public.walk_runs (user_id, started_at desc);

alter table public.walk_runs enable row level security;
revoke all on table public.walk_runs from anon, public;

-- Owner only (friends see the walk, not the private run log).
create policy "Read own runs" on public.walk_runs for select to authenticated using (auth.uid() = user_id);
-- A run can only be added to a walk the walker owns.
create policy "Insert own runs" on public.walk_runs for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.saved_walks w where w.id = walk_id and w.user_id = auth.uid())
  );
create policy "Update own runs" on public.walk_runs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own runs" on public.walk_runs for delete to authenticated using (auth.uid() = user_id);
