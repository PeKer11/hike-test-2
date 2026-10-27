-- One in-flight AI turn per user and route. A lock is a row with an expiry, so a crashed turn frees
-- itself. Service role only: RLS on with no policies, and the functions are executable by service_role.
create table public.turn_locks (
  lock_key text primary key check (char_length(lock_key) <= 200),
  token uuid not null,
  expires_at timestamptz not null
);

alter table public.turn_locks enable row level security;
revoke all on table public.turn_locks from anon, authenticated, public;

-- Returns a token when the lock was taken, null while a live turn holds it.
create or replace function public.turn_lock_acquire(p_key text, p_ttl_seconds integer)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_token uuid;
begin
  if p_ttl_seconds < 1 or p_ttl_seconds > 600 then
    raise exception 'invalid turn lock ttl';
  end if;
  insert into public.turn_locks as l (lock_key, token, expires_at)
  values (p_key, gen_random_uuid(), now() + make_interval(secs => p_ttl_seconds))
  on conflict (lock_key) do update
    set token = excluded.token, expires_at = excluded.expires_at
    where l.expires_at <= now()
  returning token into v_token;
  return v_token;
end;
$$;

create or replace function public.turn_lock_release(p_key text, p_token uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  delete from public.turn_locks where lock_key = p_key and token = p_token;
$$;

revoke execute on function public.turn_lock_acquire(text, integer) from public;
revoke execute on function public.turn_lock_acquire(text, integer) from anon;
revoke execute on function public.turn_lock_acquire(text, integer) from authenticated;
grant execute on function public.turn_lock_acquire(text, integer) to service_role;
revoke execute on function public.turn_lock_release(text, uuid) from public;
revoke execute on function public.turn_lock_release(text, uuid) from anon;
revoke execute on function public.turn_lock_release(text, uuid) from authenticated;
grant execute on function public.turn_lock_release(text, uuid) to service_role;
