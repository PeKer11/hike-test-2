-- Let a walker re-state a fact they'd previously reversed.
--
-- Found live 2026-08-20: "I don't eat meat" -> "I eat meat again" ->
-- "actually I don't eat meat" silently drops the third statement.
-- `getStandingFacts` only returns active rows, so `upsertFact` correctly takes
-- the insert branch for the third statement -- but `standing_facts_user_key`
-- was a full unique index on (user_id, fact_key), still held by the first,
-- now-superseded "does not eat meat" row, so the insert was refused and the
-- fact was lost without a trace.
--
-- Fix is schema-only: make the key unique only among active rows. A superseded
-- row is history, not a reservation -- the same key gets to be claimed again by
-- a fresh row, and the ordinary contradiction pass (`findContradicted`, driven
-- by the model's own `replaces` field) takes it from there exactly as it does
-- for any other new fact, superseding whatever is currently active under that
-- key. No application code changes: `upsertFact` already only ever inserts
-- when the key isn't held by an active row.

drop index public.standing_facts_user_key;

create unique index standing_facts_user_key
  on public.standing_facts (user_id, fact_key)
  where superseded_at is null;
