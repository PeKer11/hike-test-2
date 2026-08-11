# Persisted scrollback + standing-facts memory — design

Covers TODO.md lines 121 and 122. They are designed together because both are "what survives the
session", but they land as **two tables with different lifetimes, different write triggers and
different consumers**. Nothing here is built yet.

Existing shape this builds on: `profiles` / `attraction_feedback`
(`supabase/migrations/20260728120000_initial_schema.sql`), `src/lib/preferences/preference-store.ts`,
`src/lib/preferences/preference-extractor.ts`, `src/lib/api/gemini-client.ts`,
`src/components/route/PlacePromptPanel.tsx` (in-memory `ScrollbackEntry[]`, `logExchange`,
`summarizeExtraction`).

---

## Part 1 — Persisted scrollback

### Table

```sql
create type public.exchange_turn as enum ('prompt', 'chip', 'follow_up');

create table public.prompt_exchanges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  turn public.exchange_turn not null,
  prompt_text text not null check (char_length(prompt_text) <= 500),
  response_summary text not null check (char_length(response_summary) <= 200),
  created_at timestamptz not null default now()
);

create index prompt_exchanges_user_recent_idx
  on public.prompt_exchanges (user_id, created_at desc);
```

RLS: copy the four `attraction_feedback` policies verbatim (`auth.uid() = user_id` for
select/insert/update/delete, `to authenticated`). No service-role client anywhere on this path —
same rule the preference store already follows.

`turn` mirrors the three call sites of `logExchange` today. It is not rendered in v1; it exists so a
later UI can style a chip turn differently without a backfill, and it costs one enum.

### Window and eviction

**Keep the newest 5 rows per user, enforced by a trigger**, not by the client:

```sql
create or replace function public.trim_prompt_exchanges()
returns trigger language plpgsql as $$
begin
  delete from public.prompt_exchanges
  where user_id = new.user_id
    and id not in (
      select id from public.prompt_exchanges
      where user_id = new.user_id
      order by created_at desc
      limit 5
    );
  return null;
end; $$;

create trigger prompt_exchanges_trim
  after insert on public.prompt_exchanges
  for each row execute function public.trim_prompt_exchanges();
```

Why a trigger and not "delete the old rows in the write path": the cap is the whole point of the
feature (the TODO says bounded specifically to avoid a context/memory blowup), and a cap that lives
in one client call site is a cap that a second call site silently breaks. `MAX_SCROLLBACK = 5` in
the panel and the `limit 5` here must be kept in sync — put the number in one exported TS constant
and quote it in a comment in the migration, the same way the `attraction_category` enum is
cross-referenced today.

**Plus an age cutoff at read time, not a second eviction job**: the read query filters
`created_at > now() - interval '30 days'`. A prompt from four months ago is not "recent requests" —
it is a stranger's sentence. Rows older than that fall out on the next insert anyway; there is no
cron to write.

### What is stored

| Stored | Not stored |
|---|---|
| The trimmed prompt text, capped at 500 chars | The raw `ExtractPlacesResponse` |
| The already-derived `responseSummary` string | Coordinates, `Attraction[]`, `contextLocation` |
| `turn`, `created_at` | Any route or geometry |

Storing the **derived summary string, not the response**, is the load-bearing decision:

- `summarizeExtraction()` is already a pure client function over the response. Persisting the raw
  response would mean re-deriving the summary at read time against a response shape that has changed
  under it — the panel would have to keep parsers for retired shapes forever.
- The raw response is the PII-dense part (geocoded coordinates near where the walker lives). The
  summary — "Found 2 stops" — is not.
- Size. Five rows of two short strings is a rounding error; five full responses is not.

Accepted cost: when `summarizeExtraction` changes wording, old rows keep the old wording. That is
correct — the row records what the app actually told the walker at the time.

The prompt text is stored **untruncated** (up to 500 chars, the panel already caps input at
`MAX_PROMPT_LENGTH`); `truncatePrompt` stays a display function. Truncating at write time throws
away the only thing that makes a row re-usable later ("run that again").

### Read/write pattern

**Write: on every `logExchange` call, fire-and-forget.** Same three call sites, same moment —
including the error paths. The value of the log is "what did I just try", and a failed attempt is
exactly the thing you scroll up to look at. Writing on route-build completion is wrong: a chip turn
and a clarification turn never build a route, and those are half the rows.

The POST is not awaited and its failure is swallowed, matching the existing contract for
`learnPreferences` in `src/app/api/extract-places/route.ts` — a profile side effect must never fail
the request the walker actually made.

**Read: exactly once, on panel mount, only when signed in.** One `GET`, `order by created_at desc
limit 5`, reversed client-side into the existing ascending render order. No refetch, no
subscription, no polling — the local array is authoritative for the rest of the session.

### Interaction with the in-memory scrollback

**In-memory stays exactly as it is and remains the render source. Persisted history is a hydration
seed plus a write mirror.** Concretely:

- Mount: if signed in and `scrollback.length === 0`, `setScrollback(fetchedRows)`.
- `logExchange`: append locally first (instant, unchanged), then fire the POST.
- The `.slice(-MAX_SCROLLBACK)` in `logExchange` already enforces the same cap locally, so local and
  remote converge without a reconciliation step.

This keeps the logged-out and Supabase-unconfigured paths byte-identical to today, which is the
project's stated philosophy for every profile read. Replacing the in-memory buffer with a
server-round-trip-per-turn would make the panel slower and would break it entirely when signed out —
for a feature Ariel has already confirmed feels right as-is.

### Privacy

Walk prompts are the most personal text in the app: they name home streets, workplaces, kids,
mobility limits, dates. Mitigations, all required for v1:

1. RLS own-rows-only, no service role on the path (as above).
2. `on delete cascade` from `auth.users` — deleting the account deletes the history, no cleanup job.
3. A visible **"Clear history"** control on the scrollback panel, backed by
   `DELETE /api/prompt-history` (delete all rows for `auth.uid()`). A persisted memory the user
   cannot delete is the failure mode here.
4. Never store coordinates or the resolved place objects (see table above).
5. No server logging of `prompt_text` — the existing routes `console.warn` place names in a couple
   of spots; do not add prompt text to any log line on this path.

**Open:** whether persistence is gated behind the existing `walkSettings.preferenceLearningEnabled`
toggle or gets its own. Recommendation: **its own toggle, default on.** "Remember what I like" and
"show me what I typed five minutes ago" are different promises, and the second one is visible and
clearable, so defaulting it on is honest. Reusing one flag means turning off preference learning
silently deletes a UI feature.

---

## Part 2 — Standing facts

### Own storage, not Part 1's

Recommendation: **a separate table.** Reasons, in order of weight:

1. **Opposite lifetimes.** The scrollback's defining property is a rolling 5-row eviction. A fact's
   defining property is that it outlives everything. Sharing a table means the eviction trigger
   deletes facts, and exempting facts from the trigger means the table has two eviction policies —
   at which point it is two tables wearing one name.
2. **Different cardinality semantics.** Exchanges are append-only events. Facts are *upserted*
   entities with an occurrence count — the same shape as `attraction_feedback`'s
   `(user_id, category, poi_key)` unique index with `occurrence_count`, which is exactly the pattern
   the TODO points at.
3. **Different consumer.** Exchanges are display-only and never re-enter a request (the panel's own
   comment says so). Facts exist *only* to re-enter a request.

### Table

```sql
create table public.standing_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Short canonical phrase as the model rewrote it: "does not eat meat".
  fact_text text not null check (char_length(fact_text) between 3 and 120),
  -- Normalized dedupe key: lowercased, diacritics/niqqud stripped, punctuation
  -- dropped, whitespace collapsed. Derived in TS, stored, not generated.
  fact_key text not null,
  -- 1 soft leaning, 2 persistent habit, 3 hard constraint. From the extractor.
  importance smallint not null default 1 check (importance between 1 and 3),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index standing_facts_user_key on public.standing_facts (user_id, fact_key);
create index standing_facts_user_idx on public.standing_facts (user_id);
```

Same four RLS policies, same `set_updated_at` trigger the schema already defines.

**Deliberately no `related_categories attraction_category[]` column.** It is the obvious thing to
add and it is wrong: "I don't eat meat" does not map to the `food` category — the walker still wants
food stops, just different ones. Facts are free-text context; categories stay the categories
mechanism. Keeping them disjoint is what stops the two systems from fighting.

Cap: **20 facts per user.** On insert past the cap, delete the lowest-scoring row (scoring below).
Enforce in the store function, not a trigger — the eviction needs the score, which is TS.

### Extraction

**A third Gemini call, `extractStandingFacts(text)`, structurally cloned from
`extractCategoryPreferences`** — same `MODEL`, JSON mode, `responseSchema`, `maxOutputTokens: 256`,
same `server-only` module. Not pattern matching: the input is bilingual Hebrew/English free text and
the fact space is open-ended, which is precisely where regexes stop.

Not a new field on `extractPlaceNames` either, for the reason already written in the doc comment on
`extractCategoryPreferences`: place extraction runs for everyone including logged-out walkers, and
this runs only for a signed-in walker with learning enabled. Folding them together makes every
anonymous prompt pay for a field nobody reads.

`FACT_EXTRACTION_SYSTEM_PROMPT` lives in a new pure module `src/lib/preferences/fact-extractor.ts`
(next to `preference-extractor.ts`, and pure for the same reason — so tests can read it). It inherits
that prompt's discipline verbatim, with these rules:

- Return `facts`: `[{ text, importance }]`, at most 3 per call.
- An empty list is the normal, expected answer. Most prompts contain no standing fact.
- A fact must be **standing and general**: "I always walk with a dog", "I don't eat meat",
  "I can't do stairs". Never about this one walk: "today I only have an hour", "let's start at the
  station" are not facts.
- Never a place name, a duration, a distance, or a mood.
- Never a category liking/disliking — "I love museums" belongs to the preference pass and must not be
  double-written here. (Explicit rule + an example, since this is the one real overlap.)
- Rewrite in short third person, ≤ 80 chars, so the same fact from two phrasings normalizes to one key.
- `importance`: 3 = hard constraint the walk must respect (dietary rule, allergy, mobility limit);
  2 = persistent habit that changes what fits (walks with a dog, always with small children);
  1 = a soft leaning. Default to 1 when unsure.

Parsing mirrors `parseCategoryPreferences`: drop anything malformed, return `[]` rather than throw.

**Write path**: rename `learnPreferences()` in `src/app/api/extract-places/route.ts` to
`learnFromText()` and have it `Promise.all` the existing preference pass and the new fact pass under
the same signed-in + `learnPreferences === true` gate and the same swallow-everything `try/catch`.
Same for `src/app/api/walk-feedback/route.ts`, which already routes its comment box through
`learnPreferencesFromText`.

Cost note: this is a second model call per opted-in prompt. Acceptable for now (Flash-Lite, 256
output tokens, off the critical path since it is not awaited before the response). If it bites,
the follow-up is one call returning both `preferences` and `facts` — see step 11.

### Merge / dedupe

`normalizeFactKey(text)`: lowercase → strip combining marks (the same Latin-accent + Hebrew-niqqud
strip already implemented in `src/lib/places/geocode-plausibility.ts`, extract it to a shared util
rather than writing it twice) → drop punctuation → collapse whitespace.

Upsert on `(user_id, fact_key)`:

- **Hit**: `occurrence_count += 1`, `last_seen_at = now()`, `importance = greatest(existing, new)`,
  `fact_text` left alone (first phrasing wins — churning the displayed text every time the model
  rewords it makes the user-facing list look unstable).
- **Miss**: insert at `occurrence_count = 1`.

This is intentionally the same "flat for explicit statement, scaled for repetition" split that
`PREFERRED_CATEGORY_BOOST` vs `occurrencePreferenceBoost` already encodes — importance is the flat,
stated-evidence term; occurrence is the accumulated-behaviour term.

**Contradictions are not auto-resolved in v1.** "I don't eat meat" and a later "I've started eating
meat again" produce different keys and both survive. Detecting negation-of-an-existing-fact needs a
second model pass over the stored set, which is a much bigger feature. The recency term below demotes
the stale one over months, and the user-facing list has a delete button. Flagged, not solved.

### Scoring — recency × importance × repetition

Pure function in `fact-extractor.ts`, no SQL math, fully unit-testable:

```
score(fact, now) =
    IMPORTANCE_WEIGHT * importance                       // 2 * (1..3)  = 2..6
  + min(occurrence_count, OCCURRENCE_CAP)                // 1 * (1..5)  = 1..5
  + RECENCY_MAX * 0.5 ** (daysSince(last_seen_at) / HALF_LIFE_DAYS)   // 0..4
```

with

```
IMPORTANCE_WEIGHT = 2
OCCURRENCE_CAP    = 5
RECENCY_MAX       = 4
HALF_LIFE_DAYS    = 60
MIN_FACT_SCORE    = 5
MAX_FACTS_IN_PROMPT = 5
```

The numbers sit deliberately on the same scale the ranker already uses (`PREFERRED_CATEGORY_BOOST =
4`, `MAX_DOWNVOTE_PENALTY = 8`), so the two systems stay readable against each other. Range is
roughly 3–15. Recency contributes 4 today, 2 at two months, 1 at four months, ~0.25 at a year — it
demotes but never deletes, which is right: a stale hard constraint (importance 3, score floor 6+1)
still clears `MIN_FACT_SCORE` on its own, while a soft leaning mentioned once a year ago
(1×2 + 1 + 0.25 = 3.25) falls out. That is exactly the intended asymmetry.

### Retrieval and application

On each extraction for a signed-in walker with learning enabled: one `select * from standing_facts
where user_id = ...` (≤ 20 rows), score in TS, sort desc, keep those `>= MIN_FACT_SCORE`, take top
`MAX_FACTS_IN_PROMPT`.

Inject into **the user contents of `extractPlaceNames`, not the system instruction**:

```
Standing facts about this walker:
- does not eat meat
- always walks with a dog

Request:
<the walker's prompt>
```

System instruction stays a module constant — it is shared across all users and is the cacheable part;
per-user text belongs in `contents`. `extractPlaceNames(prompt)` gains an optional second argument;
when it is empty the request sent is byte-identical to today's, which is what makes the change safe
to ship and easy to test.

One rule added to `PLACE_EXTRACTION_SYSTEM_PROMPT`: *standing facts are context for interpreting the
request; they never add places or category needs on their own, and the walker's current text always
wins where the two conflict.* Without this the model will helpfully invent a dog park.

**Not applied as a POI filter in v1.** Filtering Overpass results on "no meat" needs a tag vocabulary
(`diet:vegetarian`, `cuisine=*`) the app does not have, and the payoff is unclear until we see
whether prompt context alone changes what gets asked for. Revisit after step 10.

### Surfacing to the user — required, not optional

A **"Things I remember about you"** list in the settings/profile area: `fact_text`, when it was last
heard, and a per-row delete. A memory that silently changes results and cannot be inspected is the
single worst outcome of this feature. Ship it in the same step as the injection.

---

## Implementation plan

Each step is independently shippable and testable. Steps 1–5 are TODO line 121; 6–10 are line 122.

1. **Migration A** — `prompt_exchanges` table, `exchange_turn` enum, four RLS policies, the trim
   trigger. Verify by hand in SQL: six inserts leave five rows; another user's rows are invisible.
2. **`src/lib/history/exchange-store.ts`** — `appendExchange`, `getRecentExchanges`, `clearExchanges`,
   all taking the session-aware server client like `preference-store.ts` does. Unit tests mirroring
   `tests/preference-store.test.ts`.
3. **`/api/prompt-history` route** — `POST` (append), `GET` (last 5 within 30 days), `DELETE` (clear).
   All three answer benignly (204 / `[]` / 204) when signed out or Supabase is unconfigured. Route tests.
4. **Wire `PlacePromptPanel`** — hydrate on mount when signed in; fire-and-forget POST inside
   `logExchange`. Panel tests: hydrated rows render in order; a signed-out mount fetches nothing and
   behaves as today; a failing POST surfaces no error and does not block the local append.
5. **"Clear history" control** wired to `DELETE`, plus the persistence toggle (see open question).
   **Ships TODO line 121.**
6. **Migration B** — `standing_facts` table, unique `(user_id, fact_key)`, RLS, `set_updated_at`.
7. **`src/lib/preferences/fact-extractor.ts`** — pure only: `FACT_EXTRACTION_SYSTEM_PROMPT`,
   `parseStandingFacts`, `normalizeFactKey` (extracting the mark-stripper out of
   `geocode-plausibility.ts` into a shared util), `scoreFact`, `selectFactsForPrompt`. No network,
   100% unit-testable — including the scoring curve at 0/60/120/365 days and the `MIN_FACT_SCORE`
   boundary. Shippable with zero behaviour change.
8. **`extractStandingFacts` in `gemini-client.ts` + `fact-store.ts`** (`learnFactsFromText`,
   `getStandingFacts`, `deleteFact`, cap-eviction). Wire the write into the renamed `learnFromText`
   in `extract-places/route.ts` and `walk-feedback/route.ts` under the existing gate. Nothing reads
   the facts yet — writes only, so this ships safely and lets real rows accumulate before step 9
   changes any output.
9. **Injection** — optional second arg on `extractPlaceNames`, the new system-prompt rule, the read +
   score + select in `extract-places`. Tests: with facts, the `contents` sent carries the block; with
   none, the call is identical to step 8's; a failed fact read falls through to a plain extraction.
10. **"Things I remember about you" UI** with per-row delete. **Ships TODO line 122.**
11. *(Optional, later)* Merge the preference and fact passes into one Gemini call if the second call
    proves costly; POI-level filtering from importance-3 facts.

---

## Open questions for Ariel

- Persistence toggle: separate from `preferenceLearningEnabled`, or reuse it? (Recommendation above:
  separate, default on.)
- Is 5 still the right *persisted* window? Five is right for a session buffer; a returning walker
  might want 10 — the cost is one number in two places.
- Should signed-out walkers get `localStorage` persistence as a middle tier, or does persistence
  stay a signed-in feature? (Recommendation: signed-in only. A second storage backend for the same
  panel doubles the state paths for a walker who has not asked us to remember anything.)
- Contradiction handling for facts — accept "stale facts decay and can be deleted by hand" for v1?
- Is a second Gemini call per opted-in prompt acceptable, or should steps 8–9 go straight to the
  merged single-call version?
