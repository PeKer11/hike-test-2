-- Routine habits ("eats around 16:00"), consent-gated like walk_summaries.
-- One row per (habit, clock, day type): two 48-bin arrays of 30-minute LOCAL
-- time bins plus a few counters. No coordinates, no place names, no timestamps
-- finer than the hour. Never sent to an LLM. Deleted with "Forget everything".

create table public.routine_habits (
  user_id uuid not null references auth.users (id) on delete cascade,
  habit text not null check (habit in ('eat', 'coffee', 'rest')),
  clock text not null check (clock in ('wall', 'walk')),
  day_type text not null check (day_type in ('weekday', 'friday', 'saturday', 'any')),
  succ real[] not null check (array_length(succ, 1) = 48),
  opp real[] not null check (array_length(opp, 1) = 48),
  -- coarse "distinct days" evidence, one mask per 30-minute bin: bit (local epoch
  -- day mod 30) per success day in that bin or its neighbours; stale bits are
  -- cleared on write, relative to mask_day (the local epoch day last written).
  day_masks integer[] not null default array_fill(0, array[48])
    check (array_length(day_masks, 1) = 48),
  mask_day integer not null default 0 check (mask_day >= 0),
  timing jsonb not null default '{}'::jsonb
    check (jsonb_typeof(timing) = 'object' and pg_column_size(timing) <= 512),
  decline_streak smallint not null default 0 check (decline_streak between 0 and 100),
  muted_until timestamptz,
  last_asked_hour timestamptz,
  -- start of the last walk folded in, in minutes since the epoch (retry guard)
  last_walk_key integer not null default 0 check (last_walk_key >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, habit, clock, day_type)
);

alter table public.routine_habits enable row level security;
revoke all on table public.routine_habits from anon, public;

create policy "Users can read their own routine habits"
  on public.routine_habits for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own routine habits"
  on public.routine_habits for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can update their own routine habits"
  on public.routine_habits for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can delete their own routine habits"
  on public.routine_habits for delete to authenticated
  using (auth.uid() = user_id);
