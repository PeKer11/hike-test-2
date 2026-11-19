# Loops, mid-walk reroute, and "what we have walked so far": root causes and fix plan

Date: 2026-11-19 · Branch: `feat/walk-detail` · Status: investigation only, no source changed.

**Owner report (Hebrew, paraphrased):**
1. An out-and-back route came back. He wants circular loops strongly preferred, out-and-back only as a last resort.
2. Rebuilding the route in the middle of a walk (for example after a deviation) can crash. It should produce a genuinely new route from where he stands, ideally closing a loop to the start, and survive off-route, GPS jitter, offline, no places, and almost no time left.
3. He wants an option to **see what we have walked so far** (breadcrumb, distance, time), kept across a rebuild.

**Read first:** `docs/ASSISTANT-EXTEND-ROUTE-PLAN.md` (not repeated here) and the sister plan `docs/ASSISTANT-SPEED-PACE-PLAN.md`. The extend-route work (`src/lib/assistant/current-walk.ts`, `timeStated`, `minutesFromNow`) is being built in the same files right now, so **line numbers are from the working tree on 2026-11-19 and may drift a few lines**. Function names are the stable reference.

Evidence labels: **Confirmed** = read in code and traced; **Likely** = fits the code and the report; **Not confirmed** = could not be shown by reading. Honest limit: **I could not find a literal uncaught exception** in the mid-walk rebuild path by reading. What I found are state-destroying paths, silent wrong routes and a structural teardown-before-success design that turns every blip into a failure. Section 2.2 lists them, and section 6 has a harness to catch a real exception if one exists.

---

## 0. Summary

1. **Loops are never the default.** A loop happens only when the walker says "back at the start" (`endDistanceKm === 0`). Even then the router returns the shortest way, which for one or two stops is **the same streets back**, and repeats are only penalised when `no_repeat` is on. The route-quality code already measures `repeatedKm` and `closesLoop` on every route and throws the answer away (L1-L3).
2. **The API's loop mode is dead code, and mid-walk it closes to the wrong place.** The planner's `returnToStart` can never be true through `/api/walk-plan` (the 0 is coerced away first), so a loop plan's minutes exclude the walk home while the drawn line includes it (L4a). Mid-walk the closing waypoint is `origin`, the walker's **current position**, not the start (L4b). The assistant's own end-distance and radius are ignored mid-walk (L5).
3. **The rebuild tears everything down before it knows it will succeed.** `handleBuildWalk` stops GPS tracking, nulls the plan and resets the clock first, then asks the server. Every failure then depends on a snapshot revert (R1).
4. **A rebuild can silently become a new walk.** An assistant build that lands while another rebuild is in flight (or between the "planned" and "walking" phases) takes the fresh-walk path and wipes visited stops, pins, trail, discovery and the replan cooldown (R2).
5. **Elapsed time, distance and the GPX points restart at every rebuild.** The HUD clock drops to zero and the saved history keeps only the last leg (R5). This is also why "what we walked so far" needs its own store.
6. **A good "do not retrace" engine already exists** (`/api/walk-options`, `avoid-polygons.ts`, `direction-options.ts`) and is used only for the off-route "options" sheet. The plan reuses it instead of inventing a second one.
7. **"Walked so far" half exists:** a gray trail toggle in the walk details (`WalkPlannerApp.tsx:~4232`). It is hidden while a rebuild runs, never saved, and has no distance or time. Section 5 specifies a ledger and a sheet.

---

## 1. How routes and loops are decided today

**Assistant path.** `build_walk` → `estimate_walk`/`routeAndJudge` → `build_walk` action → `AssistantChat.onBuild` → `handleBuildWalk` → `/api/walk-plan`.
- `loop` is `params.endDistanceKm === 0` in three places: `tools.ts` (`estimateWalk` argument, ~:1203; `find_clean_walk`, ~:978), `route-check.ts:128`, `rule-verdict.ts:133`. The prompt only says "end_distance_km 0 for 'back at the start'" (`prompt.ts` route-rules bullet). Nothing says to prefer a loop.
- Stop order: `bestOrder(dist, loop)` (`loop-search.ts:11-51`) minimises the open path when `loop` is false, so the walk ends at the last stop.
- Waypoints: `[origin, ...stops, ...(loop ? [origin] : [])]` (`route-check.ts waypointsOf`).
- Route improvement: `buildCleanRoute` re-routes around repeated streets only when `noRepeat` is true: `cost = (noRepeat ? repeatedKm : 0) + forbiddenKm` (`clean-route.ts:36`). With the default, `cost` is 0 and the first (shortest) route is accepted.
- Verdict rules: `loop` exists only when asked (`rule-verdict.ts:134-135`); `no_repeat` only when asked (`:141`).

**Planner path (`/api/walk-plan`).** `returnToStart = requestedEndDistance === 0` (`route.ts:410`); waypoints `[origin, ...stops, ...(returnToStart ? [origin] : [])]` (`:716-719`); `planRequest.returnToStart` is `maxEnd === 0 && !endAnchor` (`:607`); the planner then orders as a loop and counts the way home (`tsp-planner.ts:467-473`). `analyzeRoute` (`route-quality.ts:51-84`) returns `repeatedKm` and `closesLoop`; the route only warns when `noRepeat` or `returnToStart` was set (`:773`).

**Mid-walk.** All builders funnel through `buildMidWalkRebuildRequest` (`planner-actions.ts:504-560`): origin = current position, `keepAttractions` = remaining stops, `availableMinutes = max(15, original - elapsed)`, `endAnchor = orig.endAnchor ?? orig.origin` (`:548`), everything else copied from the first input.

**Existing "do not retrace" machinery.** `/api/walk-options` returns up to three ways forward, drops those that retrace the walked track by more than 25% (`OVERLAP_MAX_WALKED`) or the abandoned plan by more than 60%, retries the worst with `buildAvoidPolygons(walked, keepDisks)` (20 m strips, 80 m keep-disks around the walker and stops, `avoid-polygons.ts`), supports `mode: "roundtrip"` with a length, and a "back" theme to the home anchor (`direction-options.ts`, `discovery-cadence.ts:202-226`). The walked track is capped at 60 points (`OPTIONS_WALKED_MAX_POINTS`).

---

## 2. Root causes

### 2.1 Loops

| # | Root cause | Evidence | Confidence |
|---|---|---|---|
| **L1** | **No loop preference anywhere.** Loop only on the exact phrase that sets `endDistanceKm = 0`. Default stop order is an open path ending at the last stop (a one-stop walk ends at the stop). | `prompt.ts` route-rules bullet, `tools.ts:~978, ~1203`, `route-check.ts:128`, `loop-search.ts:11` | Confirmed |
| **L2** | **Out-and-back is invisible to the rules.** With one or two stops and a loop, the router's shortest route is the same street back. `repeatedKm` is computed but only judged under `no_repeat`; `buildCleanRoute` only acts under `noRepeat` or forbidden streets. So an out-and-back loop is "met". | `clean-route.ts:36`, `rule-verdict.ts:141`, `route-quality.ts:60-68` | Confirmed |
| **L3** | **Nothing forces a different return.** There is no via-point or alternative-route attempt to get a real circle; the only lever is avoid-polygons and only on `noRepeat`. | `clean-route.ts:41-58` | Confirmed |
| **L4a** | **The planner's loop mode is unreachable from the API, so a "back at the start" plan under-counts its own time.** The route computes the closing flag from the raw request (`returnToStart = requestedEndDistance === 0`, used for the drawn waypoints), but the planner flag is `params.maxEndDistanceFromOriginMeters === 0 && !endAnchor` and `baseParams.maxEndDistanceFromOriginMeters` was already coerced from 0 to `undefined` (`> 0` check). That condition is never true. Result: for every loop built through `/api/walk-plan`, stops are ordered as an open path, `plan.totalMinutes` and feasibility **exclude the walk home**, and the drawn line includes it. No existing test covers this (`tests/walk-plan-api.test.ts` has no `returnToStart` or end-distance 0 case; `tests/tsp-loop.test.ts` calls the planner directly, which is why it passes). | `route.ts:410-418, 607, 716-719`, `tsp-planner.ts:467-473` | Confirmed (code) |
| **L4b** | **Mid-walk the loop also closes at the wrong place.** The appended closing waypoint is `origin`, which in a mid-walk rebuild is the walker's **current position**; the real start is `endAnchor`, which only feeds the end-distance limit and is never a waypoint. So "loop after a deviation" draws a ring that ends where he stands, not at the start. | `route.ts:716-719`, `planner-actions.ts:548`, `tsp-planner.ts:225-227` | Confirmed (code). Likely (this is what a "loop after a deviation" does) |
| **L5** | **A mid-walk build ignores the assistant's loop and radius.** The mid-walk branch of `onBuild` takes only the stops (and the pace if stated); `build.maxEndDistanceFromOriginMeters` and `build.radiusMeters` are dropped, the first walk's values are copied. Saying "make it a loop" mid-walk changes nothing. | `WalkPlannerApp.tsx:~3986-4005`, `planner-actions.ts:540-550` | Confirmed |
| **L6** | **Loop assistance exists only for the unconstrained case.** The walk's route improvements (`find_clean_walk`) need 15+ places and an explicit `no_repeat`; the default one-stop "walk to the cafe and back" never uses them. | `tools.ts:387` (description) | Confirmed |

### 2.2 Mid-walk rebuild: failure and state-reset paths

| # | Path | Evidence | Confidence |
|---|---|---|---|
| **R1** | **Teardown before success.** `handleBuildWalk` calls `stopWalkTracking()` (GPS watch, stats, advisor, trigger, recorder, phase to "idle"), then `walkInputRef = input`, `walkStartTimeRef = now`, `latestPaceUpdateRef = null`, `setWalkPlan(null)`, and only then fetches. Every network blip, ORS error, 45 s timeout or empty plan depends on `revertToSnapshot` to rebuild the walk from a copy. During the wait there is no GPS, no stats, no deviation monitor, no recorded points. | `WalkPlannerApp.tsx:1451-1496` (`stopWalkTracking`, ref writes, `setWalkPlan(null)`), `:858-896` | Confirmed |
| **R2** | **An assistant build can take the fresh-walk path mid-walk.** `onBuild` uses the mid-walk branch only when `walkPhaseRef.current === "walking"` **and** `midWalkRebuildState()` is non-null (it is null when `walkTrackerRef` is null). The chat reply can arrive seconds later, after a deviation or pace rebuild has started (phase "idle", tracker null) or between `showPlan` ("planned") and `handleStartWalk`. The code then falls to the plain branch with `autoResume: walkPhaseRef.current === "walking"` false, which **resets visited stops, pins, replan trigger, announcer, discovery, walk chat, and (because phase is not "walking") the walked trail**, and starts a new walk. The chat input is blocked only at send time (`isBuilding`), not when the reply lands. | `WalkPlannerApp.tsx:~3986` (branch), `:1459-1474` (reset block), `:2638` area (`midWalkRebuildState` guard) | Confirmed (mechanism). Likely (as a reported crash) |
| **R3** | **Assistant stops are matched to visited stops by id only.** `excludeVisited` filters by `id`. The assistant mints its own ids (`c1...`) from its own searches, and `state.avoid` only knows saved places marked visited. Nothing tells the model which stops the walker already reached, so a rebuild can send him back to a place he finished. | `visit-tracker.ts:66-71`, `route.ts:~199-206` | Confirmed (mechanism) |
| **R4** | **Zero stops means "discover new ones".** When all remaining stops are visited or filtered, `explicitAttractions` is empty and `/api/walk-plan` runs ordinary discovery and adds places nobody asked for; there is no "just route me home" mode. | `WalkPlannerApp.tsx:1483-1487`, `walk-plan/route.ts:~470` (`explicitAttractions.length > 0` check) | Confirmed |
| **R5** | **Clock, distance and recorder restart at every rebuild.** `stopWalkTracking` nulls `firstFixAtRef`; `handleStartWalk` re-seeds it from the first new fix. HUD `elapsedMin` and `walkedM` (measured along the **new** geometry) restart at zero, and the history row saved at the end uses `walkStats.elapsedMin` / `walkedM` (last leg only). `WalkRecorder` is recreated, so the GPX/CSV keeps only post-rebuild points. After a reload-resume the opposite happens (`resumedStartRef` keeps the original start), so behaviour depends on how you got there. | `WalkPlannerApp.tsx:862, 2634, 2651, 2160-2190` (`finishCompanionWalk` totals), `:2900-2905` (recorder) | Confirmed |
| **R6** | **The trail disappears while rebuilding and on reload.** `walkedGeometry` is passed only when `walkPhase === "walking" && showWalkedPath` (`:4700`), and phase is "idle"/"planned" during a rebuild. `walkedTrackRef` is a ref with a 5000-point cap, not part of the saved active-walk snapshot, so a reload starts it empty. | `WalkPlannerApp.tsx:4700, 2715-2720`, `active-walk-store.ts:9-21` | Confirmed |
| **R7** | **Tiny remaining time is inflated.** `MIN_REBUILD_MINUTES = 15` is a floor, so with 5 minutes left the rebuild plans a 15-minute walk away from home; the assistant's pins (all its stops are pinned) can then make the plan infeasible, which is reported but still resumed. No "head home now" path exists. | `planner-actions.ts:54, 515-519`, `WalkPlannerApp.tsx:~1672-1690` | Confirmed |
| **R8** | **An unroutable start kills the rebuild with a generic message.** `orsRoute` throws when the line starts more than 400 m from the requested point, and ORS refuses starts with no routable edge within its snap radius (a walker in a park, on a pier). `/api/walk-plan` turns that into a warning with no geometry; the client reverts with "Couldn't update your route". No retry from the nearest routable point. | `ors-route.ts:~58`, `walk-plan/route.ts:~790` (catch), `WalkPlannerApp.tsx:~1626-1632` | Confirmed (path). Not confirmed (that it fired for the owner) |
| **R9** | **Revert can leave him where the failure started.** `revertToSnapshot` restores the old plan and geometry and restarts tracking from the current fix; a walker 600 m off route is off route again, so the deviation flow fires again after its cooldown. Bounded (3-minute cooldown, collapse after a second rejoin failure) but noisy. | `WalkPlannerApp.tsx:2966-3030` | Confirmed |
| **R10** | **Sunk inconsistency: `ReplanTrigger` outlives the rebuild with the old plan pace** (see speed plan, RC-A8) and the discovery announcer keeps state from the old route. | `WalkPlannerApp.tsx:2939` | Confirmed |

---

## 3. Spec A: loops first, out-and-back last

### 3.1 Policy (one helper)

New `src/lib/walk/loop-policy.ts`:
```ts
export type LoopWant = "require" | "prefer" | "off";
export function loopWant(p: WalkParams): LoopWant {
  if (p.endDistanceKm === 0) return "require";               // walker said back at the start
  if (p.endDistanceKm !== undefined || p.order?.endAt || p.transit?.back || p.loop === "off") return "off";
  return "prefer";                                           // default: nothing said about the end
}
```
Add `loop?: "off"` to `WalkParams` (set by `set_walk_params`: one-way, "end at X", "I do not need to come back"). `require` keeps today's hard `loop` rule. `prefer` is new: stop order, waypoints and the verdict behave as a loop, but a miss is `partial`, never `not_met`, so `build_walk` is not refused.

Call sites: `tools.ts` (the `estimateWalk` loop flag, `find_clean_walk`), `route-check.ts:128` (`loop`), `rule-verdict.ts:133` (`loop` rule), `/api/walk-plan` (new request field `preferLoop`, set by `AssistantChat`/`handleBuildWalk` and the form with default true), `unavailableVerdict`.

### 3.2 Loop construction (new `src/lib/walk/loop-route.ts`, called from `buildCleanRoute`)

Inputs: waypoints `[S, P1..Pn, S]`, `route(waypoints, avoid)`, time budget `T`, ORS call budget (the assistant's `TURN_ROUTING_CALLS`, at most 3 extra calls).
1. Route G0 through the waypoints. `q0 = analyzeRoute(G0)`. `repeatRatio = q0.repeatedKm / walkKm`. **Accept** when `closesLoop` and `repeatRatio <= 0.20` (`LOOP_MAX_REPEAT_RATIO`).
2. **Soft no-repeat:** run the existing avoid-polygon retry (`buildCleanRoute` machinery with `noRepeat` forced on for the attempt, `maxAttempts` 2). Accept if `repeatRatio` improves and length <= 1.4 x G0 length and total minutes <= T.
3. **Via-point attempt (single stop or when step 2 fails):** let F be the point of G0 farthest from S. Generate up to 3 via candidates V on the return side: perpendicular to S-F at the midpoint, offsets +0.5 and -0.5 of |SF| and one at 0.35 of |SF| toward the stop that is farthest from F. Route `S, P1..Pn, V, S`; score `3 x repeatedKm + extraKm`; keep the best that meets the thresholds. Never more than 3 calls; reuse `isRouteCached` to stay free when possible.
4. If no candidate reaches `repeatRatio <= 0.35`: **out-and-back is accepted as a last resort** and flagged `outAndBack: true` in the verdict (new rule `loop_quality`, `status: "partial"`, `detail: "N km of the route is walked twice"`). The assistant must say so in one sentence and offer a different stop. A walk that cannot be a loop within the time (`T`) is not made longer to become one.
5. All of it runs only when `loopWant !== "off"`; `no_repeat` stays as it is.

Prompt (`prompt.ts`): "Prefer a circular walk: unless the walker asked for a one-way walk or an end point, build the walk so it returns to the start by a different way. If `loop_quality` is partial, say plainly that the walk goes out and back on the same streets and offer a different place." Tool description of `set_walk_params`: add `loop: "off"` with the meaning.

When several stops exist, the order search already supports a loop (`bestOrder(dist, true)`, `otherOrders`); with `prefer` it runs with `loop = true` and `orderSearch` allowed for up to 6 stops using `repeatRatio` as the score (today only under `noRepeat`, `route-check.ts:~188`).

### 3.3 `/api/walk-plan` fix for loop time and mid-walk closing (L4a, L4b)

First, make the existing flag work: derive the planner's `returnToStart` from the raw request (`requestedEndDistance === 0`), not from the coerced `params` value (`route.ts:607`). That alone fixes ordering and the missing minutes for fresh loops.

Then add a request field `returnTo?: { lat, lng }` (validated like `endAnchor`). Rules:
- Waypoints: `[origin, ...stops, ...(returnTo ? [returnTo] : returnToStart ? [origin] : [])]`.
- `planRequest.returnTo` replaces `returnToStart` for ordering and for `homeMinutes` in `tsp-planner.ts` (distance to `returnTo`, not `origin`); `endAnchorOf` stays for the end-distance limit.
- The client sets `returnTo = walkStartPointRef.current ?? input.endAnchor` whenever `loopWant !== "off"`; the planner's time total includes the leg home, so drawn route and minutes agree.
- Warn `"The route does not end back at the start"` against `returnTo`, not `origin`.

---

## 4. Spec B: a mid-walk rebuild that is new, safe and closes toward the start

### 4.1 Structure: make before break (fixes R1, R9)

In `handleBuildWalk`, for `options.autoResume`:
1. Build the request first. Do **not** call `stopWalkTracking()`, `setWalkPlan(null)`, or write `walkInputRef`, `walkStartTimeRef`, `latestPaceUpdateRef` yet. Tracking, stats and the deviation monitor keep running on the old route. `rebuildingMidWalk` stays true for the "Updating your route" pill with its existing cancel action.
2. When the response is valid (geometry >= 2 points, at least one stop or `mode: "home"`, `routeQuality` acceptable, first point within 150 m of the walker), **then** run the swap in one synchronous block: take the snapshot (now consistent by construction), write refs, `showPlan`, `handleStartWalk`.
3. On any failure nothing was torn down: show the notice, keep the old route. `revertToSnapshot` stays only for undo.
4. Supersede rule: a newer build cancels the older request (existing request ids) and **never** starts from a half-swapped state.

### 4.2 One entry point and a queue (fixes R2)

`onBuild` mid-walk and every `run*Rebuild` go through `requestMidWalkRebuild(kind, payload)`:
- If a rebuild is in flight or phase is not "walking" while a walk is active (`walkTrackerRef` or `rebuildingMidWalk`), the request is **queued once (latest wins)** and run when the current one finishes, rebuilt against the then-current position and visited set. An assistant build never takes the fresh-walk branch while a walk is active; the fresh-walk path is only for `walkPhase === "idle"` with no active walk.
- The assistant reply that lands after the position changed more than 150 m, or after a visited stop changed, is re-validated: stops already visited are dropped (by id **and** by 40 m proximity), and the start of the new route is the current fix, never `build.origin`.

### 4.3 What the rebuild computes (a genuinely new route)

Inputs: trusted position `P`, home `H` (`walkStartPointRef` or `endAnchor`), remaining stops `R` (unvisited), pins, time left `T`, breadcrumb `B` (ledger, simplified to 60 points for the options API), pace (measured, per the speed plan).
1. **Mode decision**
   - `R` empty or `T < timeHome(P→H) + 5 min` → `mode: "home"` (route to `H`, no discovery, honest minutes, one notice "Heading home, about N min").
   - else `mode: "loop"` through `R`, closing at `H`.
2. **Order:** `bestOrder` over `[P, ...R, H]` with `H` as the closing point (open for `loopWant: off`).
3. **Route:** `P → R... → H` via `/api/walk-plan` with `returnTo = H`, `explicitAttractions = R`, `fixedOrder` when the walker or assistant stated an order, **no discovery when `R` is empty** (new `returnHome: true` flag, R4). `avoid_polygons` from `B` through `buildAvoidPolygons(B, [P, ...R, H])` as the **second** attempt only, never the first (hard avoid can make routing fail); the unconstrained route is the fallback.
4. **Fit to time:** accept when total minutes <= `T x 1.05`. Otherwise drop unpinned stops from the far end one by one (pinned stops are never dropped; if pins alone do not fit, keep them, say so, and offer "Head home now"). Never inflate `T` to 15 minutes (R7): replace the floor by `max(T, timeHome + 5)`.
5. **Choice instead of guess:** when a rebuild is asked for explicitly ("rebuild from here", "different way back"), reuse `/api/walk-options` to offer up to three options each with its overlap percentage, with a roundtrip option sized `OPTIONS_ROUNDTRIP_FACTOR x T`. The automatic rebuilds (deviation) stay single-route.
6. **Assistant:** `AssistantBuild` carries `loop`, `endDistanceKm` and `radiusKm` through to the mid-walk branch (L5); `buildOptionRebuildRequest` accepts `{ returnTo, endDistanceM, minutesFromNow }` (the last is already added by the extend plan).

### 4.4 Edge cases

| Case | Behaviour |
|---|---|
| **Off route** | Under 400 m: local splice as today (`runLocalRejoin`). Over 400 m: rebuild from the trusted fix. Over 2 km from `H` or from any remaining stop: offer "Head home" first; never plan a loop larger than `T` allows. |
| **GPS jitter / poor fix** | The rebuild position is the median of the last 3 engine-grade fixes (accuracy <= 50 m, `walk-cadence.ts`), else the last matched route point. A deviation needs two consecutive off-route fixes at least 20 s apart before it can start a rebuild. No rebuild within 60 s of another. |
| **Offline / ORS down / timeout** | Make-before-break: nothing is torn down. One notice "No connection: staying on your current route", the rejoin hint keeps working (local geometry), and the request is not retried more than once on regain. The ledger and trail keep recording offline. |
| **Unroutable start** (R8) | If ORS rejects the start, retry once from the nearest point on the **old route** within 150 m of the walker, and tell him "starting from the nearest path". |
| **No places left / all visited** | `mode: "home"` (R4). No discovery. |
| **Tiny remaining time** | `mode: "home"` with the minutes shown; "Keep walking" dismisses. No 15-minute floor. |
| **Stop already reached / assistant re-found it** | Dropped by id and by 40 m proximity (R3); the assistant context lists visited stops (below). |
| **Pinned stops that cannot fit** | Kept, warning shown, "Head home now" offered (existing pinned-time warning). |
| **Rebuild requested twice quickly** | Queue, latest wins (4.2). |
| **Reload mid-rebuild** | Active-walk snapshot is written only after a successful swap, so a reload resumes the **old** consistent walk plus the ledger. |
| **Walker already at home** | `T` irrelevant; "You are back at the start" finish card (existing end-of-route flow). |

### 4.5 What the assistant must be told (extends the extend plan's `CurrentWalk`)

Add to `current`: `visited: { name, coordinates }[]` (up to 12), `home: Coordinates`, `walked: { distanceKm, movingMin, elapsedMin }`. Server: put `visited` coordinates into `state.avoid.spots` (R3), add one fixed note line ("Stops already visited: ... never propose them; home is at ...; prefer a route that returns home by a different way"). The extend plan's validators (`parseCurrentWalk`) are the place to cap and clean them.

---

## 5. Spec C: "What we have walked so far"

### 5.1 Data model (new `src/lib/walk/walk-ledger.ts`, one instance per walk)

```ts
interface Crumb { lat: number; lng: number; t: number; leg: number } // leg = rebuild index
class WalkLedger {
  record(fix: { coordinates; timestamp; accuracyMeters; moving: boolean }): void
  markLeg(reason: "start" | "rebuild" | "rejoin"): void
  visited(id: string, name: string, at: number): void
  summary(): { distanceM; movingMs; pausedMs; elapsedMs; avgMovingKmh; stopsVisited; legs: number }
  trail(maxPoints?: number): Crumb[]        // simplified (Douglas-Peucker, keeps the shape)
  toJSON() / static fromJSON()
}
```
Rules: accept fixes with accuracy <= 50 m; add a crumb after 8 m or 20 s; distance adds only hops >= 8 m and <= 3.5 m/s (the existing jitter and jump gates); time counts as moving only when `SpeedEstimator` is not paused; cap 5000 crumbs (halve resolution, as `walkedTrackRef` does today). **It is created at a fresh walk and ended at End walk; it is never touched by `stopWalkTracking`, `handleBuildWalk(autoResume)` or `revertToSnapshot`.** It replaces `walkedTrackRef` and `WalkRecorder`'s point list as the source for the trail, GPX/CSV export, the history row (`totalMin`, `distanceM`) and the learned pace (speed plan 4.8).

Persistence: add an optional `ledger` field to `ActiveWalkSnapshot` (`active-walk-store.ts`), simplified to at most 800 crumbs (about 32 KB), written with the existing 15 s throttle; `resumeActiveWalk` restores it. Optional field, so old snapshots still load.

### 5.2 Map

`walkedGeometry` is drawn whenever a walk is active (`walkMode`, which includes `rebuildingMidWalk`), not only when `walkPhase === "walking"` (`WalkPlannerApp.tsx:4700`). Trail colour is the existing `colors.walked`; each rebuild leg gets a thin tick marker where it began. The remaining route stays as drawn. Visited stops show a check mark.

### 5.3 UI proposal

Entry points (all open the same sheet, none blocks the map):
1. **HUD chip** in the walk header: `3.2 km · 52 min` (tap to open). Shows the ledger summary at a glance.
2. **Details button** replaces "Show the path I walked (gray)" with "What we have walked" (opens the sheet; the old toggle moves into it as "Show on map").
3. **Chat**: keyword intent `walked` in `walk/chat/intent.ts` ("what have we walked", "show my path", "how far did we walk", "מה עברנו", "איפה הלכנו", "כמה הלכנו") opens the sheet with no LLM call. The main assistant also receives `walked` in `current` (4.5) so it can answer in words.

Sheet (bottom sheet, half height, map visible above; he/en, RTL aware):
```
  What we have walked                         [x]
  ----------------------------------------------
  3.2 km        52 min        3.7 km/h
  distance      moving        average (moving)

  Stops reached   2 of 4   (check) Cafe Noga  (check) Old Mill
  Time stopped    14 min   .   Total 1 h 06 min
  Back at the start: about 2.1 km, 30 min

  [ Show on map ]  [ Keep walking ]  [ Export GPX ]
```
- "Show on map" fits the map to the trail plus the remaining route and draws the trail solid gray, the remaining route dashed in the accent colour; "Keep walking" re-centres on the dot.
- Copy (he): `מה עברנו עד עכשיו`, `מרחק`, `זמן בתנועה`, `מהירות ממוצעת`, `עצירות שהגענו אליהן`, `חזרה להתחלה: בערך 2.1 ק"מ, 30 דק׳`, `הצג על המפה`, `המשך ללכת`, `ייצוא GPX`. (en): the labels above.
- Touch targets 44 px; non-modal; works offline (summary and trail come from the ledger; map tiles may be missing, so the trail also draws as a plain SVG outline in the sheet when tiles fail).
- Preserved across rebuilds by construction (5.1); the sheet shows a small "route changed 1x" line when `legs > 1`.

Design rules from the repo: terra/forest/cream tokens, no small print, one accent (`calm-site-taste`); this is a utility sheet, so keep it three numbers and two buttons.

---

## 6. Prioritised fix list

| Pri | Fix | Files / functions | Fixes | Size |
|---|---|---|---|---|
| **P0** | Make-before-break in `handleBuildWalk` for `autoResume` (4.1). | `WalkPlannerApp.tsx` `handleBuildWalk`, `revertToSnapshot` (kept for undo), `stopWalkTracking` call sites | R1, R9, part of R2 | M |
| **P0** | Single mid-walk entry with a queue; assistant builds never take the fresh-walk branch during an active walk; re-validate visited stops by id and 40 m (4.2). | `WalkPlannerApp.tsx` `onBuild` and `run*Rebuild`, `visit-tracker.ts` (new `excludeVisitedNear`) | R2, R3 | M |
| **P0** | `WalkLedger` (5.1), keep clock/distance/recorder across rebuilds, use it for the history row; draw the trail during a rebuild. | new `walk-ledger.ts`; `WalkPlannerApp.tsx` (`firstFixAtRef` use at :2651, `walkedTrackRef`, recorder, `finishCompanionWalk`, map prop :4700); `active-walk-store.ts` | R5, R6, owner item 3 | M |
| **P0** | Make the planner's loop flag reachable (derive from the raw request, one line at `route.ts:607`), then add `returnTo` in `/api/walk-plan` and the planner (3.3); client sets it from the walk's start. | `walk-plan/route.ts:410, 607, 716-719, 773`, `tsp-planner.ts:225-227, 467-473`, `WalkCompanionInput`/`RebuildInput`, `planner-actions.ts:548` | L4a, L4b | S then M |
| **P1** | `loop-policy.ts` and loop-first defaults in estimate, verdict and prompt; `loop_quality` rule (3.1). | new `loop-policy.ts`; `tools.ts`, `route-check.ts:128`, `rule-verdict.ts:133`, `prompt.ts`, `state.ts` (`loop?: "off"`), `tool-schemas.ts` | L1, L2 | M |
| **P1** | `loop-route.ts` (soft no-repeat, via-point candidates, thresholds) wired into `buildCleanRoute` callers (3.2). | new `loop-route.ts`; `clean-route.ts`, `route-check.ts` `judge`, `walk-plan/route.ts` | L2, L3 | M |
| **P1** | Pass the assistant's loop/end-distance/radius into the mid-walk branch; `mode: "home"` + `returnHome` flag; replace the 15-minute floor (4.3). | `planner-actions.ts` (`buildMidWalkRebuildRequest`, `buildOptionRebuildRequest`), `AssistantChat.tsx` (`AssistantBuild`), `walk-plan/route.ts` | L5, R4, R7 | M |
| **P1** | Tell the assistant about visited stops, home and walked totals; add visited to `state.avoid` (4.5). | `current-walk.ts` (`parseCurrentWalk`, `seedCurrentWalk`, note), `route.ts`, `AssistantChat.tsx`, `WalkPlannerApp.tsx` builder | R3 | S |
| **P1** | "What we have walked" sheet, HUD chip, `walked` keyword intent (5.3). | new `WalkedSummarySheet.tsx`; `WalkStatsBar.tsx` / HUD, `walk/chat/intent.ts`, `chat/reply.ts`, `walk-copy.ts` | owner item 3 | M |
| **P2** | Options-sheet rebuild for explicit "rebuild from here" (4.3 step 5); sized round trip. | `useCollapseFlow`, `/api/walk-options` (no change), `WalkPlannerApp.tsx` | genuinely new route | M |
| **P2** | Unroutable-start retry from the old route (4.4); consecutive-fix rule for deviation start. | `walk-plan/route.ts` catch, `deviation-monitor.ts` | R8 | S |
| **P2** | Loop default in the form planner (toggle on) and `find_clean_walk` usage for >= 2 stops under `prefer`. | planner form, `tools.ts` | L6 | S |

Build order: P0 ledger and make-before-break first (they de-risk everything else), then `returnTo`, then the loop policy and construction, then the sheet.

---

## 7. Tests (star = fails today)

Existing harnesses to extend: `tests/clean-route.test.ts`, `route-quality.test.ts`, `tsp-loop.test.ts`, `walk-plan-api.test.ts`, `planner-actions.test.ts`, `walk-planner-rebuild-timeout.test.tsx`, `walk-planner-silence.test.tsx`, `walk-planner-app.test.tsx`, `active-walk-store.test.ts`, `assistant-turn.test.ts`, `reroute-api.test.ts`, `walk-chat-intent.test.ts`.

**Loops**
1. star `tests/loop-route.test.ts`: with a mocked `route` that returns the same line out and back for `[S, A, S]`, `buildLoopRoute` calls the router again with avoid-polygons or a via point and returns a route with `repeatRatio <= 0.2` and `closesLoop`; when the mock can only return out-and-back, it returns it with `outAndBack: true` and the verdict has `loop_quality: partial`; the call count never exceeds the budget (4); a router that throws on the retry keeps the first route (no throw).
2. star `tests/loop-policy.test.ts`: table for `loopWant`: `endDistanceKm 0` require; undefined with no `endAt`/transit/`loop:"off"` prefer; `endDistanceKm 3` off; `loop:"off"` off.
3. star `tests/assistant-route-check.test.ts`: default params (no end rule) now give a `loop_quality` rule for a one-stop out-and-back (partial, not `not_met`, `build_walk` still allowed); with `loop:"off"` there is no such rule (mirror: one-way walks are never nagged).
4. star `tests/walk-plan-api.test.ts`: (a) a fresh request with `maxEndDistanceFromOriginMeters: 0` and two far stops: stops are loop-ordered and `plan.totalMinutes` includes the leg home (today it does not, L4a); (b) request with `endAnchor`, `returnTo` set and `maxEndDistanceFromOriginMeters: 0`: the ORS waypoints end at `returnTo`, not at `origin`; `plan.totalMinutes` includes the leg to `returnTo`; the warning is about `returnTo`. Without `returnTo` and without 0 the behaviour is unchanged (regression).
5. `tests/tsp-loop.test.ts`: `homeMinutes` uses `returnTo` distance.

**Mid-walk rebuild**
6. star `tests/walk-planner-rebuild-timeout.test.tsx` (extend): when `/api/walk-plan` rejects or returns an error, **tracking was never stopped** (tracker still alive, HUD stats still updating, deviation monitor armed, trail still growing); the walker sees the "staying on your route" notice.
7. star new `tests/walk-planner-midwalk-queue.test.tsx`: start a deviation rebuild, then deliver an assistant `onBuild` while it is in flight: the visited ids, pins, ledger and trail are intact (no fresh-walk reset), the assistant build runs after the first finishes, from the then-current position.
8. star `tests/planner-actions.test.ts`: `buildMidWalkRebuildRequest` with `returnTo` and `T = 5`: returns `mode: "home"`, not a 15-minute walk; with all stops visited returns `returnHome` and no discovery; with pinned stops that do not fit keeps them and flags it; assistant `endDistance`/`radius` reach the request.
9. star `tests/visit-tracker.test.ts`: `excludeVisitedNear` drops an assistant stop 25 m from a visited stop with a different id, keeps one 60 m away.
10. star `tests/assistant-current-walk.test.ts`: `visited` and `home` are parsed, cleaned and capped; visited coordinates land in `state.avoid.spots`; the note never proposes them.
11. `tests/reroute-api.test.ts` / new: unroutable start (mock ORS error) triggers one retry from the nearest old-route point; no infinite retry.
12. Crash harness (not a unit test, one time): mount `WalkPlannerApp` with the simulator, run 20 randomised rebuild sequences (success, ORS 502, HTML body instead of JSON, 45 s timeout, empty plan, rebuild during rebuild, unmount during rebuild) and assert no console error and no uncaught rejection. This is how an actual exception, if one exists, will show up.

**Ledger and walked-so-far**
13. star `tests/walk-ledger.test.ts`: standing still with 3-5 m jitter for 5 minutes gives 0 m; a 60 s GPS gap adds no phantom distance; a fix with accuracy 80 m is ignored; moving/paused time splits correctly; `markLeg` increments `leg` and keeps all crumbs; `trail(60)` keeps the shape and both ends; 5000-crumb cap halves resolution; JSON round-trip equals.
14. star `tests/active-walk-store.test.ts`: the snapshot with and without `ledger` loads; a rebuild does not change the saved ledger distance; resume restores totals.
15. star `tests/walk-planner-app.test.tsx`: after a mid-walk rebuild the HUD elapsed does **not** drop to zero and the history row written at End walk has the whole walk's minutes and distance; the trail prop is non-empty **during** the rebuild.
16. star `tests/walked-summary-sheet.test.tsx`: opens from the HUD chip, the Details button and the chat keyword; shows distance, moving time, average, stops reached; Hebrew renders RTL; "Show on map" fits the trail; works with no network (no fetch calls).
17. star `tests/walk-chat-intent.test.ts`: "מה עברנו", "איפה הלכנו", "how far did we walk", "show my path" give intent `walked`; they do not collide with `skip`/`shorter` words.
18. Optional, paid, owner-run: `tests/llm-eval/loop-live.test.ts` gated by `RUN_LIVE_LOOP_EVAL`: "walk to the cafe and back" must end with a `loop` build whose route is not out-and-back, or an honest out-and-back disclosure.

---

## 8. Risks

- **Make-before-break changes the order of side effects.** While the request is in flight, fixes still arrive against the old route; the swap must happen in one synchronous block and must re-read position and visited set. Cover with tests 6, 7 and 15.
- **ORS budget.** Loop attempts add up to 3 directions calls per build; the assistant's per-turn routing budget and the `orsRateLimiter` already cap this, and `isRouteCached` makes repeats free. The via-point search must degrade to out-and-back (flagged), never to a thrown error.
- **Via-point loops can be long.** Reject candidates over 1.4x the out-and-back length or over the time budget.
- **Hard `avoid_polygons` can make routing impossible**, so it is never the first attempt, and `AVOID_MAX_EXTENT_M` already returns null for wide tracks (then no avoid, not an error).
- **`prefer` changes default assistant behaviour** (more loops, sometimes longer walks, a new `loop_quality` line in replies). Keep it `partial`, never blocking, and easy to switch off with `loop: "off"`.
- **Ledger storage.** 800 crumbs in localStorage is small, but storage can be blocked (existing try/catch pattern in `active-walk-store.ts`); the walk must carry on without it.
- **The extend plan and this plan edit the same files at the same time** (`WalkPlannerApp.tsx`, `AssistantChat.tsx`, `planner-actions.ts`, `current-walk.ts`, `state.ts`). Land extend F1-F6 first; then add `visited`/`home`/`walked`/`pace` to the one `CurrentWalk`.
- I did not reproduce a literal exception (section 0). If the owner has a console error or a screenshot of the crash, that is worth more than any more reading; ask for it (Q1).

## 9. Open questions for the owner

- Q1. What exactly "crashed": a red error screen, the app reloading, the walk disappearing and the old route coming back, or the route not changing? Which step was it after (deviation card, the chat, a pace card)? A console error or a screenshot would settle R1-R9 in minutes.
- Q2. Default for a walk with nothing said about the end: **loop preferred** (recommended) or ask once? And should "out and back" be allowed silently for very short walks (under 1 km)?
- Q3. For an explicit "rebuild from here", show the three-option sheet (recommended) or just redraw?
- Q4. Where should "What we have walked" live: HUD chip plus Details button plus chat (recommended), or the HUD only?
- Q5. Keep the walked-so-far data on the device only (recommended, as now), or also write it to the saved walk for the history screen?
- Q6. When time is almost out, auto-switch to "Head home" (recommended, with a visible dismiss) or only offer it?

## 10. Manual verification (builder)

1. `npx vitest run`, `npx tsc --noEmit`, `npm run lint`; new star tests fail before and pass after.
2. Chat: "a walk to <a cafe 1 km away>". **Expect:** a loop with a different return street, or one honest sentence that it is out and back. Then "one way is fine": no loop line.
3. Simulate a walk, stray 300 m, accept the redraw while DevTools is **offline**. **Expect:** "staying on your current route", the dot and HUD never stop, no error, the trail keeps growing.
4. Simulate a walk, send a chat message that rebuilds, and trigger a deviation rebuild at the same moment. **Expect:** no reset of visited stops, one rebuild after the other, the trail intact.
5. Rebuild twice, then End walk. **Expect:** HUD elapsed never drops; the saved walk shows the whole distance and time; the walked sheet shows both legs.
6. With 5 minutes left far from home: **Expect:** "Heading home, about N min", not a 15-minute walk away.
7. Reload mid-walk. **Expect:** the old consistent walk resumes with the trail and totals.
8. Do **not** deploy (launch gate). Per the owner's Traike rule: commit and push the branch, then zip the repo to `~/Downloads`.
