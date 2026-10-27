-- Per-user daily quota for paid third-party calls (Google Places). Service role only, like llm_usage.
create table public.api_quota (
  quota_key text not null,
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (quota_key, day)
);

alter table public.api_quota enable row level security;
revoke all on table public.api_quota from anon, authenticated, public;

-- Takes p_n units when they fit under p_cap; false when they would not.
create or replace function public.api_quota_take(p_key text, p_day date, p_n integer, p_cap integer)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_used integer;
begin
  if p_n < 1 or p_n > 100 or p_cap < 0 then
    raise exception 'invalid api_quota request';
  end if;
  insert into public.api_quota (quota_key, day, used) values (p_key, p_day, 0)
  on conflict (quota_key, day) do nothing;
  update public.api_quota set used = used + p_n
  where quota_key = p_key and day = p_day and used + p_n <= p_cap
  returning used into v_used;
  return v_used is not null;
end;
$$;

revoke execute on function public.api_quota_take(text, date, integer, integer) from public;
revoke execute on function public.api_quota_take(text, date, integer, integer) from anon;
revoke execute on function public.api_quota_take(text, date, integer, integer) from authenticated;
grant execute on function public.api_quota_take(text, date, integer, integer) to service_role;
