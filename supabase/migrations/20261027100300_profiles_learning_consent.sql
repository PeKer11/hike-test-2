-- Learning consent kept on the server, so the assistant can check it before it saves anything about the
-- walker. Existing users start at 'unset' (learning pauses until the app syncs their choice once).
-- The existing own-row update policy on profiles covers writes.
alter table public.profiles
  add column if not exists learning_consent text not null default 'unset'
    check (learning_consent in ('unset', 'granted', 'declined')),
  add column if not exists learning_consent_at timestamptz;
