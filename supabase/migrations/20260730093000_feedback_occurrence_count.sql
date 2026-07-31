-- How often the standing signal has been repeated.
--
-- The unique index (user_id, category, poi_key) keeps exactly one standing row
-- per user and target, so until now a category downvoted once and a category
-- downvoted on ten consecutive walks were indistinguishable — both were a bare
-- "downvote" row, and the ranker applied the same flat penalty to each. One
-- rating can mean the walker was tired, out of time, or unlucky with that one
-- stop; ten in a row is a preference. This column is what tells them apart.
--
-- Counts the CURRENT signal only. A rating in the opposite direction resets the
-- row to the new signal at 1 rather than accumulating across a flip — see
-- saveWalkFeedback in src/lib/preferences/preference-store.ts.

alter table public.attraction_feedback
  add column occurrence_count integer not null default 1
    check (occurrence_count > 0);

-- Existing rows land on the default of 1, which is exactly right: none of them
-- has ever accumulated evidence, each is one standing rating.

comment on column public.attraction_feedback.occurrence_count is
  'Consecutive times the current signal has been recorded for this target. Reset to 1 when the signal flips.';
