-- Walk geometry + variants. NOT applied to production: Ariel pastes this into the Supabase SQL editor himself.
-- The app works without it: every query falls back to the old column list until these columns exist.
--
-- saved_walks gets the route our own router drew (an encoded polyline, precision 5: our data, not Google content),
-- where it ends, whether it is a loop, and, for variants (reversed, shorter, ...), the walk it came from.
-- walk_runs gets how far a run got, for "continue where I stopped".

alter table public.saved_walks
  add column if not exists geometry text
    check (geometry is null or char_length(geometry) <= 60000),
  add column if not exists end_lat numeric(9, 6) check (end_lat is null or end_lat between -90 and 90),
  add column if not exists end_lng numeric(9, 6) check (end_lng is null or end_lng between -180 and 180),
  add column if not exists is_loop boolean,
  add column if not exists parent_walk_id uuid references public.saved_walks (id) on delete set null,
  add column if not exists variant_kind text
    check (variant_kind is null or variant_kind in ('reverse', 'shorter', 'longer', 'start_here', 'start_at', 'skip_stop', 'add_stop', 'swap_type', 'edit'));

create index if not exists saved_walks_parent_idx on public.saved_walks (user_id, parent_walk_id);

-- A variant is the caller's own row. Its parent must be a walk the caller can read: their own, or a friend's
-- shared one (the select policy already decides that, and the subquery below runs under it).
drop policy if exists "Insert own walks" on public.saved_walks;
create policy "Insert own walks" on public.saved_walks for insert to authenticated
  with check (
    auth.uid() = user_id
    and (parent_walk_id is null or exists (select 1 from public.saved_walks p where p.id = parent_walk_id))
  );

alter table public.walk_runs
  add column if not exists last_stop_index smallint check (last_stop_index is null or last_stop_index between 0 and 40),
  add column if not exists join_mode text
    check (join_mode is null or join_mode in ('start_now', 'resume', 'join_nearest', 'walk_to_start', 'reroute_from_here', 'same_style_here'));
