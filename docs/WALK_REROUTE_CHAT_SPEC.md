# Spec — "Building walk…" hang (C), shorter-route chip (A), in-walk chat + silent-failure fix (B)

Design pass by Opus (read-only), 2026-10-14. Source of truth for the builders. `WPA` = `src/components/planner/WalkPlannerApp.tsx` (~3300 lines: NEVER rewrite it; small targeted Edits only; new logic goes in new files). Never commit, never deploy, don't touch the user's dev server. Constraints: no Google APIs; no raw GPS/names/start time to any LLM; untrusted text only in `<data>` blocks; every LLM call through `runLlm` with ctx + R3 caps; Luna (tier 1) for chat, never Sol; keep `npx vitest run` green and `npx tsc --noEmit` clean. Every new test needs a mutation check (remove the guard, watch the test fail, restore it).

## Diagnosis

### C — stuck on "Building walk…"
No path leaves `isWalkPlanLoading` true forever (`buildWalkRequestIdRef` bumps at WPA:880 handleBuildWalk with its own `finally` at ~1009-1017, handleEndWalk ~712 clears itself, unmount ~2297). The stuck screen is a request really running up to 120 s (`WALK_PLAN_TIMEOUT_MS`). Fast-pace "Add a stop" is the slowest: it sends `fillRemainingTime: true` so `canRetry` is true (`walk-plan/route.ts` ~574-578) → up to `MAX_PLAN_ATTEMPTS = 3` discovery passes, each up to 120 s of Overpass (3 mirrors x POST/GET x 20 s, `overpass-client.ts`). `fetchOrs` (`src/lib/api/ors-client.ts`) has NO timeout. Tracking is already torn down; the map overlay shows no status and there is no cancel; only the disabled sidebar button says "Building walk…" (`WalkCompanionPanel.tsx` ~503-508).

### B — "no response from the AI"
1. `submitFollowUp` (`PlacePromptPanel.tsx` ~594-670) writes its only reply into the collapsed "Recent requests" log, removes the question box, calls `onAcceptAttractions`; button says "Build my walk" (~868-874) but builds nothing. With 0 stops nothing changes on screen.
2. No client timeout on `/api/extract-places` (fetches ~479, ~604).
3. `res.json()` unguarded (~489, ~616): a 502/504 HTML body shows "Unexpected token <".
4. No in-walk text box (`PlacePromptPanel` hidden while walking, WPA ~2798).
5. Budget/rate limits are NOT silent (429 with message).

### A — shorter route on route
No such code. Seam: `/api/reroute` (one ORS directions call per candidate) + `spliceRoute` (`src/lib/walk/rejoin.ts`).

## Package C — fix the stuck rebuild (touches WPA; Phase 1 owner of WPA)
Files: WPA, `src/lib/api/ors-client.ts`, `src/app/api/walk-plan/route.ts`, tests.
1. `ors-client.ts`: `export const ORS_TIMEOUT_MS = 15_000`; in `fetchOrs` use `AbortController` + `setTimeout` cleared in `finally` (NOT `AbortSignal.timeout`, fake timers can't drive it); apply `signal: init?.signal ?? controller.signal` AFTER `...init`.
2. `walk-plan/route.ts` ~574: `const canRetry = !(explicit && fill !== true) && heading === undefined;` (only the forward-only add-a-stop sends `heading`; one discovery pass).
3. WPA: constants `MIDWALK_REBUILD_TIMEOUT_MS = 45_000`, `REPLAN_CANCELLED_MESSAGE = "Kept your current route."`, `const cancelBuildRef = useRef<(() => void) | null>(null)`. In `handleBuildWalk`: `let cancelled=false; const controller=new AbortController(); cancelBuildRef.current = () => { cancelled=true; controller.abort(); }; deadline = setTimeout(() => controller.abort(), snapshot ? MIDWALK_REBUILD_TIMEOUT_MS : WALK_PLAN_TIMEOUT_MS)`; in the catch snapshot branch: `revertToSnapshot(snapshot); setWalkTrackingMessage(cancelled ? REPLAN_CANCELLED_MESSAGE : REPLAN_FAILED_MESSAGE)`; in `finally` inside `if (requestId === current)`: `cancelBuildRef.current = null`. `handleEndWalk`: call `cancelBuildRef.current?.()` before the request-id bump (the bump then makes the catch return early so nothing reverts).
4. Overlay card while rebuilding: first branch inside `if (walkMode)` at WPA ~2373 (make the existing `if (selectedCallout)` an `else if`): when mid-walk rebuild and `isWalkPlanLoading` → `walkAlert = { id:"rebuilding", tone:"info", title:"Updating your route…", body: isWalkPlanSlow ? "Still working, this one is slow." : undefined, actions:[{label:"Keep my current route", primary:true, onClick: () => cancelBuildRef.current?.()}] }`. (Define `rebuildingMidWalk` as "a snapshot exists / auto rebuild in progress"; add a state/ref set in handleBuildWalk when `snapshot` is non-null.)
Tests: `tests/ors-client-timeout.test.ts` (fetch mock settles only on abort; advance 15 s → rejects; mutant: drop signal). `tests/walk-planner-rebuild-timeout.test.tsx` (copy harness from `walk-planner-silence.test.tsx`; deviation mode `ask`, simulated stray, "Redraw"; walk-plan stub settles only on abort): (i) after 45 s the REPLAN_FAILED text and "End walk" both shown (mutant: 120 s deadline); (ii) "Keep my current route" → REPLAN_CANCELLED shown, loading cleared (mutant: unwired onClick); (iii) End walk mid-rebuild → stub `signal.aborted === true` (mutant: remove cancel call). `tests/walk-plan-api.test.ts` new case: `heading` + `fillRemainingTime` + poor plan → `fetchAttractions` called exactly once (mutant: drop `heading === undefined`). Existing 120 s user-build test (walk-planner-app ~307-348) stays green.

## Package A — shorter route on route (recommended: one-tap chip, NOT auto-apply)
Reason: ORS "recommended" lines are often the pleasant route; a chip can't thrash on GPS noise; deviation case is already auto (R4).

New `src/lib/walk/shortcut.ts` (pure, fix-clock time):
```ts
export const SHORTCUT_MIN_SAVING_M = 150, SHORTCUT_MIN_SAVING_RATIO = 0.15,
  SHORTCUT_MIN_SAVING_S = 120, SHORTCUT_STREET_FACTOR = 1.15,
  SHORTCUT_MIN_CROW_M = 200, SHORTCUT_MAX_CROW_M = 1_500,
  SHORTCUT_CHECK_COOLDOWN_MS = 90_000, SHORTCUT_MIN_PROGRESS_M = 150,
  SHORTCUT_MAX_CHECKS_PER_WALK = 12, SHORTCUT_OFFER_TTL_MS = 45_000,
  SHORTCUT_OFFER_MAX_DRIFT_M = 40, STOP_ON_LINE_M = 80;
export interface ShortcutTarget { point: Coordinates; segmentIndex: number; alongM: number; stopId: string|null; label: string|null }
// stops = unvisited plan stops. Project EACH onto geometry from segmentIndex forward
// (closestPointOnSegment). Nearest ahead (alongM >= 0) wins. If that stop's offset > STOP_ON_LINE_M
// return null (can't prove nothing is skipped). No stops left -> target = last vertex (finish), stopId null.
export function shortcutTarget(geometry, segmentIndex, matchedPoint, stops): ShortcutTarget | null;
export const requiredSavingM = (alongM, speedMps) => Math.max(SHORTCUT_MIN_SAVING_M, SHORTCUT_MIN_SAVING_RATIO*alongM, SHORTCUT_MIN_SAVING_S*speedMps);
// local pre-filter, no network: no street path beats ~1.15 x crow
export const worthChecking = (alongM, crowM, speedMps) => crowM >= SHORTCUT_MIN_CROW_M && crowM <= SHORTCUT_MAX_CROW_M && alongM - crowM*SHORTCUT_STREET_FACTOR >= requiredSavingM(alongM, speedMps);
export function acceptConnector(alongM, connectorM, speedMps): {savingM, savingMin} | null;
export class ShortcutGate { canCheck(atMs, geometry: unknown, walkedM, stopId): boolean; recordCheck(atMs, geometry, walkedM): void; decline(geometry, stopId): void; reset(): void }
```
Copy in `shortcut.ts`, EN + HE: title "Shorter way to {stop}" / "יש דרך קצרה יותר אל {stop}" (finish: "…to the finish" / "…לסיום"); body "Saves about {min} min ({m} m)." / "חוסך בערך {min} דק׳ ({m} מ׳)."; buttons "Take it" / "כן, בדרך הקצרה" and "Keep my route" / "להישאר במסלול".

New `src/lib/hooks/useShortcutOffer.ts` (pattern of `useCollapseFlow`: deps ref, request id, refs so the per-fix closure is never stale). Deps: `getContext()` → `{geometry, segmentIndex, matchedPoint, position, atMs, walkedM, stops, speedMps, blocked} | null`; `onApply(spliced, atMs)`; optional `doFetch`. Returns `{offer, feed, accept, dismiss, clear, endWalk}`.
```
feed():
  ctx = getContext(); if !ctx return
  if pending:
    if ctx.geometry !== pending.geometry || dist(ctx.position,pending.from) > DRIFT || ctx.atMs - pending.atMs > TTL:
      gate.decline(pending.geometry, pending.target.stopId); pending=null; setOffer(null)
    return
  if ctx.blocked || inFlight return
  t = shortcutTarget(...); if !t return
  if !worthChecking(t.alongM, dist(ctx.position,t.point), ctx.speedMps) return
  if !gate.canCheck(ctx.atMs, ctx.geometry, ctx.walkedM, t.stopId) return
  gate.recordCheck(...); id=++req; inFlight=true
  res = POST /api/reroute { from: ctx.position, candidates: [t.point] }   // 1 ORS call
  inFlight=false; if id!==req return
  if !res.ok or geometry.length<2 return            // opportunistic: silent by design
  v = acceptConnector(t.alongM, data.distanceMeters, ctx.speedMps); if !v return
  if getContext()?.geometry !== ctx.geometry return
  pending = {geometry: ctx.geometry, target:t, connector:data.geometry, from:ctx.position, atMs:ctx.atMs}
  setOffer({id:`shortcut-${id}`, stopName:t.label, ...v})
accept(): re-check same geometry and drift<=40 m else clear+return false; onApply(spliceRoute(pending.geometry, t, pending.connector), ctx.atMs)
dismiss() = decline + clear;  clear() = ++req + drop pending/offer;  endWalk() = clear + gate.reset()
```
Stops are never dropped (splice ends at the projection of the nearest unvisited stop; refuses if >80 m off the line; pins are just stops). ORS budget: ≤12 calls/walk, ≤1 per 90 s, only after 150 m progress, local pre-filter first; existing `orsRateLimiter` applies; no polling loop.

WPA wiring (AFTER package C is merged; Phase 2): instantiate the hook next to `useCollapseFlow` (WPA ~533). `getContext` returns null when `walkTrackerRef.current === null`; `blocked = isOffRouteRef.current || rejoinInFlightRef.current || collapseFlow.isCollapsed() || deviationConfirmationRef.current || (cardVisibleRef.current && !shortcut.offer)`; `walkedM` from `progressAlong`; `speedMps = 1000/(60*pace)`. Add `shortcut.feed();` at end of `onPositionUpdate` (after ~1985). `onApply` repeats the splice block of `runLocalRejoin` (~1525-1537) as a new local `applySplicedRoute` (do NOT refactor the two existing call sites). Alert branch after `companion.card`, before `paceAdvisory`. Call `shortcut.clear()` in `stopWalkTracking`, `shortcut.endWalk()` next to both `collapseFlow.endWalk()` calls (~728, ~861).
Tests: `tests/shortcut.test.ts` — target never lies past the nearest unvisited stop and is null when that stop is >80 m off line (mutant: drop offset check); `worthChecking` false on a straight route (mutant: drop STREET_FACTOR); accept/reject exactly at the three saving thresholds; gate cooldown/progress/cap 12/decline each block alone (mutant: remove each guard). `tests/use-shortcut-offer.test.tsx` (renderHook, injected doFetch) — offer appears; moving 41 m withdraws it and makes no second fetch; `accept` returns a splice starting with the connector; geometry change during fetch → no offer.

## Package B — chat + silent-failure fix

### B1 `PlacePromptPanel.tsx`
Add `followUpReply` state rendered as `<p role="status">` (e.g. "Got it: 180 min, finish within 1 km. Press **Build My Walk** below."; with 0 stops add "…it will pick the places."). Rename follow-up button to "Use these answers" (changes 8 selectors in `tests/place-prompt-panel.test.tsx` lines ~802-1263, labels only). Add `EXTRACT_TIMEOUT_MS = 45_000` with `AbortController` on both fetches; on abort show "That took too long. Try naming fewer places, or try again." `await res.json().catch(() => ({}))`; a 429 with no body shows the rate-limit wording. New `tests/place-prompt-followup.test.tsx`: reply visible after follow-up (mutant: remove setter); timeout message under fake timers (mutant: remove timer); 502 with HTML body shows the friendly text.

### B2 pure intent/reply
`src/lib/walk/chat/intent.ts`: `parseIntent(text, stops)` → `{intent: "find"|"skip"|"shorter"|"longer"|"head-back"|"unknown", amenity?: AmenityKind, stopId?: string}`. Keyword tables EN + HE; Hebrew uses substring matching NOT `\b`. Precedence: skip > find > head-back > shorter > longer. Skip: "this/next/הזאת/הבאה" = first remaining stop; else match a stop name as case-insensitive substring ≥3 chars.
`src/lib/walk/chat/reply.ts`: `resolveChat(intent, ctx, lang)` → `{text, actions: ChatAction[]}`, `ChatAction = {kind:"detour", item: AmenityItem} | {kind:"drop", stopId} | {kind:"add-stop"} | {kind:"head-back"}`. find: nearest amenity of that kind within 600 m, else "I don't see a {kind} near your route yet." shorter: drop the last unvisited UNPINNED stop if ≥2 remain, else offer head-back. skip: if it is the last stop, offer head-back. unknown: help text with example commands. Every action needs a tap. EN + HE templates; the model never writes reply text.

### B3 server
`src/lib/llm/tasks/walk-intent.ts`: task `"answer-intent"` (already reserved in `types.ts`/T1 block), tier 1, `maxOutputTokens 80`; walker text and numbered stop names ONLY in `untrusted` blocks; schema `{intent, amenity|null, stopIndex|null, injectionDetected}`; `parse` rejects out-of-range `stopIndex`/bad enum.
`src/lib/api/rate-limit.ts`: `chatRateLimiter = [{6/min},{30/day}]`; add to `tests/setup/rate-limit-reset.ts`.
`src/app/api/walk-chat/route.ts`: (1) limiter else 429; (2) validate `text` 1-200 chars, `stops` ≤12 names ≤80 chars, `lang` en/he else 400; (3) Supabase `getUser`, none → 401 `{code:"signin"}`; (4) `runLlm(task, {userId, ip: callerKey(request)})`; (5) `LlmBudgetExceededError` → 429 `{code:"budget", error}`; (6) any other error → 200 `{intent:"unknown"}`. Never reads coordinates, facts or habits.

### B4 client
`src/lib/hooks/useWalkChat.ts`: state messages (last 6), `pending`, `llmUsed`. `send(text)`: echo + `parseIntent`; known intent → instant reply; unknown & anonymous → help text + "Sign in for free-form questions." (no fetch); unknown & `llmUsed >= MAX_CHAT_LLM_PER_WALK (15)` → "You've used this walk's 15 questions. Quick commands still work: cafe, skip, shorter." (no fetch); else "Thinking…" and POST with 10 s abort. EVERY outcome sets a reply: 401, budget, 429, network failure, timeout each have their own text.
`src/components/walk/WalkChatBox.tsx`: "Ask"/"שאלו" pill expanding to an input (`maxLength` 200), last 3 exchanges (`dir="auto"`), action buttons used up after one tap, `pointer-events-auto`.
`WalkHud.tsx`: optional `chat?: ReactNode` rendered between alert and pill row.

### B5 WPA wiring (Phase 2, after A wiring)
`runAmenityDetour` gets optional `preset?: AmenityItem` (`const pick = preset ? {item: preset} : amenityForAnswer(...)`). `getContext` builds remaining stops (with pins) and amenities (`amenityItemsFromPlaces(discovery.amenities(), p => discovery.frameOf(p)) + foodAmenityItems(discovery.items())`; stays on device). Dispatcher: detour → `runAmenityDetour(item.kind, getCompanionSnapshot(), item)`; drop → `runDropStopsRebuild([id])`; add-stop → `runPaceTriggeredRebuild("sustained-fast-pace")`; head-back → `runThemedOption("short")`. Pass `chat={<WalkChatBox …/>}` to `WalkHud` (WPA ~3307). Reset chat in `handleEndWalk`.

Tests: `walk-chat-intent.test.ts` (EN+HE tables; mutant: remove HE keywords); `walk-chat-reply.test.ts` (never drops a pinned or the last stop; mutants: remove pin filter, remove ≥2 guard); `walk-chat-api.test.ts` (anonymous → 401 and runLlm mock never called [mutant: remove auth gate]; 7th request/min → 429 [mutant: remove limiter]; budget → `code:"budget"`; serialized task contains no coordinate digits and walker text only inside `<data>` [mutant: put text in `user`]); `use-walk-chat.test.tsx` (request 16 makes no fetch and shows cap message [mutant: remove cap]; rejected fetch still shows a reply [mutant: swallow error]).

## Parallelism / order
Phase 1 (parallel, file-disjoint): Builder-1 = package C in full (only one touching WPA in phase 1); Builder-2 = A-core (`shortcut.ts`, hook, tests; no WPA); Builder-3 = B1-B4 incl. `WalkHud.tsx` (no WPA). Phase 2 (sequential, everyone edits WPA): C merged → A wiring → B wiring. Do not edit `src/lib/hooks/index.ts`; import hooks by path. Then full `npx vitest run` (expect 2306 + new) + `tsc`; add an R5 entry to the Cycle log in `docs/NEXT_PHASE_DECISIONS.md`.

## Risks / only a real pass can verify
Risks: A's 80 m stop-projection rule may refuse every shortcut for big park polygons (safe, but feature never shows); splice at a stop's projection must still trigger `VisitTracker` (100 m); chat shares the daily LLM call cap of 60 for free signed-in walkers (30/day limiter keeps headroom); per-walk chat cap is client-side only (server daily limiter + dollar caps are the hard bound); 45 s may cut a slow-but-successful add-a-stop (walker keeps route, can retry).
Real pass only: how often ORS finds a ≥150 m saving; whether timers survive phone sleep during a rebuild; Luna accuracy/cost/latency on real Hebrew phrasing; Overpass mirror behaviour under the single pass; HUD chat + card fit on a small screen while walking.
Left out on purpose: auto-applying shortcuts; passing server abort through to Overpass; model-written replies; server-side walk id; "Build my walk" triggering the companion form; tracking kept alive during a rebuild; undo after a shortcut.

## Cycle log
(builders append here)

- Package C (builder, 2026-10-14): `ORS_TIMEOUT_MS` 15 s in `fetchOrs`; walk-plan `canRetry` also requires `heading === undefined`; WPA: `MIDWALK_REBUILD_TIMEOUT_MS` 45 s, `cancelBuildRef`, "Updating your route…" overlay card with "Keep my current route", `REPLAN_CANCELLED_MESSAGE`, `handleEndWalk` cancels. Reused the existing `rebuildingMidWalk` state (no new state). Tests: `ors-client-timeout`, `walk-planner-rebuild-timeout` (3), 2 cases in `walk-plan-api`; 5 mutants each killed and restored. Not verified: real device / real ORS / phone sleep.

- A-core (Builder-2, 2026-10-14): added `src/lib/walk/shortcut.ts`, `src/lib/hooks/useShortcutOffer.ts`, `tests/shortcut.test.ts`, `tests/use-shortcut-offer.test.tsx` (29 tests, tsc clean, all 20 mutants killed). No WPA/hooks index edits. Hook API: `useShortcutOffer({getContext, onApply, doFetch?})` -> `{offer, feed(): Promise<void>, accept(): boolean, dismiss, clear, endWalk}`; `ShortcutContext.stops` is `ShortcutStop[] = {id, point, label}`. Spec notes: first check needs 150 m walked (gate baseline 0); progress uses |walkedM - last| so a rebased walkedM after a splice still works; a stop whose closest route point is behind the walker is ignored (not treated as "no target").

### B1-B4 (Sonnet builder, 2026-10-14)
Built: `PlacePromptPanel.tsx` (follow-up reply `<p role="status">`, button now "Use these answers", `postExtractPlaces` helper with 45 s abort and `res.json().catch`, 429 wording), `src/lib/walk/chat/{intent,reply,chat-copy}.ts`, `src/lib/llm/tasks/walk-intent.ts`, `chatRateLimiter` (+ reset in `tests/setup/rate-limit-reset.ts`), `/api/walk-chat`, `useWalkChat`, `WalkChatBox`, `WalkHud` optional `chat` slot. No WPA edits. Tests: `place-prompt-followup`, `walk-chat-intent`, `walk-chat-reply`, `walk-chat-api`, `use-walk-chat`, `walk-chat-box`; 8 selectors renamed in `place-prompt-panel.test.tsx`. Every guard mutation-checked (follow-up setter, abort timer, `.catch`, 429 wording, HE keywords, skip branch, pin filter, >=2 guard, last-stop guard, 600 m radius, auth gate, limiter, lang validation, text in `user`, stopIndex range, cap, swallowed error, anonymous gate). Deviations/ambiguities: `ChatAction` carries an extra `label`; the task's `stopIndex` is a 1-based number in the model schema and returned 0-based; skip of a named pinned stop is allowed (only "shorter" avoids pins). B5 wiring still to do.

### Cycle 2 (Sonnet builder, 2026-10-14) - fixes for the Opus review
- M1: `useShortcutOffer` stores a wall-clock `wallAt` on each offer; `accept()` rejects (clears, false) past `SHORTCUT_OFFER_TTL_MS`; new `expire()` is called from WPA `handleWalkTick`, so low-accuracy or missing GPS cannot leave a stale chip up.
- M2: chat amenities are built ungated by habit consent via `src/lib/walk/chat/amenities.ts` (`chatAmenityItems`: OSM amenities + `foodAmenityItems`), used by `useWalkChat.getContext`. Bench/shade can never resolve (map tags yield only water/toilets), so `resolveChat` now says "I can't look up a bench/shade yet" instead of "not found".
- S1: `intent.ts`: Hebrew matches whole tokens with one optional prefix letter (ב ל ה ו מ כ), so "אצל", "מצלמה", "שמים", "פעמים", "חמים" no longer hit shade/water; bare "ארוך" removed (needs "ארוך יותר"/"יותר ארוך"); `drop`, "dont want", "no need", "לא רוצה", "אין צורך" are weak skips that need a stop name or a stop word, otherwise find/shorter/etc. win; "loo"/"wc" are whole English words. Added "תדלג", "נחזור", and "העצירה"/"התחנה" as filler.
- S3: `ShortcutGate` remembers the geometry of the last check; a different geometry measures the 150 m progress from 0.
- S5: offer carries `shown`; WPA calls `markShown()` once the chip is the rendered card; a lapse (drift/TTL/expire) declines the stop only if shown. `dismiss()` always declines.
- S6: `handleBuildWalk` (!autoResume) now calls `walkChat.reset()` and `shortcut.endWalk()` is correctly indented.
- S7: `PlacePromptPanel` clears `followUpReply` on main-prompt edit and on a new submit.
- S8: `ShortcutGate.canCheckGlobal` (cap, cooldown, progress) runs before `shortcutTarget` in `feed()`.
- Tests added: `walk-chat-amenities`; cases in `shortcut`, `use-shortcut-offer`, `walk-chat-intent`, `walk-chat-reply`, `place-prompt-followup`. Mutants killed (restored each time): accept TTL, expire no-op, always-decline, global pre-check removed, geometry baseline, ungated food, bench/shade reply, 8 intent mutants, 2 prompt-panel clears. Not covered by tests: the WPA wiring itself (expire in tick, markShown effect, walkChat.reset, chatAmenityItems call) - S2.

### Cycle 3 (Sonnet builder, 2026-10-14) - fixes for the second Opus review (zero must-fix)
- SF1 `intent.ts`: shared `wordRegex`; Hebrew verb stems (דלג, קצר, חזור, וותר) accept prefix letters ת/נ/י/ל/ו and a ו/י ending; nouns keep the single ה/ב/ל/ו/מ/כ prefix. Explicit inflected forms added: צמאה/ים/ות, רעבה/ים/ות, עייפים/ות, קצרה/ים/ות, "שירותי ציבור", "ארוך/ה מדי", "תחזור", "וותר"; "זה", "בוא", "בואו" are filler (so "בטל את זה", "בוא נדלג" skip the first stop).
- SF2: skip words are deleted longest-first with the same whole-token regex (no stray "ת" from "תדלג"); Hebrew tokens under 2 letters are ignored.
- SF3: for a weak skip, amenity words are not matched against stop names ("drop by a cafe" with a stop "Cafe Xoho" stays a cafe search); a full name or a non-amenity word still targets the stop.
- SF4 `WalkPlannerApp.tsx`: `markShown()` only when `optionsOffer === null` (WalkHud renders the options sheet over the alert).
- Nits: amenities test asserts `toContain("cafe")`; chat `getContext` returns null without a route and uses `chatAmenityItems(route.discovery)` only (dead `snap.tick.amenities` fallback removed).
- Tests: rows in `walk-chat-intent.test.ts` (HE table, bare-skip list, weak-skip/cafe-stop case, "ארוך מדי"). Mutants killed and restored: verb prefixes off, raw-substring skip deletion (+ no token-length filter), amenity-token filter off, "זה"/"בוא" filler off, explicit forms removed. Not covered by a test: the two WPA edits (SF4 markShown guard, getContext null/no-fallback) - needs a simulated walk with a live shortcut offer and a collapse offer at once; not feasible with the rebuild-timeout harness.
