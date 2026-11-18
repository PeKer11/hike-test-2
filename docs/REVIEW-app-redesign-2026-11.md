# Review: feat/app-redesign (f498e9a..2673a0c)

Date: 2026-11-16. Scope: 9 commits, 121 files, +5270 / -661. Read-only review; this file is the only write.

## Verdict

**Request changes.** The structure is sound and most of it is careful work: one geolocation owner, the IP city never used as a start or walk position, variants re-routed server-side without touching the parent, the migration falls back cleanly when it hasn't been applied. But three MUST items break the walk itself or write bad data. All three are small, local fixes. Fix M1 to M3, then S1 to S3 before the first real-phone test, and S6 before the SQL migration is pasted.

What was checked:
- Read the diffs of the shell, planner, tracker, locate, walk-again, variants, saved-walks, assistant tools, map components, and the migration.
- `tsc --noEmit`: clean.
- eslint on the changed files: 0 errors, 67 warnings.
- `vitest run`: 3010 passed, 1 failed. The failure is old (see N1).

What was not checked:
- Playwright e2e, which was not run in this review.
- A real phone with real GPS.
- The new database columns against a real database (the migration is not applied).

---

## MUST

### M1. "Next stop" skips stop 1

`showPlan` sets `isStart: i === 0` on `orderedAttractions[0]` (`WalkPlannerApp.tsx` ~1058-1065). That is a real stop: the marker shows label "1" (`GoogleMarkers.tsx:34`), and the TSP output does not contain the origin (`tsp-planner.ts` 565-587: segments start *from* the origin). Two places filter `!w.isStart`:
- the sheet's `upcomingStops` / `nextStopInfo` / HALF list (`WalkPlannerApp.tsx:3290`);
- the map's `nextStopId`, the only pin that keeps its name while walking (`WalkPlannerApp.tsx:4318`).

Result: while the walker heads to stop 1, the sheet and the map point at stop 2. A one-stop walk shows no next stop at all. The e2e stub plan has exactly one stop, so no test can catch this. In `walk_to_start` mode the injected start stop is the one that gets skipped.

Fix: filter by visited only, and add a unit test with a plan of two or more stops.

### M2. A reload during a live walk strands the walker (phone)

While walking, the URL is `/app?view=walk` (`AppShell.tsx:44`). After a reload nothing is live, but `parseView` keeps `"walk"`. The planner is shown with:
- no TabBar (`hub` is false),
- no Back button (it renders only for `view === "plan"`, `AppShell.tsx:70`),
- no Rail (it is `lg:` only).

The "Continue walk" card exists only on Home, which is the only caller of `loadActiveWalk`. So the feature built so "a reload does not end it" can't be reached on the reload path. The only way out is browser Back, and that is missing in home-screen/standalone mode. Me's "Refresh the app" leads straight to this state. Any back-navigation or deep link to `?view=walk` without a live walk does the same.

Fix: in AppShell, when `view === "walk"` and no walk is live, `replaceState` to Home, or open the resume prompt there. Only do this after the planner's first bridge publish, so it doesn't race the start transition. Add an e2e: reload mid-walk, then "Continue walk" is visible and works.

### M3. Walk-again backfill stores the wrong route on the original walk

`runWalkAgain` passes `backfillGeometry: walk` whenever `walk.id && !walk.geometry` (`WalkPlannerApp.tsx:1167`), for every mode. `handleBuildWalk` then writes *this build's* geometry, end and loop flag onto the saved walk (`WalkPlannerApp.tsx:1407-1412`). For these modes the build is not the original walk:
- `join_nearest`: a subset of the stops, from here;
- `walk_to_start`: an extra start stop, from here;
- `reroute_from_here`: reordered, from here.

Every walk saved before this branch has no geometry. So the first walk-again of any of them from anywhere but the start permanently replaces its route with the "from here" route. After that, `routeOf`, `isLoopWalk`, `decideWalkAgain`, `RouteSketch` and all variants read the corrupted route.

Right now this does nothing: before the migration the update just fails. It must be fixed before the SQL is applied.

Fix: backfill only for `start_now` and `original_start_no_location`, the builds that follow the saved stops in order from the saved start.

---

## SHOULD

### S1. A resumed walk loses its identity
`ActiveWalkSnapshot` has no saved-walk id, no route rules, and no walk start time. The `startedAt` it does save is never read on resume, and the next save overwrites it, because `handleStartWalk` resets `firstFixAtRef`. Effects after a resume:
- Elapsed time and "over plan" restart at 0.
- End walk records no run and doesn't mark the walk completed (`savedWalkIdRef` is null).
- Mid-walk rebuilds ignore the walk's route rules (`routeRulesRef` is not restored).

Fix: persist and restore the walk id, the rules and `startedAt`, and seed the elapsed clock from `startedAt`.

### S2. The walk tracker accepts stale fixes
`locate({ purpose: "walk" })` runs `getCurrentPosition` with `maximumAge: 120 s` next to the watch, and passes every fix through (`locate.ts` `quickFix` / `handleFix`). A cached fix of 50 m or better counts as engine-grade, so it can:
- become `firstFixAtRef` (elapsed starts up to 2 min early);
- enter the pace window, deviation and visit detection;
- arrive *after* the first watch fix, so the dot jumps back.

`SpeedEstimator` drops out-of-order samples. The tracker and the planner do not.

Fix: for `"walk"`, drop fixes that are not newer than the last one emitted, or older than about 10 s. Or treat the quick fix as dot-only.

### S3. Location denied mid-walk is silent
`WalkHud` shows its chip for searching, coarse, timeout and unavailable. `"denied"` gives no chip (`WalkHud.tsx:46-47`). The "Live tracking issue" text lives in the Details panel, which is hidden while walking. A walker who taps "Don't allow", or revokes the permission, sees a frozen dot and nothing else. Add a denied state to the chip, linking to the `LocationDeniedCard` how-to.

### S4. Walks / Social during a live walk (desktop Rail)
With `walkMode` on, hub views show the walk's Details slots under the heading "Walks" or "Friends". The map and the HUD are hidden, and MyWalks / Friends render only when not walking. Either send hub clicks back to the walk while one is live, or show the real hub content.

### S5. Walk again: feedback and "reverse"
- A tap waits on `locateOnce` for up to 6 s with nothing on screen. A double tap starts two flows.
- `reverse` goes through `requestVariant`. A failure is silent, and every tap saves another "· reversed" walk.
- For a friend's shared walk (`id: ""`), `reverse` is still offered. It then misses the `walk.id && isSignedIn` branch and builds the **original direction** from here under the label "Walk it the other way". Remove `reverse` from `supported` when `!walk.id || !isSignedIn`.
- The comment "(Reverse arrives with variants.)" above `WALK_AGAIN_SUPPORTED` is stale.

### S6. The column probe sticks after any error
`saved-walks.ts` flips `newColumnsExist` to `false` on the first error of *any* kind (lines 120, 136, 169): a network blip, RLS, or a check constraint on insert. It stays false for the life of the tab or server process, and `insertWalk` retries without the new columns on any failure. After the migration is applied, geometry could then be silently skipped until the next deploy. Flip the flag only on a missing-column error (Postgres `42703`, PostgREST `PGRST204`).

### S7. `make_variant` hands the model an unsanitized title
`variantMaker` returns `title: draft.title` raw (`api/assistant/route.ts:104`). That is the parent title plus a suffix, and titles can contain third-party place names. `recall_walks` passes titles through `cleanUntrustedText`, so do the same here. Also, `longer` / `add_stop` / `swap_type` look the walk up with `loadWalks` (own walks only), while the other kinds use `getWalkById` (own walks plus friends' shared ones). Pick one.

### S8. A walk-again run overwrites the original walk's totals
At End walk, `updateWalk(existingWalkId, { totalMin: elapsed, distanceM: walked })` runs (`WalkPlannerApp.tsx:1923`). That code is old, but now "join nearest" and "walk to start" runs are recorded against the parent walk too. The walk's stored time and distance become those of a partial or longer run, and `decideWalkAgain`'s over-budget check and Home's card both read them. Keep the planned totals on the walk (`walk_runs` already holds each run), or update them only on `start_now` runs.

### S9. Map credits are collapsed to "© OSM"
On the Google map, `MapCredits` shows "© OSM" and hides the rest behind a tap. `docs/data-source-terms.md` says the ORS credit must read "© openrouteservice by HeiGIT | Data from OpenStreetMap", and the route line is that data. At least write "OpenStreetMap" in full, and check before launch whether a tap-to-expand credit meets ORS and OSMF terms.

### S10. Device data survives logout
`LogoutButton` only calls `signOut`. These keys stay on the device:
- `traike.activeWalk.v1`: plan, route, last fix;
- `traike.lastFix.v1`: a precise position.

The next person on a shared device sees "Continue walk" with the previous user's route and position. Clear both keys on logout. There is also no privacy page in `src/app` that mentions the IP-city lookup or the on-device location; that is a launch-gate item.

---

## NIT

- **N1.** `tests/assistant-chat-undo.test.tsx` fails every run, and **this branch didn't cause it**. Since `e3c4ece` (already in the base), Stop sends `/api/assistant/cancel` without a signal, and the test's fetch mock keeps only the last call's signal. Filter the mock by URL so the suite goes green.
- **N2.** `GoogleCurrentPosition` creates and destroys a `google.maps.Circle` on every position update. Create it once, then call `setCenter` / `setRadius`.
- **N3.** The `WalkSheet` drag uses pointerdown/up on a 24 px handle without `setPointerCapture`. That works with a finger (touch captures implicitly) but not with a mouse or trackpad drag. A real-finger drag is still listed as unverified in `PROGRESS-redesign-2026-11.md`.
- **N4.** The "Walks" / "Places" segment labels aren't translated to Hebrew. The walk-hud e2e still talks about an "account pill", which this branch removed.
- **N5.** The migration adds `walk_runs.last_stop_index` and `join_mode`, but nothing writes them, and `decideWalkAgain` never gets `lastRun`, so "Continue where I stopped" can never appear. Wire it up or drop it from the SQL.
- **N6.** Home's "Last walk" is the newest *created* row (`listMyWalks(..., 1)`), so it can be a draft that was never walked.
- **N7.** The 404 from `/api/geo/ip` has no `Cache-Control: no-store`; only the success response does. Harmless on Vercel.
- **N8.** The `saved_walks` UPDATE policy lets the owner set `parent_walk_id` to any uuid, while the INSERT policy checks that the parent can be read. No data is exposed, but the two policies don't match.
- **N9.** `same_style_here` doesn't pass the position `locateOnce` just found to the chat. The chat's origin is `currentPosition ?? mapClickedCoords`, so it may look up the location again.
- **N10.** Plan's Back button pushes a new Home entry instead of `history.back()`, so the history keeps growing.
- **N11.** The HALF list's minutes are straight-line distance times pace, so they run low. Show them as "~N min".
- **N12.** The eslint warnings are mostly `react-hooks/set-state-in-effect`, the same pattern that already exists elsewhere in the code.

## Confirmed good

- `navigator.geolocation` is used only in `src/lib/geo/locate.ts` (checked by grep). All four callers and `locateOnce` ignore `source: "ip"` for a start or a walk.
- The tracker's split is clean: up to 150 m for the dot, 50 m or better for pace, deviation and visits, and a coarse first fix (up to 2 km) with a halo.
- The variant API: signed-in only, input checked, rate-limited, the parent read through RLS and never written, tests for refusals and a 404.
- Every new column query falls back to the old column list, so the app keeps working before the migration is applied.
- Typecheck is clean.
