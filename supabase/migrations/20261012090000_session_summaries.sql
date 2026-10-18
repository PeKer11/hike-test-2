-- LLM-written, consent-gated session summaries (planner@v1 SUMMARY contract).
-- Own rows only; deleted with "Forget everything". Never holds coordinates,
-- addresses or names: the summary is validated before it is inserted.

create table public.session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  prompt_id text check (char_length(prompt_id) <= 40),
  summary jsonb not null
    check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 2048)
);

create index session_summaries_user_idx
  on public.session_summaries (user_id, created_at desc);

alter table public.session_summaries enable row level security;
revoke all on table public.session_summaries from anon, public;

create policy "Users can read their own session summaries"
  on public.session_summaries for select to authenticated
  using (auth.uid() = user_id);
create policy "Users can insert their own session summaries"
  on public.session_summaries for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Users can delete their own session summaries"
  on public.session_summaries for delete to authenticated
  using (auth.uid() = user_id);

-- Which prompt version produced a call (planner@v1 etc.).
alter table public.llm_usage add column if not exists prompt_id text;
