-- Standing facts: the things about a walker that outlive any one walk.
--
-- "does not eat meat", "always walks with a dog", "cannot do stairs". Free-text
-- context for interpreting a request, deliberately NOT categories — "I don't
-- eat meat" does not map to the `food` category, since the walker still wants
-- food stops, just different ones. Keeping the two mechanisms disjoint is what
-- stops them fighting.
--
-- Its own table rather than a second use of prompt_exchanges, because the two
-- have opposite lifetimes: that one's defining property is a rolling five-row
-- eviction, this one's is that a fact outlives everything.
--
-- See docs/persisted-history-design.md.

create table public.standing_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Short canonical phrase as the model rewrote it: "does not eat meat".
  fact_text text not null check (char_length(fact_text) between 3 and 120),
  -- Normalized dedupe key: lowercased, diacritics/niqqud stripped, punctuation
  -- dropped, whitespace collapsed. Derived in TS (normalizeFactKey in
  -- src/lib/preferences/fact-extractor.ts), stored, not generated — the strip
  -- is a Unicode property match Postgres has no cheap equivalent for.
  fact_key text not null,
  -- 1 soft leaning, 2 persistent habit, 3 hard constraint. From the extractor.
  importance smallint not null default 1 check (importance between 1 and 3),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  -- Set when a later statement contradicted this fact ("I've started eating
  -- meat again"). The row is kept rather than deleted so the walker can be
  -- shown what changed and put it back if the app got it wrong; every read
  -- that feeds a walk ignores superseded rows.
  --
  -- Ariel's call on the design doc's open question: contradictions resolve to
  -- the most recently stated fact by default, and the walker is offered the
  -- reversal rather than being asked to arbitrate before anything happens.
  superseded_at timestamptz,
  superseded_by uuid references public.standing_facts (id) on delete set null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Both halves of "this was superseded" are set together or not at all; a
  -- timestamp with no successor is a row nothing can restore from.
  constraint standing_facts_supersede_shape check (
    (superseded_at is null and superseded_by is null)
    or (superseded_at is not null and superseded_by is not null)
  )
);

-- One row per (walker, fact). The upsert on this key is what turns a repeated
-- statement into occurrence_count rather than into a second row.
create unique index standing_facts_user_key
  on public.standing_facts (user_id, fact_key);

create index standing_facts_user_idx on public.standing_facts (user_id);

create trigger standing_facts_set_updated_at
  before update on public.standing_facts
  for each row
  execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — the same four own-rows-only policies as attraction_feedback.
-- ---------------------------------------------------------------------------

alter table public.standing_facts enable row level security;

create policy "Users can read their own standing facts"
  on public.standing_facts
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own standing facts"
  on public.standing_facts
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own standing facts"
  on public.standing_facts
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own standing facts"
  on public.standing_facts
  for delete
  to authenticated
  using (auth.uid() = user_id);
