-- Persisted scrollback for the "name your own stops" panel.
--
-- One row per thing the walker sent and the one-line summary of what came
-- back — the same pairs `PlacePromptPanel` already keeps in memory for the
-- session, kept across sessions so a returning walker can still see what they
-- last tried.
--
-- Deliberately not stored: the extraction response itself, coordinates, the
-- resolved attractions, or any route geometry. The summary string is derived
-- client-side before the write (see `summarizeExtraction`), which keeps the
-- PII-dense half of the response out of the database entirely.
--
-- See docs/persisted-history-design.md.

-- Mirrors ExchangeTurn in src/lib/history/exchange.ts. Keep both in sync.
-- Not rendered in v1; it exists so a later UI can style a chip turn
-- differently without a backfill.
create type public.exchange_turn as enum ('prompt', 'chip', 'follow_up');

create table public.prompt_exchanges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  turn public.exchange_turn not null,
  -- The panel caps its input at the same 500 characters.
  prompt_text text not null check (char_length(prompt_text) <= 500),
  response_summary text not null check (char_length(response_summary) <= 200),
  created_at timestamptz not null default now()
);

create index prompt_exchanges_user_recent_idx
  on public.prompt_exchanges (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Eviction
-- ---------------------------------------------------------------------------

-- The cap is the whole point of the feature: this is a bounded window, not a
-- transcript. Enforced by a trigger rather than in the write path because a cap
-- that lives in one client call site is a cap the next call site silently
-- breaks.
--
-- The `5` below is MAX_SCROLLBACK in src/lib/history/exchange.ts. Keep both in
-- sync, the same way the attraction_category enum is cross-referenced.
create or replace function public.trim_prompt_exchanges()
returns trigger
language plpgsql
as $$
begin
  delete from public.prompt_exchanges
  where user_id = new.user_id
    and id not in (
      select id from public.prompt_exchanges
      where user_id = new.user_id
      order by created_at desc
      limit 5
    );

  return null;
end;
$$;

create trigger prompt_exchanges_trim
  after insert on public.prompt_exchanges
  for each row
  execute function public.trim_prompt_exchanges();

-- ---------------------------------------------------------------------------
-- RLS — the four attraction_feedback policies, own rows only. No service-role
-- client exists anywhere on this path, so this is what enforces isolation.
-- ---------------------------------------------------------------------------

alter table public.prompt_exchanges enable row level security;

create policy "Users can read their own prompt exchanges"
  on public.prompt_exchanges
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own prompt exchanges"
  on public.prompt_exchanges
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own prompt exchanges"
  on public.prompt_exchanges
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own prompt exchanges"
  on public.prompt_exchanges
  for delete
  to authenticated
  using (auth.uid() = user_id);
