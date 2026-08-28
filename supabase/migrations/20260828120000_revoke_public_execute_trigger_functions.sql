-- Finish what 20260828090000 started, and it needs finishing: it revoked
-- EXECUTE from `anon` directly on `set_updated_at()` and `handle_new_user()`,
-- and verifying that live (2026-08-28, has_function_privilege in both
-- directions) found both functions STILL executable by `anon` afterward.
--
-- The cause is a third grant path, distinct from the two already documented
-- on this schema (PUBLIC-revoke doesn't touch the default-ACL grant; the
-- default-ACL grant doesn't touch a role's own explicit grant). Postgres
-- grants EXECUTE to the PUBLIC pseudo-role on every function by default at
-- CREATE FUNCTION time, and neither function's original migration
-- (20260728120000_initial_schema.sql) ever revoked it. `anon` is a member of
-- PUBLIC like every role is, so revoking `anon`'s own direct grant left the
-- PUBLIC grant standing and anon reached the function through that instead --
-- proacl still carried a bare `=X/postgres` entry (no role name before the
-- `=` is how PUBLIC's own grant reads) after the first revoke ran.
--
-- `trim_prompt_exchanges()` was not touched by 20260828090000 at all -- it
-- carries both gaps: the direct anon grant AND the PUBLIC grant, exactly the
-- state `set_updated_at()` and `handle_new_user()` were in before that
-- migration's first (incomplete) pass.
--
-- The rule this schema is following, now corrected for the third time: a
-- function created in `public` needs THREE things revoked before "only
-- `authenticated` can call this" is actually true, not two -- `from public`
-- (the pseudo-role), `from anon` (the default-ACL grant), and confirmed live
-- with `has_function_privilege`, not read off `pg_proc.proacl` at a glance.
-- `record_walk_session()` and `trending_category_upvotes()` already had all
-- three; that is why they were the two functions this pass found clean.
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.trim_prompt_exchanges() from public;
revoke execute on function public.trim_prompt_exchanges() from anon;
