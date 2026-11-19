# Speed, pace and time budget: root causes and fix plan (both directions)

Date: 2026-11-19 · Branch: `feat/walk-detail` · Status: investigation only, no source changed.

**Owner report (Hebrew, paraphrased):** the route was planned at about 2 km/h. The owner actually walked about 4 km/h. Instead of offering to **extend** the walk, the assistant told him to **shorten** it. The opposite case (walker slower than plan) is surely mishandled too.

**Read first:** `docs/ASSISTANT-EXTEND-ROUTE-PLAN.md` (the extend-route plan). This plan does not repeat it. It builds on its `current` payload (F3), `timeSetThisTurn` / `timeStated` (F4) and `minutesFromNow` (F5). Those are being built in the same files right now (`src/lib/assistant/current-walk.ts` already exists in the working tree), so **line numbers below are from the working tree on 2026-11-19 and may drift by a few lines**. Function names are the stable reference.

Evidence labels: **Confirmed** = read in code and traced; **Likely** = fits the code and the report, not provable without the owner's data; **Hypothesis** = needs the read-only check in section 8.

---

## 0. Summary

1. The code compares the walker with the plan in **four unrelated places** (HUD time-to-finish, `PaceAdvisor`, `ReplanTrigger`, the companion cards). They use four different pace estimators, three different windows and **two different "planned pace" values** after any pace change. There is no single "pace truth".
2. **The model is never told the plan's pace, the measured pace, or whether the walker is ahead or behind.** Mid-walk it gets only `walking: true`, a start point and the names of the remaining stops. It cannot choose "extend" over "shorten" because it has no numbers (RC-A1).
3. The "shorten" pressure is built in: the HUD ignores a walker faster than 1.5x the plan and prices the rest of the walk at the plan's slow pace (RC-A2). That inflated "minutes left" feeds the sunset card, the add-a-stop gate and the companion's "OVER the allowed time" line. The in-walk companion prompt has only a "short on time, cut a stop" branch (RC-A3).
4. "Extend" is hard to reach for a fast walker: the fast card needs a priced add-a-stop candidate (priced at the slow plan pace, so nothing fits), the mid-walk assistant is told "never add a stop", and the rebuild budget can only shrink (RC-A4, RC-A5).
5. The plan's 2 km/h most likely came from a **sticky pace in the stored chat state** (RC-A6) or from the **learned pace**, which is trained on one instantaneous end-of-walk reading (RC-A7). Section 8 has read-only checks to tell them apart.
6. Fix direction: one moving-pace tracker, one signed "spare minutes" number, decisions taken on that number with symmetric thresholds, and the same numbers handed to every assistant. Prioritised list in section 5, tests for both directions in section 6.

---

## 1. Units and where each one lives

| Thing | Unit | Where |
|---|---|---|
| Plan pace, profile pace, gear preset, tool arg `pace_min_per_km` | **min/km** | `src/lib/walk/pace.ts:2` (`DEFAULT_PACE_MIN_PER_KM = 15`, that is 4 km/h), `AssistantSettings.tsx:9-15` |
| HUD speed, `SpeedEstimator.current().kmh`, `WalkStats.kmh` | **km/h** | `speed-estimator.ts:83-92`, `walk-stats.ts` |
| Walker's words ("I walk 4 km/h", "קמ"ש") | **km/h** | chat |

Conversion table: 2 km/h = 30, 2.4 = 25, 3 = 20, 4 = 15, 5 = 12, 6 = 10 min/km. The gear presets are labelled by name and min/km only ("Very slow (25 min/km)", `AssistantSettings.tsx:115-122`), so a walker who thinks in km/h cannot tell that "Very slow" is 2.4 km/h. The prompt example says "I walk 2 km/h" (`route.ts` mid-walk note, ~:197) but never states the conversion.

### The four pace estimators

| # | Estimator | Window | How it measures | Feeds |
|---|---|---|---|---|
| 1 | `WalkTracker.computePace` (`walk-tracker.ts:46-47, 155-182`) | last **5** engine-grade fixes (about 5-25 s) | sum of hops, valid only 5-30 min/km, else null | `PaceUpdate.paceMinPerKm` → rebuild builders, companion pace card, **walk-end learning** |
| 2 | `SpeedEstimator` (`speed-estimator.ts`) | 10 s Doppler / 30 s displacement, EMA 0.35, jump gate 3.5 m/s, pause rule | median / straight-line displacement | HUD km/h, `timeToFinishMin` |
| 3 | `PaceAdvisor` (`pace-advisor.ts`) | 5 min, hop sum with 10 m jitter floor, stop dwell cut out | hop sum | "slower / faster" cards (ratio 1.3 / 0.77, hysteresis 1.15 / 0.87, cooldown 6 min) |
| 4 | `ReplanTrigger` (`replan-trigger.ts:35-44`) | 15 min, stop dwell cut out, no jitter floor | hop sum | auto/ask rebuilds (default **off**, `walk-settings.ts:177-178`) |

The same walker can read 4 km/h on the HUD, "slow" on the advisor and "fast" on the companion card at the same moment.

---

## 2. How speed and time flow today

**Plan time.** Pace is picked in this order: gear default (`defaultParams`, `defaults.ts:43`) > stored chat state (`state.params.paceMinPerKm`, persisted by `stored-state.ts:22`) > profile pace (`route.ts:179-181`, learned beats stored column, `preference-store.ts:349-353`) > model tool call `set_walk_params.pace_min_per_km` (`tools.ts:855, 883`) > default 15. `estimateWalk` and `routeAndJudge` multiply by the access factor and price every leg at that pace. `build_walk` returns the params; `AssistantChat.tsx:~511` turns them into `walkingPaceMinPerKm` and `paceExplicit: params.paceMinPerKm !== undefined`.

**Live walk.** Fixes go to estimators 1-4. `refreshWalkStats` (`WalkPlannerApp.tsx:779-820`) computes `timeToFinishMin` and `overBudget`. The companion snapshot (`getCompanionSnapshot`, `:1971-2050`) turns the advisor's verdict into a card. Rebuild builders live in `planner-actions.ts`.

**What the assistant is told.**
- Main chat (`/api/assistant`): `origin`, `walking: true`, `queued` stops (names and coordinates), the stored state. **No pace, no elapsed, no remaining minutes, no ahead/behind** (`AssistantChat.tsx` send body, `route.ts:179-197`).
- In-walk companion (`/api/walk-assistant`): one line, `Time: X min walked, about Y min left to finish, Z min allowed [— OVER the allowed time]` (`walk-turn.ts:110-111`). No pace, no speed, no spare time, no "ahead" state.

---

## 3. Root causes

| # | Root cause | Evidence | Confidence |
|---|---|---|---|
| **RC-A1** | **The model has no speed or time numbers mid-walk.** It cannot tell ahead from behind, so it cannot pick "extend" or "shorten" on facts. The `current` payload in the extend plan carries stops and minutes but not pace or measured speed. | `route.ts:197` (mid-walk note), `AssistantChat.tsx` send body, `walk-turn.ts:110-111` | Confirmed |
| **RC-A2** | **A walker faster than 1.5x the plan is priced at the plan pace.** `timeToFinishMin` believes the measured speed only inside 0.5x-1.5x of plan. At 4 km/h against a 2 km/h plan the ratio is 2.0, so it falls back to 2 km/h and the walking part of "minutes left" is **overstated 2x**. The band is also asymmetric: it admits down to 0.5x (pace ratio 2.0) but only up to 1.5x (pace ratio 0.67). The same cap hides a walker much slower than plan (below 0.5x reads as "on plan"). Worked example: 1 km left at 4 km/h is 15 min, the HUD says 30. | `walk-stats.ts:41-54`; used at `WalkPlannerApp.tsx:800` | Confirmed |
| **RC-A3** | **That inflated number then drives "shorten" prompts.** `remainingWalkMin = walkStats.timeToFinishMin` feeds (a) `sunsetCandidate`, whose only answers are `shorten` (with a time cap) or `continue` and whose urgency (2-3) beats the pace card (1); (b) `pickAddPlace`/`canOfferAdd`, which then finds nothing affordable; (c) the companion's `overBudget` line. The in-walk companion prompt has one branch, "short on time: propose which ONE stop to cut", and **no branch for being ahead**. It also has no pace tool and no number to reason with. | `sunset.ts:20-60`, `companion-glue.ts:315-343`, `WalkPlannerApp.tsx:1986-1990, 3561-3568`, `walk-turn.ts:26` | Confirmed (mechanism). Likely (that it was what the owner saw) |
| **RC-A4** | **Being ahead rarely produces an offer.** `paceCandidate` returns `null` for fast unless `addPlace` exists (`pace.ts:62-63`); `addPlace` is only looked up when the 5-min advisor says "fast" (`WalkPlannerApp.tsx:2021`) and is priced with `speedMpm = 1000 / plannedPace` (`:1985`), i.e. at the slow plan pace. The slow card, by contrast, always fires and lists "shorten" first (`pace.ts:43-51`). The fast card has no "lengthen the walk" or "keep my pace" answer. | files cited | Confirmed |
| **RC-A5** | **Mid-walk the assistant can re-time but never grow the walk.** The note says "never add a stop they did not ask for" (`route.ts:197`). The rebuild budget is `max(15, original - elapsed)` (`planner-actions.ts:~515`). The explicit pace is applied (`WalkPlannerApp.tsx:~3991`) but `fillRemainingTime` is false, so the minutes freed by a faster pace are simply unused and nobody says so. (The extend plan's F4/F5 fix the "another hour" case; they do not cover "I am faster than planned".) | files cited | Confirmed |
| **RC-A6** | **A pace the walker once stated is sticky.** `state.params.paceMinPerKm` is saved in `assistant_chats.state` and re-read every turn (`stored-state.ts:22`, `route.ts:310-318`). `paceExplicit` is `params.paceMinPerKm !== undefined` (`AssistantChat.tsx:~511`), so **every later build in that chat re-applies the old pace mid-walk and overrides the walk's own pace**. Test sentences like "I walk 2 km/h" (the earlier feedback plan used exactly that) leave 30 min/km in the chat for good. The chat survives into the live walk (`WalkSlot` keeps it mounted). | files cited, `docs/PLAN-walk-feedback-2026-11.md` section 7 | Confirmed (mechanism). Likely (that it caused 2 km/h) |
| **RC-A7** | **Learned pace is one instantaneous reading.** At walk end, `buildWalkEndInput` stores `latestPaceUpdateRef.current?.paceMinPerKm` (the last 5 fixes) with `activeMinutes = elapsed` as the walk's pace (`WalkPlannerApp.tsx:~2276`, `walk-end.ts:49-52`). After 2 such walks it replaces the stored pace for the assistant and the form (`preference-store.ts:349-353`, `route.ts:179`). An amble to the end point, or a stop, trains the profile slow; EWMA 0.3 keeps it there. `elapsed` also restarts at every rebuild (see the loops plan, R5). | files cited | Confirmed (mechanism). Hypothesis (owner's row, section 8) |
| **RC-A8** | **After a pace change, `ReplanTrigger` still compares against the old plan pace.** It is created once and kept across rebuilds; only a fresh build clears it. `PaceAdvisor` is recreated with the new pace. So after "I walk 4 km/h" the two disagree, and with `fastPaceMode` on, the trigger would keep calling a 4 km/h walker "fast" against 2 km/h. | `WalkPlannerApp.tsx:2939` (`replanTriggerRef.current ?? new ReplanTrigger(...)`), `:2630` | Confirmed |
| **RC-A9** | **Unit trap in the tool.** `set_walk_params.pace_min_per_km` has no description and no unit guidance in the tool definition (`tools.ts:233`), accepts 0-60 (`tool-schemas.ts:81`) and applies any positive number without a clamp (`tools.ts:855, 883`). "4 km/h" mis-sent as `4` is accepted and plans at 15 km/h. `estimate_walk` returns per-leg `pace` but no top-level speed, no spare minutes. The `time` rule is one-sided (only "does not fit", `rule-verdict.ts` `limitRules`), so unused time is never reported. | files cited | Confirmed |
| **RC-A10** | **Cards decide on pace ratio, not on what matters (spare minutes), and mix bases.** The card's ratio uses the 5-fix instantaneous pace while the advisor's verdict came from a 5-min window (`WalkPlannerApp.tsx:1992-2000`). `spareMin = remaining * (1 - ratio)` and `overrun = remaining * (ratio - 1)` scale the stop-visit minutes too (`pace.ts:35-62`). | files cited | Confirmed |
| **RC-A11** | **Pauses and jitter are handled for one direction only.** `PaceAdvisor` drops hops under 10 m but still counts their time, so a 2-minute bench stop inside the window reads slow; `ReplanTrigger.hopDistanceMeters` has no jitter floor (hop sum inflates speed, reads fast). `SpeedEstimator` has a proper pause rule that none of the decision code uses. | `pace-advisor.ts:113-125`, `replan-trigger.ts:163-170`, `speed-estimator.ts:100-117` | Confirmed |
| **RC-A12** | **Keyword chat cannot take a speed.** `parseIntent` has "shorter" and "longer" word lists and no pace intent. "אני הולך 4 קמ"ש" matches nothing and goes to the LLM (which has no pace tool). Sentences like "too long" or "tired" are hard "shorter" intents. Precedence is skip > find > head-back > shorter > longer. | `walk/chat/intent.ts:49-56, 123-147` | Confirmed |

### Probable chain for the owner's report (to confirm with section 8)

1. Plan pace 2 km/h came from RC-A6 (an earlier "2 km/h" test sentence still in the chat state), RC-A7 (learned from end-of-walk readings), or a "Very slow" gear preset (25 min/km).
2. The walker went 2x faster. HUD/companion priced the rest at 2 km/h (RC-A2). Sunset or companion "shorten" prompts appeared, or the companion was asked and had only the "cut a stop" branch (RC-A3).
3. Nothing offered "lengthen" (RC-A4). If he told the main chat "I walk 4 km/h", the model re-timed the same stops and could not add time (RC-A5), or the stale chat pace overrode it (RC-A6).

### The opposite direction (slower than plan) is also wrong

- A walker below 0.5x the plan speed reads as "on plan" in the HUD (RC-A2), so the HUD never warns for the people who most need it.
- The slow card "shorten" is offered first even when the cause is a long lunch (stop dwell is cut from the advisor window but not from `fix.paceMinPerKm`, RC-A10).
- Slow pauses inflate the advisor's time span (RC-A11).
- No re-baseline: after "keep all stops", the walk is still planned at the old pace, so the advisor fires every 6 minutes.
- `minutesToFinishRemainingStops` floors the pace at `1.3 x planned`, measured or not (`planner-actions.ts:~460-470`: `Math.max(measured, planned * SLOW_PACE_RATIO)`): a walker at plan pace or faster still gets a 30% inflated "more time" quote.

---

## 4. Target behaviour (symmetric by construction)

### 4.1 One moving-pace tracker (new `src/lib/walk/moving-pace.ts`)

`MovingPaceTracker.record(fix)` accepts fixes with accuracy <= 35 m (the existing `SPEED_MAX_ACCURACY_M`), rejects jumps above 3.5 m/s (the existing gate), adds hops of at least 8 m (jitter floor, the `PAUSED_MIN_MOVE_M` value) and counts time only while `SpeedEstimator` says "moving" and the fix is not at a stop. Outputs:
`{ movingPaceMinPerKm | null, kmh | null, movingMs, movingM, windowMs, confidence: "none" | "low" | "ok" }` for a 5-min window and for the whole walk (survives rebuilds, see the `WalkLedger` in the loops plan, section 5). `confidence` is `ok` after 5 min of moving time **and** 400 m. The HUD keeps showing `SpeedEstimator.kmh` (responsive); every decision uses the tracker.

### 4.2 Projection without a cut-off (replaces the 0.5x-1.5x band)

`projectRemainingMin({ remainingM, remainingVisitMin, plannedPace, measured })`:
- `w = min(1, movingM / 600)` when `confidence !== "none"` else 0.
- `paceEff = plannedPace^(1-w) * measured^w` (geometric blend, symmetric in log space).
- Plausibility only at the human extremes: measured outside 6-40 min/km (10 km/h to 1.5 km/h) is ignored (falls back to planned); no band around the plan.
- Return `remainingM/1000 * paceEff + remainingVisitMin` (visit time never scaled).

### 4.3 One signed number: spare minutes

`spareMin = allowedMin - (elapsedMin + projectRemainingMin(...))`. Positive = ahead, negative = behind. Everything below keys off it, so fast and slow are the same rule with the sign flipped.

| Direction | Trigger (all must hold) | Offers (in order) | Never |
|---|---|---|---|
| **Behind** | `spareMin <= -max(8, 0.08 x remaining)` for 2 consecutive evaluations; confidence `ok`; not near a stop; hysteresis: clears at `-4` | 1 More time (keep all stops, `buildExtendedTimeRebuildRequest`), 2 Skip {stop} (`shorten`), 3 I will speed up | add a stop |
| **Ahead** | `spareMin >= +max(12, 0.12 x remaining)` for 2 consecutive evaluations; confidence `ok`; not near a stop; hysteresis: clears at `+6` | 1 Add {place} (priced at `paceEff`), 2 Lengthen the walk by about N min (`buildPaceRebuildRequest("sustained-fast-pace")`, discovery on, budget unchanged), 3 Finish early (head back), 4 Not now | shorten, skip |
| **Hard constraint** (sunset, end_by) | projected finish after the limit | Shorten with cap (existing) | n/a |

The ahead threshold is larger because a stop costs at least 15-20 min (visit plus detour); asking about 5 spare minutes is noise. Cooldown 6 min per direction (existing), plus **no second card within 10 min of a rebuild**. When a card is declined twice, stop asking in that direction for the rest of the walk.

### 4.4 Re-baseline (both directions)

If `|ln(measured / planned)| >= ln(1.3)` holds for 8 min of moving time and 600 m, set `walkInputRef.current.walkingPaceMinPerKm = round(measured, 0.5)` and rebuild `PaceAdvisor` **and** `ReplanTrigger` with it (carry the cooldowns). Silent; one quiet notice with Undo ("Planning at 4 km/h from here"). This removes the repeating cards and fixes RC-A8. An explicit walker statement (chat or keyword) sets the same value immediately.

### 4.5 Data contract for every assistant

Extend the extend plan's `CurrentWalk` (do not fork it):
```ts
pace?: {
  plannedMinPerKm: number;          // what the plan uses
  plannedSource: "stated" | "learned" | "gear" | "default" | "rebaselined";
  measuredMinPerKm: number | null;  // moving, last 5 min
  confidence: "none" | "low" | "ok";
  elapsedMin: number; allowedMin: number | null;
  projectedRemainingMin: number;
  spareMin: number | null;          // signed
}
```
`parseCurrentWalk` validates it (finite, 3-90 min/km, minutes 0-1440). Use it in two places:
1. The extend plan's `remainingMin` formula must call `projectRemainingMin`, not `min(availableMinutes, totalMinutes) - elapsed`.
2. `currentWalkNote` gains one line: `Pace: the walk is planned at {kmh} km/h ({pace} min/km, {source}); the walker is moving at {mkmh} km/h over the last {n} min. Spare time: {+S|-S} min ({ahead|behind}). Ahead means offer to extend or add a stop, never to shorten. Behind means offer more time or skipping one stop. Within 8 minutes either way say nothing.` Sentences are fixed by the server; only the numbers vary.

The in-walk companion gets the same fields in `timing` (`walk-turn.ts:89, 110-111`, parser at `walk-assistant/route.ts:59-63`) with the ahead/behind line, and its prompt bullet (`walk-turn.ts:26`) is rewritten to two branches (behind: propose one stop to cut, or more time; ahead: propose adding one stop or a longer loop; never propose cutting while spare is positive unless the walker asked).

### 4.6 Tool and prompt changes

- `set_walk_params`: add `speed_kmh` (1.5-8). The server converts `60 / speed_kmh`. Keep `pace_min_per_km` but validate 6-40 in `tool-schemas.ts` and return an actionable error outside it: `pace_min_per_km is minutes per km (a normal walk is 12-18, 4 km/h = 15); for a speed in km/h use speed_kmh`. Add a description with the conversion table. Echo `{ speed_kmh, pace_min_per_km }` in the output. If both are given, `speed_kmh` wins.
- Set `state.paceSetThisTurn = true` (never stored, same pattern as `timeSetThisTurn`); the build action gets `paceStated: true`. The client uses `build.paceStated` (replacing `params.paceMinPerKm !== undefined` at `AssistantChat.tsx:~511`), so a stale stored pace never overrides the walk's pace.
- `estimate_walk` output adds `speedKmh`, `paceMinPerKm`, and (when a time limit exists) `spareMin = timeMinutes - totalMin`. Extend the `time` rule with `status: met` plus `spareMin` and `slack: "ahead"|"tight"` so the model sees unused time too.
- `prompt.ts`: one rule, "Speeds are km/h, the tools take min/km or speed_kmh; 2 km/h = 30, 4 km/h = 15, 5 km/h = 12. When the walker states a speed, call set_walk_params with speed_kmh. Quote the speed back in km/h."
- `route.ts:~197` mid-walk note: replace "never add a stop they did not ask for" with "add a stop only when the walker asks, or when `Spare time` says ahead and they asked to extend".

### 4.7 Keyword chat (offline, no LLM)

In `src/lib/walk/chat/intent.ts` add an intent `set-pace`, checked **before** `shorter`/`longer`: a number followed by `km/h`, `kmh`, `קמ"ש`, `קמ״ש`, `קמש`, `קילומטר לשעה` (also "N kilometres per hour"). Action: re-baseline to that speed (4.4) and show the new projection. Qualitative words ("I'm walking fast", "אני הולך מהר", "slowly") map to the existing `PACE_FACTOR` (brisk 0.8 / stroll 1.33) as a re-baseline hint, with a confirm tap.

### 4.8 Sticky and learned pace

- Pace priority at plan time: stated this turn > walk's re-baselined pace > profile (learned) > gear default > 15. A stated pace is a property of **the walk**, not the chat: do not carry `state.params.paceMinPerKm` from one walk to the next (clear it when the plan is built and the walker presses New chat, and never apply it to a mid-walk rebuild unless `paceStated`).
- Learning: store the walk's **moving average** (`movingM / movingMs` from the whole-walk `WalkLedger`), not the last window, and only when moving time >= 10 min and distance >= 1 km; keep the 6-30 min/km sanity clamp. This replaces `paceMinPerKm: latestPaceUpdateRef.current?.paceMinPerKm` at `WalkPlannerApp.tsx:~2276`.

### 4.9 Unit display

Show "4 km/h · 15 min/km" everywhere a pace is shown (gear chips become "Very slow, 2.4 km/h" and so on, HUD plan line, assistant replies).

---

## 5. Prioritised fix list

| Pri | Fix | Files / functions | Fixes | Size |
|---|---|---|---|---|
| **P0** | Stop pricing a fast or very slow walker at the plan pace: replace the 0.5x-1.5x band with `projectRemainingMin` (4.2). Until the tracker exists, widen to 0.4x-2.5x symmetric in log space as a one-line stopgap. | `walk-stats.ts` `timeToFinishMin`; callers `WalkPlannerApp.tsx:800, 1986, 3330` | RC-A2, part of RC-A3 | S |
| **P0** | Give the model the numbers: `pace` in `CurrentWalk` and in the companion `timing`; server note; rewrite the companion bullet with both branches. | `current-walk.ts` (`parseCurrentWalk`, `currentWalkNote`), `state.ts`, `AssistantChat.tsx` (`getCurrentWalk`), `WalkPlannerApp.tsx` (builder), `walk-turn.ts:26, 89, 110`, `walk-assistant/route.ts:59-63`, `route.ts:~197` | RC-A1, RC-A3, RC-A5 | M |
| **P0** | Kill the sticky pace: `paceStated` per turn; build action carries it; client reads it. Do not apply chat-stored pace mid-walk. | `state.ts`, `tools.ts` handler (`set_walk_params`), `AssistantChat.tsx:~511`, `WalkPlannerApp.tsx:~3991` | RC-A6 | S |
| **P0** | Keep `ReplanTrigger` and `PaceAdvisor` on the same planned pace: recreate both (carry cooldown) whenever `walkInputRef.current.walkingPaceMinPerKm` changes. | `WalkPlannerApp.tsx:2630, 2939`, `replan-trigger.ts` (add `setPlannedPace`) | RC-A8 | S |
| **P1** | `speed_kmh` arg, 6-40 validation with an actionable error, descriptions, echo both units, `estimate_walk` `speedKmh`/`spareMin`. | `tool-schemas.ts:81`, `tools.ts` definition (:233) and handler (:855, :883), `limitRules` | RC-A9 | S |
| **P1** | Spare-minutes decisions and symmetric offers: new `paceDecision()`; fast card without `addPlace` becomes "Lengthen the walk" and "Finish early"; slow card puts "More time" first when only mildly behind; price `addPlace` at `paceEff`. | `companion/producers/pace.ts`, `companion-glue.ts` (`buildCandidates`, `pickAddPlace`), `WalkPlannerApp.tsx:1971-2050`, `operator-map.ts` (new `lengthen` operator reusing `buildPaceRebuildRequest("sustained-fast-pace")`) | RC-A4, RC-A10 | M |
| **P1** | `MovingPaceTracker` as the one source for cards and rebuilds (pause and jitter handling in both directions). | new `moving-pace.ts`; `pace-advisor.ts`, `replan-trigger.ts`, `walk-tracker.ts` consume it | RC-A11 | M |
| **P1** | Re-baseline planned pace silently with Undo, both directions. | `WalkPlannerApp.tsx` (new `rebaselinePace()`), `walk-copy.ts` notice strings | RC-A4/8, repeating cards | M |
| **P2** | Keyword `set-pace` intent (Hebrew and English forms). | `walk/chat/intent.ts`, `chat/reply.ts`, `chat-copy.ts`, `useWalkChat` action | RC-A12 | S |
| **P2** | Learned pace from the whole-walk moving average (needs the `WalkLedger` from the loops plan). | `walk-end.ts`, `WalkPlannerApp.tsx:~2276` | RC-A7 | S |
| **P2** | km/h next to min/km in presets and HUD. | `AssistantSettings.tsx:9-15`, `WalkSettingsPanel.tsx`, `walk-copy.ts` | RC-A9 (units) | S |
| **P2** | Server-side guard in `runWalkTurn`: drop a model-initiated `propose_skip_stop` when `spareMin > +15` and the walker's message has no skip/shorter intent (reuse `parseIntent`). Open question Q3. | `walk-turn.ts` tool dispatch | RC-A3 | S |

Build order: P0 items 1, 3, 4 first (they are small and independent), then 2 (shares plumbing with the extend plan's F3), then P1.

---

## 6. Tests (both directions; star = fails today)

Existing harnesses to extend: `tests/walk-stats.test.ts`, `pace-advisor.test.ts`, `replan-trigger.test.ts`, `companion-producers.test.ts`, `companion-glue.test.ts`, `assistant-turn.test.ts`, `walk-chat-intent.test.ts`, `walk-fast-pace-add.test.tsx`, and the simulator pace drift (`setSimulatedPaceDrift`, `planner-actions.ts` end, factors 1.6 slow and 0.6 fast).

1. star `tests/walk-stats.test.ts`, **table-driven over speed ratio r = measured/planned** in {0.3, 0.5, 0.67, 1, 1.5, 2, 3}: `projectRemainingMin` is monotone, equals the plan at r=1, uses the measured pace for r=2 **and** r=0.5 symmetrically (today r=2 falls back to plan and r=0.5 is used: asymmetric), falls back only outside 1.5-7.5 km/h. Worked case: plan 30 min/km, measured 15, 1 km left, 0 visit: expect 15 (today 30).
2. star `tests/pace-symmetry.test.ts`: feed `MovingPaceTracker` + `paceDecision` mirrored scenarios. Behind by 1.6x gives `behind`, ahead by 1/1.6 gives `ahead`; both need 5 min moving and 400 m; both clear at their hysteresis levels; a 2-minute pause inside the window changes neither; standing still with 3-5 m jitter yields no distance and no verdict; a stop within 100 m yields none. Mirror property: `decide(r)` and `decide(1/r)` are the same decision with the sign flipped for every r in the table.
3. star `tests/companion-producers.test.ts`: fast without `addPlace` returns a card with "lengthen" and "finish early" (today `null`); fast never contains `shorten`; slow never contains `add`; slow mildly behind lists "more time" first.
4. star `tests/companion-glue.test.ts`: `pickAddPlace` priced at the blended pace finds a place that the plan-pace pricing rejects (plan 30, measured 15, detour 12 min, 25 min spare).
5. star `tests/replan-trigger.test.ts`: after `setPlannedPace(15)` a 15 min/km walker is neither slow nor fast; with the old pace it is "fast" (regression for RC-A8). Mirror: plan 15, walker 30.
6. star `tests/assistant-turn.test.ts`: mocked model; `set_walk_params {speed_kmh: 4}` gives `paceMinPerKm 15` and `paceSetThisTurn`; `{pace_min_per_km: 4}` returns the unit error; a later turn without a stated pace does not set `paceStated` even though the stored state has `paceMinPerKm: 30` (RC-A6). `estimate_walk` output has `speedKmh`, `spareMin`.
7. star `tests/assistant-current-walk.test.ts`: `parseCurrentWalk` validates `pace` (drops NaN, out-of-range); `currentWalkNote` says "ahead ... never to shorten" for spare +25 and "behind ... more time or skipping one stop" for spare -25, and says nothing for +-5.
8. star `tests/walk-assistant.test.ts`: companion context contains pace and signed spare; with spare +25 and no skip intent the model's `propose_skip_stop` is dropped (if Q3 approved); with spare -25 it is kept.
9. star `tests/walk-chat-intent.test.ts`: "אני הולך 4 קמ"ש", "I walk 4 km/h", "2 kmh", "קמש 3" give `set-pace` with the number, before `shorter`/`longer`; "too long, I walk 3 km/h" is `set-pace`.
10. `tests/walk-fast-pace-add.test.tsx` and a new `walk-slow-pace.test.tsx` mirror: drive the planner with the simulator at 0.5x and 2x the plan pace; assert the ahead run shows only extend-type answers and the behind run only shorten/more-time, and that after re-baseline the card does not repeat within 10 minutes.
11. Optional, paid, owner-run: `tests/llm-eval/pace-live.test.ts` modelled on `variant-live.test.ts`, gated by `RUN_LIVE_PACE_EVAL`: seeded `current.pace` ahead by 30 min and the walker says "I walk 4 km/h": the model must not propose skipping and must offer an extension.

---

## 7. Risks and open questions

**Risks.**
- Re-baselining on noisy GPS could oscillate the plan pace. Mitigation: 8 min of moving time, 600 m, round to 0.5 min/km, never within 10 min of a rebuild, one Undo.
- More offers for fast walkers can feel pushy. Mitigation: ahead threshold 12 min or 12%, two declines stop it.
- The extend plan's F3/F4 are being built concurrently in the same files (`state.ts`, `tools.ts`, `AssistantChat.tsx`, `WalkPlannerApp.tsx`, `planner-actions.ts`). Land them first, then add `pace` as a field of the same `CurrentWalk`; do not create a second payload.
- Tightening the tool schema (6-40) will reject some stored/legacy calls; the error text must tell the model what to send.
- A tool-level guard (task 8) overrides the model; it is deterministic and covered by tests, but it is a behaviour change. See Q3.

**Open questions for the owner.**
- Q1. When ahead, which first: add a place, or lengthen with a loop? (Recommendation: place if one fits, else lengthen.)
- Q2. Re-baseline silently with Undo (recommended) or always ask?
- Q3. Allow the server to drop a model-proposed "skip a stop" while the walker is ahead of time and did not ask for it?
- Q4. Show pace as km/h first with min/km second (recommended), or the reverse?
- Q5. Should a pace stated in chat ever outlive the walk (recommended: no)?

---

## 8. Read-only checks to confirm the hypotheses (no secrets needed)

- Chat state: Supabase SQL editor, the owner's last chat: `select state->'params'->'paceMinPerKm', state->'params'->'timeMinutes' from assistant_chats order by updated_at desc limit 3;` A value near 30 confirms RC-A6.
- Learned pace: `select walking_pace_min_per_km, pace_by_env, session_count from profiles where id = '<owner id>';` Values above about 20 min/km with `n >= 2` confirm RC-A7.
- Saved walk: the last walk's `params->'walkingPaceMinPerKm'` in `saved_walks` shows which pace was actually used for the plan.
- Browser: `localStorage["traike.assistantDefaults.v1"].paceMinPerKm` (gear default, 25 = "Very slow").
- Ask the owner which screen said "shorten": a sunset line, a "slower than planned" card, the companion chat, or the main chat. That separates RC-A3 variants.

---

## 9. Verification checklist (builder)

1. `npx vitest run`; new star tests fail before and pass after; `npx tsc --noEmit`; `npm run lint`.
2. Simulator manual run (`npm run dev`, signed in): plan at 30 min/km, drift to 0.5x (fast). **Expect:** HUD minutes-left within 10% of truth, no "shorten" prompt, an "extend" type answer; then drift to 1.6x slow, **expect** "more time" first and no add-a-stop offer.
3. Say "I walk 4 km/h" in the main chat mid-walk and in the keyword chat: both re-baseline to 15 min/km, the rest of the walk is re-timed, the advisor stops repeating.
4. Open a new chat after a walk where a pace was stated: the next plan uses the profile or default pace, not the old statement.
5. No paid API calls in unit tests. Do not deploy (launch gate). Per the owner's Traike rule: commit and push the branch, then zip the repo to `~/Downloads`.
