# PLAN — walk feedback from the phone test (2026-11-18)

Planned by Opus (read-only, from code; nothing run). Branch `feat/walk-detail`. Rules: surgical, no new abstractions, no production deploy, migration D untouched. Known failing test: `tests/assistant-chat-undo.test.tsx`.

## 1. Free text in the in-walk chat → canned hint (real gap, by design)
- `useWalkChat` tries `/api/walk-assistant` (owner-only, 403 `notowner` unless id in `LLM_OWNER_USER_IDS`, `route.ts:72`), then falls back to the keyword parser (`walk/chat/intent.ts:152-175`: find/skip/shorter/longer/head-back) and `/api/walk-chat` (5-intent classifier). Unknown → help text (`reply.ts:161`). Even for the owner, tools are only add/skip/head-back.
- Sol (`/api/assistant`) is open to all signed-in users and has `stay_in_area` etc.
- **Fix:** on `unknown` for a signed-in walker, show "That needs a new plan. Send it to Traike?" + button → opens Details + chat with the text prefilled (walker taps Send). New action kind `ask-planner` in `reply.ts`; branch in `onAction` (`WalkPlannerApp.tsx:3527-3540`) before the head-back `else`. Optional owner-only `propose_replan` tool in `walk-turn.ts`. Depends on 7.2.
- **Tests:** `use-walk-chat`, `walk-chat-reply` (en/he copy), `walk-planner-app` (tap opens chat, textarea prefilled).

## 2. "Best route from here" — no bug
- "Back to my route" (`runLocalRejoin`, `:2321-2400`, `walk/rejoin.ts`) rejoins at the nearest sensible point (≤500 m, never past next unvisited stop).
- "Best route from here" (`runDeviationTriggeredRebuild`, `planner-actions.ts:113`) is a fresh `/api/walk-plan` from the current fix; no `fixedOrder`, so stops are re-ordered and non-fitting stops dropped unless pinned.
- Decision D4 below.

## 3. "Rebuild route from here" pill unreliable (real bug)
- Renders only when `walkMode && isOffRoute && offRouteDismissed` (`:4544-4556`); hidden while card/callout up or after the 90 s ask times out; dismissal resets within 30 m of the line.
- 4-min re-ask timer (`:619-627`) ignores `offRouteDismissedRef`; on timeout `runLocalRejoin()` (`:2476`) can become a full rebuild without consent (>400 m, `:2342`).
- **Fix:** (1) pill condition → `walkMode && isOffRoute && offRouteCard === null && optionsOffer === null && !isWalkPlanLoading`; (2) `:623` return early if `offRouteDismissedRef.current`; (3) label into `walkCopy.offRouteCard` en/he.
- **Tests (`walk-collapse.test.tsx`):** pill visible when callout outranks card / after timeout; hidden while rebuilding; after dismiss + 5 min off route no dialog and no reroute/walk-plan calls.

## 4. Private paths / house stairs — accept
ORS routes on OSM ways only; Google basemap doesn't draw many OSM footpaths. No access filtering in our code; `avoid_features: ["steps"]` only for strollers (`walk/access.ts:23`). Unverified: ORS foot profile normally blocks `access=private`. Recommend fixing the tag in OSM; optional "avoid stairs" setting (D9).

## 5. Route line collapsed to a stub (real bug)
- (a) Every splice sets `lastSegmentIndexRef.current = null` (`:701`, `:2127`, `:2388`) → next fix searches the whole line (`deviation-detector.ts:70-79`); on a loop it can match the last leg and `remainingRoute` draws only that. Same bug was fixed at walk start (`:2541-2560`) but not for splices.
- GPS link: the 4-min re-ask timer keeps firing during a GPS gap; its timeout runs `runLocalRejoin` from a stale fix, splices a connector from where he was, clears the anchor.
- (b) While off route the match and drawn line (`:2860-2865`) keep moving, dropping unvisited stops near a loop.
- GPS loss alone clears nothing (pace checker uses fix timestamps).
- **Fix:** set anchor to `0` instead of `null` at the 3 sites; only `setRemainingGeometry` when `!offRoute`; automatic `runLocalRejoin` does nothing if last fix >20 s old; plus issue 3 step 2. Follow-up (separate): freeze `matchedRef` while off route.
- **Tests:** loop route splice then fix near final leg keeps line to next stop; stray toward tail never shortens the line; 60 s no fixes + timeout → no reroute call.

## 6. No clear "walk finished"; End button confusing (real UX bugs)
- HUD "סיום" → "לסיים?" for 3 s → `handleEndWalk` sets `finishData`, but `WalkFinishCard` renders in the aside (`:3970`) which is off-screen on a phone → "nothing happened".
- Second candidate: slow-pace answer "Finish early (head back)" (`companion/producers/pace.ts:70`) → `runThemedOption("short")`; with no option `collapseFlow.offerDifferent()` returns empty silently (`:2090`, `useCollapseFlow.ts:97`).
- Nothing detects completion.
- **Fix:** auto "walk finished" alert (`walkPhase==="walking" && !isOffRoute && remainingM<=40 && all stops visited`) with "Finish walk" / "Keep walking"; move `WalkFinishCard` into the map section; clearer he labels (`endWalk: "סיום הליכה"`, `endConfirm: "לסיים את ההליכה?"`), confirm window 5 s; notice instead of silent no-op for head-back. Depends on 5.
- **Tests:** `walk-hud` labels + 4 s window; end-of-walk alert and visible finish card; head-back notice.

## 7. "I'm walking 2 km/h, re-estimate"
- (a) Mid-walk Sol is sent `origin`, `walking:true`, wishlist `queued` — not the walk's stops (`AssistantChat.tsx:461`, `WalkPlannerApp.tsx:3899`, `route.ts:187`) → plans a new walk; taste note explains the unasked restaurant.
- (b) Mid-walk `onBuild` (`:3923-3927`) ignores Sol's pace; uses original pace and remaining minutes (floor 15) → optimizer drops stops ("partial"); zero stops → "Couldn't update your route" (`:1599`) ("not shown"). Or Sol asked first and returned `action: null` (`prompt.ts:19`).
- (c) `prompt.ts:13` offers "later start / pass-by" for closed stops; `turn.ts:207-230` always appends "⚠ Could not fully verify" for not-checked rules; hours become not-checked when no data (`schedule-rules.ts:64`).
- (d) "Resting for today" = any `LlmBudgetExceededError`: free call cap 60/day (hard-coded, `budget.ts:9`), free $0.25/day (`LLM_CAP_USD_FREE`), global `LLM_DAILY_BUDGET_USD` (default 3), or usage store failing closed in production. Owner exempt only via `LLM_OWNER_USER_IDS`. Logs don't say which cap hit — unconfirmed.
- **Fix:** 1) set `LLM_OWNER_USER_IDS` in the test env, document in `.env.example`, `console.warn` with `error.reason` in the three 429 branches, optional `LLM_CALL_CAP_FREE`; 2) while walking pass unvisited stops as `queuedPlaces` and change the walking note ("keep these stops and order; pace/time → set_walk_params, estimate_walk, build_walk; never add unasked stops"); 3) `paceExplicit` on `AssistantBuild`, use Sol's pace and pin Sol's stops; 4) drop not-checked `open_hours` from the footer, limit hours talk to chosen stops; 5) optional offline "N km/h" command.
- **Tests:** walk-plan body has pace 30 + pinned ids; assistant request `queued` = remaining stops; walking-note text; call-cap override; footer without `open_hours`.

## Build order
0 config (owner ids, caps) → 5 → 3 → 6 → 7 code → 1 → 2/4 (decisions only). After each: tests, `tsc`, lint, deps check, `graphify update .`. Codex review for walk-engine changes (3, 5, 6).

## Owner decisions
D1 which env did the phone hit; add ids to `LLM_OWNER_USER_IDS`; env-overridable call cap? · D2 hand-off to Sol: prefill+tap (rec.) or auto · D3 keep `/api/walk-assistant` owner-only · D4 "best route": re-order or keep original order · D5 never re-ask after "I know where I'm going" (rec.) · D6 finish at 40 m + all stops visited, always require tap · D7 End: 2 taps/5 s or sheet · D8 drop "(no data)" hours footer · D9 stairs: OSM only or "avoid stairs" setting · D10 mid-walk Places lookups per remaining stop OK; pin Sol's stops even if over time · D11 offline "N km/h" command.
