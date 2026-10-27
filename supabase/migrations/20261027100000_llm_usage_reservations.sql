-- Turn reservations: a tool-calling turn holds its worst-case cost up front and settles the real cost
-- afterwards, so a refund is a negative increment. Totals never drop below zero. Same shape and the
-- same three-revoke rule as 20261011090500_llm_usage.sql.
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
  if p_calls < 0 or p_calls > 1000 or p_cost_micros < -100000000 or p_cost_micros > 100000000 then
    raise exception 'invalid llm_usage increment';
  end if;

  insert into public.llm_usage as u (caller_key, day, calls, cost_micros)
  values (p_caller_key, p_day, p_calls, greatest(p_cost_micros, 0))
  on conflict (caller_key, day) do update
    set calls = u.calls + p_calls,
        cost_micros = greatest(u.cost_micros + p_cost_micros, 0),
        updated_at = now()
  returning u.calls, u.cost_micros into v_calls, v_cost;

  insert into public.llm_usage as g (caller_key, day, calls, cost_micros)
  values ('*global*', p_day, p_calls, greatest(p_cost_micros, 0))
  on conflict (caller_key, day) do update
    set calls = g.calls + p_calls,
        cost_micros = greatest(g.cost_micros + p_cost_micros, 0),
        updated_at = now()
  returning g.cost_micros into v_global;

  return query select v_calls, v_cost, v_global;
end;
$$;

revoke execute on function public.llm_usage_bump(text, date, integer, bigint) from public;
revoke execute on function public.llm_usage_bump(text, date, integer, bigint) from anon;
revoke execute on function public.llm_usage_bump(text, date, integer, bigint) from authenticated;
grant execute on function public.llm_usage_bump(text, date, integer, bigint) to service_role;
