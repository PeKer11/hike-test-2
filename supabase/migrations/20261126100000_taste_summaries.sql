-- Round 2 social, migration E of A-E (optional): the opt-in AI taste summary.
-- NOT applied: Ariel pastes this into the Supabase SQL editor himself.
--
-- PASTE ORDER: A 20261118100000_social_profiles.sql first (this replaces social_profile_card from A). B, C, D are not
-- required. Paste only after the phase 9 code is deployed. Safe to paste twice (idempotent).
-- If D is applied, paste E after D (D's card-by-token function calls social_profile_card, which keeps its shape here).
--
-- One row per walker: the private prose summary (never shown to others) and at most six fixed tags (shown on the
-- profile only when the walker turns on show_taste). Own rows only; deleted by "Forget everything".

create table if not exists public.taste_summaries (
  user_id uuid primary key references auth.users (id) on delete cascade,
  summary jsonb not null check (jsonb_typeof(summary) = 'object' and pg_column_size(summary) <= 2048),
  tags text[] not null default '{}' check (
    cardinality(tags) <= 6
    and tags <@ array['nature','views','food','coffee','history','museums','markets','parks','quiet','urban',
                      'beach','religious','shopping','family','long_walks','short_walks','loops','night']::text[]),
  based_on_walks smallint not null default 0 check (based_on_walks between 0 and 1000),
  model text check (model is null or char_length(model) <= 80),
  prompt_id text check (prompt_id is null or char_length(prompt_id) <= 40),
  created_at timestamptz not null default now()
);
alter table public.taste_summaries enable row level security;
revoke all on table public.taste_summaries from anon, public;
drop policy if exists "Read own taste summary" on public.taste_summaries;
create policy "Read own taste summary" on public.taste_summaries for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Insert own taste summary" on public.taste_summaries;
create policy "Insert own taste summary" on public.taste_summaries for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Update own taste summary" on public.taste_summaries;
create policy "Update own taste summary" on public.taste_summaries for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Delete own taste summary" on public.taste_summaries;
create policy "Delete own taste summary" on public.taste_summaries for delete to authenticated using (auth.uid() = user_id);

-- social_profile_card v2: taste_tags come from taste_summaries, only when the walker chose show_taste.
create or replace function public.social_profile_card(p_target uuid)
returns table (display_name text, avatar text, visibility text, relation text, member_since date,
               walk_count int, km_total int, top_areas text[], top_categories text[], taste_tags text[], friend_state text)
language sql stable security definer set search_path = public, pg_temp as $$
  select sp.display_name, sp.avatar, sp.visibility,
    case when sp.user_id = auth.uid() then 'me'
         when public.are_friends(auth.uid(), sp.user_id) then 'friend' else 'other' end,
    date_trunc('month', sp.created_at)::date,
    (select count(*)::int from public.saved_walks w
      where w.user_id = sp.user_id and w.status = 'completed' and not w.hidden_from_profile),
    (select (coalesce(sum(w.distance_m), 0) / 1000)::int from public.saved_walks w
      where w.user_id = sp.user_id and w.status = 'completed' and not w.hidden_from_profile),
    case when sp.user_id = auth.uid() or sp.show_history then
      array(select w.area_label from public.saved_walks w
             where w.user_id = sp.user_id and w.status = 'completed' and not w.hidden_from_profile and w.area_label is not null
             group by w.area_label order by count(*) desc, w.area_label limit 3)
    else '{}'::text[] end,
    case when sp.user_id = auth.uid() or sp.show_history then
      array(select c.cat from (
              select st->>'category' as cat
                from public.saved_walks w, jsonb_array_elements(w.stops) as st
               where w.user_id = sp.user_id and w.status = 'completed' and not w.hidden_from_profile
                 and jsonb_typeof(st) = 'object'
                 and st->>'category' in ('landmark','museum','park','food','viewpoint','religious','shopping','entertainment','nature')
            ) c group by c.cat order by count(*) desc, c.cat limit 3)
    else '{}'::text[] end,
    case when sp.show_taste then coalesce((select ts.tags from public.taste_summaries ts where ts.user_id = sp.user_id), '{}'::text[])
         else '{}'::text[] end,
    case when sp.user_id = auth.uid() then 'me'
         when public.are_friends(auth.uid(), sp.user_id) then 'friends'
         when exists (select 1 from public.friendships f where f.requester_id = auth.uid() and f.addressee_id = sp.user_id and f.status = 'pending') then 'pending_out'
         when exists (select 1 from public.friendships f where f.requester_id = sp.user_id and f.addressee_id = auth.uid() and f.status = 'pending') then 'pending_in'
         else 'none' end
  from public.social_profiles sp
  where sp.user_id = p_target and public.can_view_profile(p_target);
$$;

revoke all on function public.social_profile_card(uuid) from anon, public;
grant execute on function public.social_profile_card(uuid) to authenticated;
