# Live Walk review: pace (too fast / too slow) and changing the route mid-walk

Date: 2026-11-22. Branch `feat/design-r13-port`, reviewed at `4dbd5e5`.
Method: read-only code trace (no `src/` or test changes), the related suites run green
(9 files, 208 tests), and one scratch calculation against `paceCandidate`. Nothing here was
checked on a phone; the last section lists what only a real walk can confirm.
Line numbers in `WalkPlannerApp.tsx` are from the working tree, which had 5 uncommitted lines
(compass heading, another session) on top of `4dbd5e5`. At `4dbd5e5` itself, subtract 1 after line
109, 3 after line 648 and 4 after line 2639. All other files match `4dbd5e5`.

---

## Summary in plain words

**Is it working? Partly.** The app notices when you walk faster or slower than planned and asks
what to do. Most of the time it does not then fix the route well:

1. **When it makes the route longer or shorter, it still uses the old planned speed.** A walker
   who is twice as fast gets a "longer" route sized for the slow plan and still finishes early.
   A slow walker gets a "shorter" route that is still too long, and sometimes exactly the same
   route, with no message.
2. **The new "Plan at 4.5 km/h" button (added this morning) only changes a number.** The route
   stays the same, and after that tap the app stops offering to lengthen the walk. In the
   case that started this (planned 2 km/h, walking 4.5), an hour's walk can end about half an hour
   early and nothing offers to add anything. The quick chat's "Plan at X km/h" button works the same way.
3. **Walks that end back at the start lose that after any mid-walk change.** The new route ends
   where you were standing when you changed it, not at your start or your car.
4. **Some changes you ask for while the route is already being updated do nothing, with no
   message.** One sequence (ending a walk during an update, then pressing Start on the same
   plan) can leave every later change on that walk not working.
5. **After a change, the walk's time and distance count from zero.** The finish card and your
   saved walk then show only the last part. After the app reloads in the middle of a walk, the
   next change counts the time already walked twice.
6. **Some of these cards are English-only in the Hebrew app**: the older pace cards, "Updating
   your route…", and the over-time warning.

**What works well.** "Back to my route" is solid. A failed or slow update always keeps the
route you were on and tells you. Stops you already visited stay visited through changes, undo
and reloads. The grey trail of where you walked is kept. Every change from the chat needs a tap.

**What to fix first:** problems 3, 4, 1+2 together, then 5. The table below has a short fix for
each one.

### בקצרה, בעברית

האפליקציה מזהה נכון כשהולכים מהר או לאט מהתוכנית, אבל התיקון של המסלול עדיין לא טוב:

- **הארכה וקיצור מחושבים לפי הקצב הישן.** אחרי "להאריך" מי שהולך מהר עדיין מסיים מוקדם.
  אחרי "לקצר" מי שהולך לאט עדיין חורג מהזמן, ולפעמים מקבל בדיוק אותו מסלול בלי שום הודעה.
- **הכפתור החדש "לתכנן לפי 4.5 קמ״ש" משנה רק את המספר, לא את המסלול.** אחריו האפליקציה כבר לא
  מציעה להאריך, ומסיימים כרבע שעה עד חצי שעה מוקדם.
- **במסלול שחוזר להתחלה**, כל שינוי באמצע מחזיר אתכם לנקודה שבה עמדתם בזמן השינוי, ולא להתחלה.
- **בקשה לשינוי בזמן שהמסלול עוד מתעדכן נבלעת בלי הודעה.**
- **אחרי שינוי, הזמן והמרחק של ההליכה מתאפסים**, ולכן בכרטיס הסיום רואים רק את החלק האחרון.
- **כמה כרטיסים עדיין מופיעים באנגלית** גם כשהאפליקציה בעברית.

מה שעובד טוב: "לחזור למסלול", שמירה על המסלול הקיים כשעדכון נכשל, ושמירה על העצירות שכבר ביקרתם בהן.

---

## 1. Verdicts

| Area | Verdict | One line |
|---|---|---|
| A1 Measuring pace (speed, windows, debounce) | Partly works | The detectors are careful, but four of them each measure speed differently. The numbers on the questions come from the last 4 seconds of GPS. |
| A2 Too fast, offer to lengthen | **Partly broken** | The offer appears. The longer route is sized at the planned (slow) pace. "Plan at X" turns the offer off. The companion question undercounts the spare time. |
| A3 Too slow, offer to shorten | Partly works | The offer appears. The shorter route is sized at the planned (fast) pace, so it still overruns, and can come back unchanged with no message. |
| A4 Pace-mismatch prompt (`9a6f400`) | Works as a detector, but its action works against the goal | It detects correctly (faster only). The action is a re-base with no route change. The card has no time limit and blocks safety questions. "Keep" is forgotten after any rebuild. |
| A5 ETA and remaining time after a change | Partly works | "Time to finish" is correct (it uses the measured speed). Elapsed and walked time restart on each rebuild. Next-stop minutes still use the planned pace. Resume and revert put elapsed on two different clocks. |
| A6 Copy symmetry, EN and HE | **Broken in places** | The companion questions are symmetric and bilingual. The older pace cards, the pace-ask card, the rebuilding overlay and the pinned warning are English-only. |
| B1 "Back to my route" (local rejoin) | Works | Well guarded: stale fix, busy, cooldown, and never skips a stop. |
| B2 "Best route from here" / redraw | Works, with problem P3 | Make-before-break, keeps the old route on failure. Loop walks close at the wrong point. |
| B3 Walk chat (quick keyword chat) | Partly works | "Plan at X km/h" does not re-plan. "Back to the route" in Hebrew is read as "head back to the start". |
| B4 Sol (planner chat) changing the walk mid-walk | Partly works | Builds are queued, not dropped, which is good. The tools price at the wrong pace and time. End point, loop and radius changes mid-walk are silently ignored. |
| B5 Direction options / "Head back" | Partly works | "Head back" is not offered to a walker who is late and far from the start. A head-back route can be overwritten by an update that was already running. |
| B6 Concurrency between updates | **Broken in specific sequences** | Requests made during an update are dropped without a message. The "update running" flag can get stuck. |
| B7 Keeping progress | Partly broken | Visited stops and the walked trail survive. Elapsed time, distance, the finish card and the saved run only cover the last leg. |

---

## 2. Problems, ranked, with a minimal fix

Line numbers are `src/components/planner/WalkPlannerApp.tsx` unless a file is named.

### P1. Lengthen and shorten rebuilds are sized at the planned pace, not the walker's pace (A2, A3)
- **Evidence:** `buildMidWalkRebuildRequest` copies `...orig`, so `walkingPaceMinPerKm` is the plan's
  (`src/lib/walk/planner-actions.ts:540-549`). `buildPaceRebuildRequest` never changes it (`:88-101`),
  and `tests/planner-actions.test.ts:133-137` asserts exactly that. `/api/walk-plan` sizes the walk at
  the pace it is sent (`src/app/api/walk-plan/route.ts:394-396`).
- **Effect:**
  - *Fast walker, "Lengthen" or "Extend":* the filler fills `available − elapsed` minutes at the slow
    planned pace, so the walker finishes early again.
  - *Slow walker, "Show shorter route":* the planner drops only what does not fit at the faster planned
    pace. Often nothing is dropped (see P15). Real time stays about the pace ratio over budget.
  - Only "Keep all / Give me more time" uses a measured pace (`minutesToFinishRemainingStops`,
    `planner-actions.ts:451-478`). That pace is the 4-second `fix.paceMinPerKm` read at the moment of
    the tap, when the walker is usually standing, so it is often null and falls back to 1.3× the plan.
- **Minimal fix:** add an optional `sizingPaceMinPerKm` to `PaceRebuildState`. For pace rebuilds, set
  the rebuild input's `walkingPaceMinPerKm` to the sustained measured pace (SpeedEstimator smoothed km/h,
  or the PaceAdvisor 5-minute window), clamped to 6-40. Call `rebaselinePace` with the same value so the
  next card is judged against it. Flip the test at `planner-actions.test.ts:133-137` for the pace path.

### P2. "Plan at X km/h" changes numbers only, and silences the lengthen and shorten offers (A2, A4, B3)
- **Evidence:** `rebaselinePace` (`2216-2230`) only edits `walkInputRef` and the three detectors.
  It is wired to the mismatch card (`3612`) and to the chat's `set-pace` action (`3723-3724`). After it
  runs, `PaceAdvisor`, `ReplanTrigger` and `PaceMismatchWatcher` compare against the new pace, so the
  ratio is about 1 and no fast or slow card fires again. The chat copy promises more than this:
  "I can plan the rest of the walk at that speed" (`src/lib/walk/chat/reply.ts:74`, HE `:98`). Compare
  Sol's path, which really rebuilds when the pace is stated (`4183-4195`).
- **Effect:** in Ariel's field case (planned 2 km/h, walking 4.5), accepting the card leaves the
  2 km/h-sized route in place. On a one-hour walk the walker can arrive around half an hour early, and nothing offers to lengthen.
  The mirror case also happens: telling the chat "I walk 2 km/h" on a 4 km/h plan suppresses the slow
  card, so nothing offers to shorten.
- **Minimal fix:** after a re-base, compute `spare = available − elapsed − timeToFinish` (already
  computed for the chats at `3703-3706`). If `|spare| ≥ 10`, raise one follow-up card: "~N min spare,
  lengthen?" or "~N min over, shorten?". Its answers run the P1-fixed rebuild. Alternatively, make the
  primary button "Plan at X and fit the walk" and run the rebuild directly. Change the copy to match.

### P3. Walks that end back at the start close at the walker's current position after any mid-walk rebuild (B2, A2, A3)
- **Evidence:** the server added `returnTo` for exactly this ("Mid-walk the origin is the walker's
  position, so the client sends the real start", `src/app/api/walk-plan/route.ts:411-418`, used at
  `:729` and in `src/lib/optimization/tsp-planner.ts:473`). No client code sends it: the
  `handleBuildWalk` body is at `1616-1636`, and a repo grep finds no sender. Mid-walk `origin` is the
  current position (`planner-actions.ts:525`), so `[returnTo ?? origin]` closes the loop where the
  rebuild happened.
- **Affects:** every mid-walk path through `handleBuildWalk` (pace, add stop, drop stop, redraw, Sol,
  direction options with stops) on a walk with `maxEndDistanceFromOriginMeters === 0`.
- **Minimal fix:** in the `/api/walk-plan` body add
  `returnTo: options?.autoResume ? input.endAnchor : undefined`. `endAnchor` is already pinned to the
  original start (`planner-actions.ts:548`). Add a test that a mid-walk rebuild of a loop sends `returnTo`.

### P4. Fill rebuilds can re-add stops already visited or skipped (A2, B3)
- **Evidence:** `/api/walk-plan` has no visited or excluded input (no match in `route.ts`). The client
  removes visited stops only from `keepAttractions` (`1525-1528`). It sends `visitedIds` only to
  `/api/ai-walk-plan` (`1584`), which is skipped mid-walk (`1563`, `!options?.autoResume`). The
  companion's "Lengthen" runs `runCappedPaceRebuild` (`2111-2119`) without a heading, so the
  "ahead only" cone is off (`route.ts:457-467`). The best-ranked places nearby are usually the ones the
  original plan already chose, so already-visited stops are the likeliest candidates to come back.
- **Minimal fix:** send `excludeIds` (visited plus stops dropped or skipped this walk) to
  `/api/walk-plan` and filter `ranked` by them. Pass `heading` in `runCappedPaceRebuild` the way
  `runPaceTriggeredRebuild` does (`1812-1821`).

### P5. A change requested while an update is running is silently dropped, and the "running" flag can get stuck (B6)
- **Evidence:**
  - `handleBuildWalk` returns `null` for any mid-walk build except Sol's while one is in flight
    (`1452-1453`). Callers do not report this:
    - `chooseOption` (`3267-3283`) has already closed the options sheet.
    - The chat's Skip / Apply / Add place (`runDropStopsRebuild`, `runApplyChangesRebuild`,
      `runAddPlaceRebuild`), the companion answers, and "Keep all stops" do nothing visible.
  - `addPlaceToLiveWalk` pins the place and marks it `added` before building (`1876-1879`). On this
    `null` the request id was never bumped, so the undo check `=== requestBefore + 1` (`1885`) is false.
    The place stays pinned and marked "added", so it is never offered again, yet it was never added.
  - **Stuck flag:** `handleEndWalk` aborts and bumps the request id (`1095-1096`). The aborted build's
    `finally` then skips the block that clears `midWalkRebuildInFlightRef` (`1750-1765`). The next
    build without `autoResume` resets it (`1459`), but a walk restarted with Start Walk on the same
    plan, or resumed after a reload, never goes through that. For that whole walk, every automatic or
    tapped rebuild is dropped and every Sol build waits forever in `queuedMidWalkBuildRef`.
- **Minimal fix:**
  - Clear `midWalkRebuildInFlightRef`, and resolve and clear `queuedMidWalkBuildRef`, in `handleEndWalk`
    and at the top of `handleStartWalk` when it is not an auto-resume.
  - When dropping a tapped request, show "Still updating your route, try again in a moment"
    (EN and HE), or queue tapped requests the same way as `aiDecided` ones.
  - In `addPlaceToLiveWalk`, also revert when `buildWalkRequestIdRef.current === requestBefore`.

### P6. "Head back" (a stop-less option) can be overwritten by an update already running (B5, B6)
- **Evidence:** `startFromOptionRoute` (`3233-3264`) swaps the route directly. It does not cancel the
  build in flight, bump `buildWalkRequestIdRef`, or clear the flag. When that build returns, it passes
  the id check (`1641`) and `commitSwap` replaces the head-back route (`1656`).
- **Minimal fix:** at the start of `startFromOptionRoute`, call `cancelBuildRef.current?.()`, add 1 to
  `buildWalkRequestIdRef.current`, and set `midWalkRebuildInFlightRef.current = false`.

### P7. Time, distance, the finish card, the saved run and the learned pace only cover the last leg (A5, B7)
- **Evidence:**
  - Each rebuild calls `stopWalkTracking`, which nulls `firstFixAtRef` and `walkStats` (`873-881`).
  - `commitSwap` resets `walkStartTimeRef` (`1490`).
  - The new geometry starts at the walker, so `walkedM` restarts from 0 (`792-807`).
  - At the end, these values feed the finish card (`1069-1073`), `updateWalk` and `recordRun` (minutes,
    distance, start time; `2319-2324`), and the learned-pace input (`plannedMin`, `actualMin`,
    `paceMinPerKm`; `2339-2351`). The pace is taken from the 4-second `fix.paceMinPerKm` at the moment
    of ending.
  - Everything is skipped when the last leg is under 1 minute (`2307`, `2313`, `2335`).
- **Minimal fix:** add walk-level accumulators: `walkStartedAtRef`, set once per walk, and
  `walkedBeforeLegM += walkStats.walkedM` at each `commitSwap`, splice and `startFromOptionRoute`. Use
  them for the finish card and saving. Feed the learned pace from total distance ÷ moving time, or from
  the SpeedEstimator average, not the last 4 s.

### P8. After a reload mid-walk, every later rebuild counts elapsed time twice (A5, B7)
- **Evidence:** `resumedStartRef` is set on resume (`945`) and cleared only at End (`1066`). Every leg's
  first fix sets `firstFixAtRef = resumedStartRef ?? fix` (`2754`). A rebuild's `availableMinutes` is
  already "what is left" (`planner-actions.ts:514-519`). Results:
  - `overBudget` is true.
  - `spareMin` goes strongly negative, both in the chats and in Sol's `pace.spareMin`.
  - The direction options' `remainingMin` is floored to 15 (`669-682`).
- **Minimal fix:** set `resumedStartRef.current = null` inside `commitSwap`, `startFromOptionRoute` and
  `revertToSnapshot`. It is only right for the first leg after a reload.

### P9. "Back to previous route" puts elapsed time on two clocks (A5, B7)
- **Evidence:** `revertToSnapshot` restores `snapshot.input` (the original full `availableMinutes`) and
  `walkStartTimeRef = snapshot.startTime` (`3081-3083`). `handleStartWalk` then resets `firstFixAtRef`,
  so the HUD and `getOptionsContext` count elapsed time from 0 against the full original budget. Rebuilds
  use `walkStartTimeRef` (`1791`), so the two "time left" values disagree. A pace re-base made after the
  snapshot is also lost.
- **Minimal fix:** for the reverted leg, start the fix clock at `snapshot.startTime` (the same mechanism
  P8 uses), and keep the current `walkingPaceMinPerKm`.

### P10. The pace questions show wrong numbers and use a 4-second speed (A2, A3, A6)
- **Evidence:**
  - `getCompanionSnapshot` passes `walkStats.timeToFinishMin` as `remainingWalkMin` (`2037-2039`).
    That value is already priced at the measured speed and includes visit minutes.
  - `paceCandidate` treats it as "minutes left at the planned pace" and multiplies it by `(ratio − 1)`
    or `(1 − ratio)` (`src/lib/walk/companion/producers/pace.ts:40`, `:67`).
  - The ratio comes from `fix.paceMinPerKm` (`2049-2054`): the last 5 fixes, no jitter floor, null
    outside 5-30 min/km (`src/lib/walk/walk-tracker.ts:51`, `158-186`). So it is null for walkers slower
    than 2 km/h.
- **Measured with a scratch run of `paceCandidate`:**
  - *1.5× slower, 2 km and 20 min of visits left:* the true overrun against the plan is 15 min. The card
    says "Keep all, add 33 min" and leads with "Shorten" because 33 is past the 10-min "mild" line.
  - *2.25× faster (2 km/h plan, walking 4.5), 3 km left:* the walker is about 50 min ahead of the plan.
    The card says "about 22 min ahead". With somewhat less left it falls under the 12-min floor
    (`pace.ts:28`) and asks nothing.
- **Minimal fix:** give the producer the same signed `spareMin = available − elapsed − timeToFinish` the
  chats use. Base the slow/fast decision and `n` on it. Take the ratio from the SpeedEstimator's smoothed
  km/h, not `fix.paceMinPerKm`.

### P11. An unanswered pace-mismatch card stays forever and blocks every companion question, safety included (A4)
- **Evidence:** `paceMismatchOffer` has no time limit; it is cleared only at `876`, `2223` and `3617`.
  `getCompanionSnapshot` counts any card that is not a companion card and not `pace-(slow|fast)` as
  blocking (`2061-2066`). This sets `questionOnScreen` (`src/lib/walk/companion/companion-engine.ts:80-84`),
  and the arbiter then returns nothing (`companion-arbiter.ts:170`). Sunset, heat and rain questions
  wait behind it.
- **Minimal fix:** give it the 60-s `ADVISOR_CARD_TTL_MS` like the other pace cards (the watcher can ask
  again later), or add `pace-mismatch` to the exclusion pattern at `2064`.

### P12. "Keep" and the card cooldowns are forgotten after every rebuild (A1, A4)
- **Evidence:** `handleStartWalk` builds a new `PaceAdvisor` and `PaceMismatchWatcher` for every leg
  (`2722-2729`; `stopWalkTracking` nulls them at `874-875`). `ReplanTrigger` is deliberately carried
  over (`3042-3047`), but these two are not. Results:
  - After "Keep 2 km/h", any add-stop or redraw re-arms the question 3 min later.
  - After a shorten rebuild, a still-slow walker (see P1) gets the slow card again about 3 min later
    (60% coverage of the 5-min window), not 6.
- **Minimal fix:** keep both objects for the whole walk, as with `replanTriggerRef`. On a new leg, clear
  their samples but keep `phase` and `lastCardAt`.

### P13. English-only strings in the Hebrew app, in exactly these flows (A6)
- Older pace cards: `walkCopy.pace` has no `he` (`src/lib/walk/walk-copy.ts:125-141`). Used at
  `3503-3550` (the "ask" setting) and `3622-3651` (the advisor card). That card shows in Hebrew whenever
  the companion does not take the question (quiet level, near a turn, its own cooldown, `n` below 12).
- "Updating your route…" / "Still working, this one is slow." / "Keep my current route" (`3422-3426`).
- The pinned over-budget warning (`1705-1709`). `REPLAN_CANCELLED_MESSAGE` (`264`).
- **Minimal fix:** add `en`/`he` pairs, the way `paceMismatch` and `notice` already do.

### P14. The same situation gets different answers depending on timing (A2, A3, A6)
- **Slow:**
  - Older card: "Show shorter route" (re-time, and the planner may drop any stop) / "Keep all stops".
  - Companion: "Skip ⟨last unpinned stop⟩" / "Keep all, add N min".
  - Chat: pick which stop to drop.
- **Fast:**
  - Older card: "Extend the hike" (add one place).
  - Companion: "Add X" / "Lengthen" (fill) / "Finish early".
  - Mismatch card: re-base only.
- Which one the walker sees depends on the companion's gates and the card order (`3569-3652`).
- **Minimal fix:** one decision from `spareMin` (P10) produces one question with one set of answers. The
  older card becomes a fallback that shows the same answers in both languages.

### P15. "Shorter" can silently do nothing, and no change is summarised (A3)
- **Evidence:**
  - The slow rebuild keeps every stop that still "fits" at the planned pace (P1).
  - After a pace rebuild the only result line is the add-stop "nothing fit" notice (`1935-1937`).
    `runCappedPaceRebuild` and `runPaceTriggeredRebuild` say nothing.
  - "Skip X to finish on time?" never checks that skipping X covers the overrun.
- **Minimal fix:** after any pace rebuild, compare stops and `totalMinutes` before and after, then show
  either "Shortened: −1 stop, ~N min left" or "Couldn't shorten more. Head back?".

### P16. "Head back" is missing for the walker who needs it most (B5)
- **Evidence:** the "short" option exists only if walking straight home fits in 60% of `remainingMin`
  (`src/lib/walk/direction-options.ts:205-224`, `OPTIONS_SHORT_FRACTION = 0.6`). `remainingMin` is
  priced at the planned speed (`683`). A walker who is late and far out gets "Couldn't find a shorter way
  back" (`2148`).
- **Minimal fix:** when the walker asks for head-back or "Finish early", always offer the direct route to
  the anchor, whatever the budget.

### P17. "Back to my route" typed in the chat is read as "head back to the start" (B3)
- **Evidence:** `HEAD_BACK_WORDS` include "go back", "חזרה" and "תחזיר" (`src/lib/walk/chat/intent.ts:47-51`).
  There is no rejoin intent. "תחזיר אותי למסלול" and "go back to the route" offer "Head back" / "חזרה"
  (to the start). It needs a tap, so it is not destructive, but the Hebrew button "חזרה"
  (`reply.ts:94`) reads like "back to the route".
- **Minimal fix:** add a `rejoin` intent (a back word plus a route word, "route" / "מסלול") whose action
  calls `runLocalRejoin(false, { manual: true })`. Relabel the HE head-back button "חזרה להתחלה".

### P18. Sol (planner chat) mid-walk: its tools and the walk disagree (B4)
- **Pace and time:**
  - `estimate_walk` / `build_walk` price at `state.params.paceMinPerKm ?? 15`
    (`src/lib/assistant/tools.ts:1007`, `:1208`).
  - Mid-walk, the profile pace is deliberately not loaded (`src/app/api/assistant/route.ts:181-184`).
    The walk's real pace reaches Sol only as prose (`src/lib/assistant/current-walk.ts:97-105`).
  - The time verdict uses the chat's stored `timeMinutes`, often the whole-walk value from before the
    walk started.
  - Result: Sol says "fits", then the client builds at the real pace with Sol's stops pinned, which can
    produce the English over-budget warning.
- **Ignored changes:**
  - The mid-walk branch of `onBuild` (`4182-4195`) takes only a stated pace and a stated time.
    `maxEndDistanceFromOriginMeters` (including 0, "back to start") and `radiusMeters` from Sol are
    dropped, so "end back where I started" or a new end limit asked mid-walk is not applied.
  - `extraWishlist` is appended to Sol's stops mid-walk (`4180`, `4184`), which can re-add a queued
    place the walker just asked to drop, and with `fixedOrder` it lands after an "end at X" stop.
- **Minimal fix:**
  - When `walking`, seed `params.paceMinPerKm` from `current.pace.plannedMinPerKm` and `timeMinutes`
    from `current.remainingMin`, unless set this turn.
  - Pass Sol's stated end distance into the mid-walk input. For 0, also send `returnTo` (P3).
  - Do not append `extraWishlist` mid-walk.

### P19. The simulator makes mid-walk rebuild budgets wrong (A1, A3; a testing trap)
- **Evidence:**
  - `midWalkRebuildState` uses `now: Date.now()` (`1792`) against the wall-clock `walkStartTimeRef`
    (`1490`, `3259`), while the simulator's fix clock runs 10× (`src/lib/walk/simulated-walk-tracker.ts:103-107`).
  - Example: at simulated minute 40 of a 60-min walk, "Show shorter route" builds with about 56 min
    left, which is *longer* than what remains. Sol's `remainingMin` (`4220-4226`) has the same problem.
  - The carried `ReplanTrigger` cooldown is in simulated time, far ahead of the next leg's clock, so with
    the pace modes on it never fires again in a simulation after the first rebuild.
  - The simulator also reports an exact `paceMinPerKm`, which hides the real-GPS noise in P10.
- **Minimal fix:** compute elapsed from the fix clock (`firstFixAtRef` / `fixClockNow`) in
  `midWalkRebuildState` and `getCurrentWalk`. Reset the trigger's cooldown when a new leg's clock is
  behind it.

### P20. The mismatch prompt may never fire on a city walk (A4)
- **Evidence:** any reading that is paused, unknown or under 2× resets the 3-minute run
  (`src/lib/walk/pace-mismatch.ts:63-72`). SpeedEstimator reports "paused" after about 18 s standing
  (`speed-estimator.ts:102-117`, `PAUSED_WINDOW_MS = 20 s`). A red light every 2-3 minutes keeps
  resetting it.
- **Minimal fix:** count moving time of at least 3 min inside a 5-min window. Skip paused readings
  instead of resetting.

### P21. Lower priority
- Places added from the chat are pinned for that one build only. `runAddPlaceRebuild`,
  `runApplyChangesRebuild` and Sol's path never write `pinnedAttractionIdsRef`; only
  `addPlaceToLiveWalk` does (`1878`). The next shorten can drop a place the walker asked for.
- "Next stop in N min" uses the planned pace (`3754-3758`), while "Time to finish" uses the measured
  speed (`src/lib/walk/walk-stats.ts:44-57`), so the two can disagree on the same screen.
- A superseded queued Sol build resolves `null` (`1455`). The chat then says "The map was not updated:
  the new route could not be built", which is wrong: it was replaced, not failed.
- The walked trail is not saved with the active walk (`saveActiveWalk`, `970-979`), so it is gone after
  a reload.
- After revert or resume, matching starts at segment 0 with a 50-segment forward window
  (`2669-2674`, `src/lib/walk/deviation-detector.ts:34-35`). A walker far along the route may briefly
  read as off-route. Check on a device.
- `rebaselinePace` does not re-price discovery (`discovery.setRoute` speed) until the next leg.

---

## 3. Test gaps

None of these are covered today; each would have caught one of the problems above.

1. A mid-walk rebuild of a loop walk sends `returnTo` = the original start (P3).
2. Pace rebuilds use the sustained measured pace, and a fast "Lengthen" fills enough minutes at that
   pace. A slow "Shorter" ends within budget at the walker's pace (P1).
3. "Plan at X" (mismatch card and chat `set-pace`) followed by spare ≥ 10 min still leads to a
   lengthen offer. The same for the slow mirror (P2).
4. A fill rebuild never returns a visited or skipped stop (P4).
5. Tapping an option, a chat Skip or Add, or a companion answer while a rebuild is in flight either
   queues or tells the walker. `addPlaceToLiveWalk` reverts its pin in that case (P5).
6. End walk during a rebuild, then Start Walk on the same plan: a later rebuild still runs. The current
   `walk-planner-rebuild-timeout.test.tsx:293` stops at "aborted" (P5).
7. Head-back chosen while a rebuild is in flight stays the active route (P6).
8. The finish card and `updateWalk` after two rebuilds report the whole walk's minutes and metres (P7).
9. Resume after reload, then a rebuild: `elapsedMin + remaining` still equals the original budget (P8).
   The same check after revert (P9).
10. The `paceCandidate` input is the real spare or overrun. A table test like the scratch numbers above
    (P10).
11. An unanswered mismatch card expires or does not block a sunset or heat question (P11).
12. "Keep" survives a rebuild. The advisor cooldown survives a rebuild (P12).
13. The Hebrew UI shows no English text on the pace and rebuilding cards (P13). A snapshot over
    `walkCopy` keys with `he` coverage would do.
14. Intent: "תחזיר אותי למסלול" and "go back to the route" are a rejoin, not head-back (P17).
15. Sol mid-walk: `onBuild` with `endDistanceKm: 0` produces a loop input; estimate pace equals the
    walk pace (P18).
16. Mismatch with red-light pauses (moving 2 min, paused 40 s, moving 2 min) still offers (P20).

---

## 4. What I could not verify without a real phone

- **Real GPS noise on `fix.paceMinPerKm` (5 fixes, about 4 s).** How often it is null, or reads fast
  while standing in a street canyon. The simulator reports an exact pace, so the simulator cannot show
  this (P10, P19).
- **Whether iOS Safari gives `coords.speed` while walking.** It decides whether SpeedEstimator uses
  Doppler or the 30-s position window, and so how fast "moving" and "paused" switch (P20).
- **Locked screen and backgrounding.** Fixes stop, and the straight-line hop across the gap under-counts
  distance, so the walker reads as slower right after unlocking.
- **How long real Overpass and ORS rebuilds take.** This sets how often the in-flight drop in P5 and
  P6 actually happens on a walk.
- **Whether ORS really closes a loop at `returnTo` once it is sent** (P3 fix), and how the rebuilt loop
  looks.
- **The revert and resume segment-0 match** (P21): whether it briefly shows off-route on a long route.
- **Hebrew rendering of the mixed English/Hebrew cards** on a small screen.

A short field script that covers most of these:
1. A 2 km/h-planned walk walked at about 4.5 km/h. Tap "Plan at…" and check whether anything offers
   to lengthen.
2. A loop walk with one "add a stop" mid-way. Check where the new route ends.
3. Tap "Lengthen", then "Head back" within about 10 s.
4. Reload the page mid-walk, then add a stop. Check the time left.
5. End the walk. Compare the finish card with the phone's own step or distance count.

## 5. Suggested order

1. **P3** (`returnTo`, one line plus a test).
2. **P5 and P6** (stuck and silent updates).
3. **P1, P2 and P10 together** (one source of truth: sustained measured pace plus signed `spareMin`,
   driving one lengthen/shorten question).
4. **P7, P8 and P9** (walk-level clocks and accumulators).
5. **P11, P12 and P13** (card hygiene and Hebrew).
6. **P4, P16, P17 and P18.**
