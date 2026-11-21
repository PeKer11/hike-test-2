# Live-walk field fixes: three bugs from a real walk

Date: 2026-11-21 · Branch: `feat/design-r13-port` · Status: causes found, plan written first, fixes built per bug (see "Status" at the end).

**Owner report (Hebrew, translated):** on a real walk (1) he asked the assistant for 2 km/h for an hour, walked 4.5 km/h, and the app never asked whether to update the route or pace; (2) during "בוויז" along the way the location stayed stuck "in the middle" and the map froze; (3) the "You've reached the end of your route" card appeared a bit before the real end (screen: "Distance to finish 0.0 km", "Time to finish 1 min", buttons "Finish walk" / "Keep walking", "Ask").

Evidence labels: **Confirmed** = read in code and traced; **Likely** = fits the code and the report, not provable without a device; **Not confirmed** = could not be shown by reading.

Line numbers come from the working tree on 2026-11-21 (`WalkPlannerApp.tsx` is being edited by another agent, so function names are the stable reference).

---

## Bug 3: "reached the end" appears before the real end

### Cause (Confirmed)

- `WalkPlannerApp.tsx:211` `const FINISH_REMAINING_M = 40;` and the `else if` in the walk-alert chain (`:~3598-3622`, id `walk-finished`) fire the card on **one** evaluation of `walkStats.remainingM <= 40` plus "every stop visited". Nothing else gates it.
- `remainingM` comes from `progressAlong()` (`walk-stats.ts:19-31`): route length minus the distance along the line to the walker's **projected** point. It is not a distance to the end point, it is a position along the polyline, so a fix with 10-30 m of GPS error moves it by that much. `refreshWalkStats` (`WalkPlannerApp.tsx:~796-837`) feeds it from the last engine-grade fix (accuracy up to 50 m, `walk-cadence.ts:ENGINE_MAX_ACCURACY_M`) and also re-runs on every 5 s tick from the same stale fix.
- So the card fires about 40 m (roughly 30 s of walking at 4.5 km/h) early, and a single noisy fix is enough. `WalkStatsBar.tsx:75` prints `remainingM / 1000` with `toFixed(1)`, which is why the screen showed "0.0 km" and "1 min" while he was still walking.
- 40 m was owner decision D6 in `docs/PLAN-walk-feedback-2026-11.md` (section 6), taken from code only. The field test says it is too early.
- Related weakness (not changed): "Keep walking" sets `finishKeepWalking` (`:415`), which mutes the card for the rest of the walk. A walker who taps it early never sees the real arrival.

### Plan

1. New pure `RouteEndDetector` (`src/lib/walk/route-end.ts`): confirmed only when `remainingM <= 15` **and** fix accuracy `<= 30 m` has held for `>= 5 s` of **fix time** across at least two distinct fixes. Repeating the same fix (the 5 s tick re-reading a stale one) never advances the dwell. Any fix outside the zone resets it.
2. `refreshWalkStats` feeds it and stores `atRouteEnd` on `WalkStatsData` (optional field); the alert condition reads `walkStats.atRouteEnd` instead of `remainingM <= 40`. Detector reset in `stopWalkTracking`.
3. Constants live next to the detector, with the reasoning in a comment.
4. Tests: `tests/route-end.test.ts` (unit: outside zone, inside zone one fix, dwell met, accuracy too poor, stale fix repeated, reset on leaving, GPS jump out and back) and the existing end-of-route cases in `tests/walk-hud.test.tsx` must still pass with the simulated walker.

Not changed, listed as follow-ups: show metres below 1 km in the HUD ("40 m" instead of "0.0 km"); re-arm the card after "Keep walking" once the walker has left the zone again; an "arrived, still not at the end" tier (for example 40 m and stationary for 45 s) if the field shows the card never appears when the route ends somewhere the walker cannot stand. The HUD "End walk" button always works in the meantime.

---

## Bug 2: location stuck, map did not follow, around "בוויז"

### What "בוויז" is (assumption, please confirm with Ariel)

There is **no quiz, trivia or "חידון" feature anywhere in the code** (searched `src`, `tests`, `docs` for quiz, trivia, חידון, קוויז). The word reads as "in Waze" (ב + וויז). The reading used here: he left the page (to Waze or another app) and came back, or had the screen off. That is the one thing that stops a web page's GPS and map. If he meant something inside Traike (a companion question card, a callout, the chat), tell us which, because none of those touch the geolocation watch or the map follower (traced below).

### Causes

1. **No recovery of the GPS watch after the page was hidden (Likely, the main one).** `WalkTracker.start()` (`walk-tracker.ts:70-77`) calls `locate({purpose: "walk"})` once. `locate()` (`locate.ts`) opens one `watchPosition` (`:261`) and never looks at the page again: its only `visibilitychange` listener (`:186-197`, `watchForPermission`) exists for the **permission-denied** state. A mobile browser throttles or suspends geolocation for a hidden page, and on some browsers (iOS WebKit in particular) the watch does not resume on return. Then no fix reaches `onPositionUpdate`, `setCurrentPosition` is never called (`WalkPlannerApp.tsx:~2760`), the dot and the follower (which only moves on a position change) stay where they were. The 5 s ticker (`useWalkTicker.ts`) and `useWakeLock` do re-arm on return, but only the ticker re-reads the **stale** fix and the wake lock; nothing re-arms the GPS. `docs/NEXT_PHASE_PLAN.md:496` lists "survives a 2-min background/foreground cycle" as an unchecked device item: it was never verified.
2. **A silent watch is never noticed (Confirmed in code).** There is no watchdog. `onGpsError` (`WalkPlannerApp.tsx:~2970`) only shows "GPS signal is weak" on a timeout error, and a watch that simply stops reports nothing. Fixes older than 15 s are dropped (`locate.ts:62, 158`), which is right for stale cache but leaves a dead watch dead.
3. **The map follower never resumes by itself (Confirmed).** `PositionFollower` in `GoogleMapView.tsx:87-98` and `MapView.tsx:~118-146` sets `paused = true` on `dragstart` and clears it only when the walker taps the re-centre control. One accidental drag (a touch while taking the phone out of a pocket, scrolling the sheet, pinching) and the map stops following for the rest of the walk while the dot keeps moving off screen. This also fits "the map froze", and is independent of Waze.
4. Checked and ruled out as causes: the companion question card, callouts and the options sheet (they only render over the map, they do not call `setCurrentPosition`, stop the tracker or remount the map); `useWalkTicker` (it skips ticks while hidden by design).

### Plan

1. `locate()` for `purpose: "walk"`: on `visibilitychange` to visible, re-arm the watch (`clearWatch` then `watchPosition` again) and ask for one fresh `getCurrentPosition`; plus a watchdog that re-arms the watch when no GPS fix has been handled for 25 s while the page is visible, at most once per 25 s. Starts are untouched. Tests extend `tests/locate.test.ts` (fake geolocation + fake timers).
2. Map follower (Google and Leaflet): resume following when the page becomes visible again, and 15 s after the last drag ended. One small shared helper hook so the two views do not drift. Test: new `tests/position-follower.test.tsx` only if the follower can be mounted without the real map; otherwise the hook is unit-tested on its own.
3. Not done: a "GPS paused, tap to resume" banner and a background-location native wrapper (roadmap; a web page cannot track while hidden at all, so walking with Waze in the foreground will always lose the track for that time).

---

## Bug 1: 2 km/h plan, 4.5 km/h walked, the app never asked

### Cause (Confirmed mechanism, Likely that it is the whole story)

- The plan pace is `walkInputRef.current.walkingPaceMinPerKm` (30 min/km for 2 km/h). `PaceAdvisor`, `ReplanTrigger` and the HUD fallback all judge against it. 4.5 km/h is ratio 0.44, so `PaceAdvisor` (`pace-advisor.ts`, fast below 0.77) does say "fast".
- But a "fast" verdict only becomes a card through `paceCandidate` (`walk/companion/producers/pace.ts`), and that needs a measured pace from `WalkTracker.computePace`, which is clamped to 5-30 min/km (`walk-tracker.ts:~177`), a spare-minutes or add-place condition, no other card up, the 6 min cooldown and a 60 s lifetime. Its answers are only "add a stop / lengthen / finish early". **No answer re-baselines the pace.** The card text never says "your plan assumes 2 km/h".
- `rebaselinePace()` (`WalkPlannerApp.tsx:~2215`) already exists, but only the typed chat command "N km/h" (`set-pace`, `onAction` in `useWalkChat`) reaches it. The automatic "re-baseline, with Undo" in `docs/ASSISTANT-SPEED-PACE-PLAN.md` section 4.4 was planned and never built.
- Why the plan was 2 km/h in the first place is the assistant's sticky `state.params.paceMinPerKm` / learned pace (`ASSISTANT-SPEED-PACE-PLAN.md` RC-A6, RC-A7): unchanged here.

### Plan (small and clean, so it is built)

1. New pure `PaceMismatchWatcher` (`src/lib/walk/pace-mismatch.ts`): fed every tick with the HUD speed (`SpeedEstimator`, already smoothed, with a pause state) and the plan pace. When the measured speed is plausible (1.5-10 km/h), the walker is moving, and measured vs planned differ by 1.5x or more in either direction for 3 minutes of fix time in a row, it returns one offer `{ measuredKmh, plannedKmh }`. Asked once per direction per walk: after "Keep" it stays quiet; after "Update" the watcher takes the new plan pace.
2. `WalkPlannerApp`: one state for the offer, one `walkAlert` branch ahead of the pace cards: "You're walking about 4.5 km/h. The plan assumes 2 km/h." with "Plan at 4.5 km/h" (calls the existing `rebaselinePace`, which already shows "Planning at 4.5 km/h from here") and "Keep 2 km/h". English and Hebrew in `walk-copy.ts`.
3. Tests: `tests/pace-mismatch.test.ts` (unit) and one `walk-hud` case with the simulator (plan 30 min/km, simulator at 13 min/km, offer shows, accepting changes the planned pace in the HUD).

Left as a feature (not built): re-baseline automatically with an Undo (design in section 4.4 of the speed plan); the single "spare minutes" number so that after re-baselining a faster walker still gets the "you have time to extend" offer (today that offer rides on the ratio against the plan pace, so re-baselining mutes it; section 4.3 of the speed plan); allowing 2 km/h and slower in `WalkTracker.computePace` (the 30 min/km clamp hides a walker slower than the plan they asked for); km/h next to min/km in `AssistantSettings.tsx` (labels still min/km only); the assistant being told the measured pace.

---

## Device tests (cannot be shown by unit tests)

1. Walk with the screen on, switch to Waze (or lock the phone) for 2-3 minutes while walking, come back: the dot jumps to the real position within about 25 s without a reload, and the map follows again.
2. Drag the map once, keep walking: the map pulls back to the dot about 15 s later; the re-centre control still works.
3. Plan at 2 km/h, walk 4.5 km/h for 3+ minutes: the "You're walking about 4.5 km/h" card appears once; "Plan at 4.5 km/h" shows the notice and the card does not return; "Keep" never asks again for that direction.
4. Walk a route to the very end: no "reached the end" card until within about 15 m of the end and standing or arriving there for a few seconds; it does not appear 40 m early; "Finish walk" ends the walk.

## Status

Filled in as each fix lands (commit hashes in the final report).
