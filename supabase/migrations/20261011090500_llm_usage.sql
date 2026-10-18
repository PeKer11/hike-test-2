-- LLM budget guard (NEXT_PHASE_PLAN B2). One row per (caller key, UTC day) with
-- the call count and estimated cost, plus one '*global*' row per day for the
-- daily-dollar cap. The caller key is a user id or a salted ip hash, never a
-- raw ip. Written only by the server with the service role through the RPC
-- below: RLS is on with NO policies, so anon/authenticated clients can neither
-- read nor write it, and the function is executable by service_role only.
create table public.llm_usage (
  caller_key text not null,
  day date not null,
  calls integer not null default 0,
  cost_micros bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (caller_key, day)
);

alter table public.llm_usage enable row level security;
-- Deliberately no policies: default deny for every non-service role.
revoke all on public.llm_usage from anon, authenticated;

-- Atomic increment of the caller's row and the global row in one statement
-- block (row locks serialize concurrent bumps). Returns the caller's totals and
-- the day's global cost so the client can check both caps from one round trip.
create or replace function public.llm_usage_bump(
  p_caller_key text,
  p_day date,
  p_calls integer,
  p_cost_micros bigint
)
returns table (caller_calls integer, caller_cost_micros bigint, global_cost_micros bigint)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_calls integer;
  v_cost bigint;
  v_global bigint;
begin
  if p_calls < 0 or p_cost_micros < 0 or p_calls > 1000 then
    raise exception 'invalid llm_usage increment';
  end if;

  insert into public.llm_usage as u (caller_key, day, calls, cost_micros)
  values (p_caller_key, p_day, p_calls, p_cost_micros)
  on conflict (caller_key, day) do update
    set calls = u.calls + excluded.calls,
        cost_micros = u.cost_micros + excluded.cost_micros,
        updated_at = now()
  returning u.calls, u.cost_micros into v_calls, v_cost;

  insert into public.llm_usage as g (caller_key, day, calls, cost_micros)
  values ('*global*', p_day, p_calls, p_cost_micros)
  on conflict (caller_key, day) do update
    set calls = g.calls + excluded.calls,
        cost_micros = g.cost_micros + excluded.cost_micros,
        updated_at = now()
  returning g.cost_micros into v_global;

  return query select v_calls, v_cost, v_global;
end;
$$;

-- The three-revoke rule documented in 20260828120000: PUBLIC, anon, and
-- authenticated all reach a new function by default.
revoke execute on function public.llm_usage_bump(text, date, integer, bigint) from public;
revoke execute on function public.llm_usage_bump(text, date, integer, bigint) from anon;
revoke execute on function public.llm_usage_bump(text, date, integer, bigint) from authenticated;
grant execute on function public.llm_usage_bump(text, date, integer, bigint) to service_role;

-- Retention: usage rows older than 35 days have no use (caps are per UTC day).
-- Run from a scheduled job with the service role (e.g. pg_cron or an admin
-- script); returns the number of rows deleted. Same three-revoke rule.
create or replace function public.llm_usage_cleanup()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deleted integer;
begin
  delete from public.llm_usage where day < (now() at time zone 'utc')::date - 35;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke execute on function public.llm_usage_cleanup() from public;
revoke execute on function public.llm_usage_cleanup() from anon;
revoke execute on function public.llm_usage_cleanup() from authenticated;
grant execute on function public.llm_usage_cleanup() to service_role;
