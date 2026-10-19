-- Chat assistant conversations: one row per chat, one row per message.
-- Own rows only. `summary` is the compact memory of older messages (messages
-- before `summarized_count` are not sent to the model again); `state` holds the
-- places found (name, coordinates, Google place_id) and the walk limits.

create table public.assistant_chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat' check (char_length(title) <= 120),
  summary text check (char_length(summary) <= 2000),
  summarized_count integer not null default 0,
  state jsonb not null default '{}'::jsonb
    check (jsonb_typeof(state) = 'object' and pg_column_size(state) <= 32768),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index assistant_chats_user_idx
  on public.assistant_chats (user_id, updated_at desc);

create table public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.assistant_chats (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 4000),
  created_at timestamptz not null default now()
);

create index assistant_messages_chat_idx
  on public.assistant_messages (chat_id, created_at);

alter table public.assistant_chats enable row level security;
alter table public.assistant_messages enable row level security;
revoke all on table public.assistant_chats from anon, public;
revoke all on table public.assistant_messages from anon, public;

create policy "Users read their own chats"
  on public.assistant_chats for select to authenticated using (auth.uid() = user_id);
create policy "Users insert their own chats"
  on public.assistant_chats for insert to authenticated with check (auth.uid() = user_id);
create policy "Users update their own chats"
  on public.assistant_chats for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete their own chats"
  on public.assistant_chats for delete to authenticated using (auth.uid() = user_id);

create policy "Users read their own messages"
  on public.assistant_messages for select to authenticated using (auth.uid() = user_id);
create policy "Users insert their own messages"
  on public.assistant_messages for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.assistant_chats c where c.id = chat_id and c.user_id = auth.uid())
  );
create policy "Users delete their own messages"
  on public.assistant_messages for delete to authenticated using (auth.uid() = user_id);
