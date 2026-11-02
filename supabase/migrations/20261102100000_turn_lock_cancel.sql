-- A walker's Stop reaches the running turn: the cancel endpoint sets a flag on the turn's lock row and the turn
-- polls it. The flag is cleared whenever a new turn takes the lock. Service role only, like the lock itself.
alter table public.turn_locks add column if not exists cancel_requested boolean not null default false;

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
  insert into public.turn_locks as l (lock_key, token, expires_at, cancel_requested)
  values (p_key, gen_random_uuid(), now() + make_interval(secs => p_ttl_seconds), false)
  on conflict (lock_key) do update
    set token = excluded.token, expires_at = excluded.expires_at, cancel_requested = false
    where l.expires_at <= now()
  returning token into v_token;
  return v_token;
end;
$$;

-- True when a live turn held the lock and is now asked to stop.
create or replace function public.turn_lock_cancel(p_key text)
returns boolean
language sql
security invoker
set search_path = public
as $$
  with u as (
    update public.turn_locks set cancel_requested = true
    where lock_key = p_key and expires_at > now()
    returning 1
  )
  select exists (select 1 from u);
$$;

create or replace function public.turn_lock_is_cancelled(p_key text)
returns boolean
language sql
security invoker
set search_path = public
as $$
  select coalesce((select cancel_requested from public.turn_locks where lock_key = p_key and expires_at > now()), false);
$$;

revoke execute on function public.turn_lock_cancel(text) from public;
revoke execute on function public.turn_lock_cancel(text) from anon;
revoke execute on function public.turn_lock_cancel(text) from authenticated;
grant execute on function public.turn_lock_cancel(text) to service_role;
revoke execute on function public.turn_lock_is_cancelled(text) from public;
revoke execute on function public.turn_lock_is_cancelled(text) from anon;
revoke execute on function public.turn_lock_is_cancelled(text) from authenticated;
grant execute on function public.turn_lock_is_cancelled(text) to service_role;
