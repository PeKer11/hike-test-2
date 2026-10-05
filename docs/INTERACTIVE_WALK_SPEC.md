# Interactive Walk — build spec (Opus design pass, 2026-10-01)

Loop: Opus design → Sonnet build → fresh Opus review (max 3 cycles, then Opus fixes directly + final review). Cycle history is appended at the bottom of this file. Line numbers refer to HEAD `a726910`.

Design mockups: `~/Downloads/Hiking Map App with Slow Pace Alert.png`, `~/Downloads/Hiking Map Off-Route Warning UI.png` (copies in the session scratchpad `ref/`). Bug screenshots: `ref/bug-1.png`, `ref/bug-2.png`.

## Decisions (defaults, Ariel may revisit)
1. NO Google Places/Routes: ToS forbids showing Google Places/Routes data on a non-Google (Leaflet/OSM) map; imagery+vision on Google imagery is also forbidden. Stay on OSM/Overpass + ORS. A `NearbyProvider` seam is added; only OSM is implemented.
2. "Detected from satellite" tier (F6): DEFERRED. Ship OSM-mapped forest/park/water now (SHOULD).
3. English copy now, all new walk-screen text in ONE copy file (`src/lib/walk/walk-copy.ts`) so Hebrew drops in.
4. Pace advice ON by default as cards only; automatic rebuild stays off.
5. Auto-fullscreen + Screen Wake Lock during a walk.

## 1. Diagnosed bugs (fix these)
- (a) Map too small: `WalkPlannerApp.tsx:1901` map section is `h-[45%] min-h-[180px]` below `@4xl`; `<aside>` (`:1323`) takes the rest; nothing changes when `walkPhase==="walking"`. `layout.tsx:26` viewport lacks `viewportFit:"cover"` (safe-area insets are 0) and `colorScheme:"light"` (Samsung forced dark).
- (b) `OffRouteNotification.tsx:17` is `absolute top-4 left-1/2 z-[500] animate-pulse`; `AccountIndicator.tsx:23` is `fixed right-3 top-3 z-[1000]` and covers it. `PaceConfirmationNotification` (top-16) and `DeviationConfirmationNotification` (top-36) stack in the same column.
- (c1) Through-houses line: `WalkPlannerApp.tsx:987` calls `remainingRoute(walkGeometryRef.current, idx, update.currentPosition)`; `deviation-detector.ts:118` returns `[currentPosition, ...route.slice(idx+1)]` → straight GPS-to-vertex segment. Same at walk start (`:895`).
- (c2) "Not shortest": `runDeviationTriggeredRebuild` (`:757`) → `buildDeviationRebuildRequest` (`planner-actions.ts:99`) → full `/api/walk-plan` re-runs TSP from current position and routes to the TSP-chosen first stop (`walk-plan/route.ts:612-625`), not back to the old route. `handleBuildWalk` calls `stopWalkTracking()` (`:542`) so GPS stops for up to 120s (`:144`); `showPlan` `focusOn(firstStop,14)` (`:493`) yanks the viewport; rebuild origin may be a fix with accuracy up to 100m (`walk-tracker.ts:46`) vs 50m off-route threshold (`deviation-detector.ts:5`).
- d1 `walk-tracker.ts:44,144-171`: pace over only 5 samples, jitter inflates distance, outside 5–30 min/km → null, `coords.speed` ignored.
- d2 `walk-tracker.ts:85` `maximumAge:15000` → stale fixes.
- d3 `poi-alerter.ts:38-46`+`walk-tracker.ts:112`: "ahead" uses bearing between consecutive fixes (noise; heading-monitor.ts:38-47 says so); simulator never sets bearing.
- d4 `WalkPlannerApp.tsx:932` alerter only checks plan stops, uses `Date.now()`, no left/right.
- d5 `WalkPlannerApp.tsx:1038,1054`: `new PaceChecker/DeviationMonitor(walkSettings…)` read render-time settings; `handleStartWalk` runs from async rebuild closure (`:675`). Use `walkSettingsRef.current`.
- d6 `replan-trigger.ts:129-140`: `hasFullyStopped` unaware of stops → standing at a planned stop counts as full-stop and inflates slow window.
- d7 `walk-settings.ts:111-112` slowPaceMode/fastPaceMode default "off".
- d8 `rate-limit.ts` is per-instance; ORS quota is per account: 2000 directions/day, 500 matrix/day. Don't use matrix for reroute.
- d9 `next.config.ts:40-42` CSP (Report-Only) allows only OSM tile hosts + self + Supabase; add any new host.
- d10 `MapView.tsx:119` Leaflet attribution bottom-right would be hidden by a bottom stats bar; OSM attribution is mandatory.

## 2. Cadence (all constants in `src/lib/walk/walk-cadence.ts`)
| Signal | Value |
|---|---|
| GPS watch | continuous, `maximumAge:5000`, `timeout:20000`; dot accepts accuracy ≤100m; engine (speed/deviation/POIs) only ≤50m |
| UI state updates | ≤1/s (keep `:946`) |
| Speed | `coords.speed` median of last 10s; else distance over 30s window; ignore fixes worse than 35m; reject jumps >3.5 m/s; display smoothing α=0.35; "Paused" if moved < max(8m, accuracy) in 20s |
| Pace advisory | evaluate every 5s ticker over a 5-min window (cheap local); slow when pace > 1.3× plan, clears < 1.15×; fast when < 0.77×, clears > 0.87×; ≥6 min between same-kind cards; silent within 100m of a stop |
| Pace auto-rebuild | unchanged (15-min window, 12-min cooldown) |
| Off-route | every fix (throttle 1/s); off when >50m AND >accuracy; back on when <30m; fixes with accuracy >50m don't change state |
| Way-back route | after 30s sustained (existing); 60s cooldown; full re-plan keeps 3-min cooldown |
| Nearby fetch | once per route geometry (corridor) + point fetch when >200m outside corridor; point fetches cached 10 min per ~200m cell (`round(lat/0.002),round(lng/0.002)`), max 1 per 2 min |
| Announcements | evaluated every fix locally; ≥90s global gap; max 2 callouts on screen; each place once per walk (Set survives re-plans); 10-min per-category cooldown |
| Imagery/vision | none |
Rationale: walking ≈1.35 m/s so "every 2–3 min" ≈ "every ~200 m"; distance trigger is better (quiet when stationary). Phone GPS 5–13m RMSE urban, >100m worst case. Notification fatigue → one card at a time.

## 3. Architecture
- Default: OSM/Overpass for everything nearby (~2 calls per walk via route-corridor query; left/right classification local), ORS for every drawn line.
- `src/app/api/nearby/route.ts`: input `{path: Coordinates[] (≤80 pts after simplification), radiusMeters ≤250}` or `{point, radiusMeters ≤300}`; `overpassRateLimiter` + in-memory cache keyed on rounded request; Overpass `around:r,lat1,lon1,…` line form; same tag set as `buildOverpassQuery` plus land-cover tags (`landuse=forest`, `natural=wood|water|beach`, `leisure=park|garden|nature_reserve`, `tourism=viewpoint`).
- `src/lib/places/nearby-provider.ts`: `type NearbyProvider = {fetchAlongPath(path,r); fetchAround(point,r)}`; `getNearbyProvider()` reads `process.env.NEARBY_PROVIDER` (default "osm"). Keys server-only (`server-only` import as `ors-client.ts:1`).
- `src/app/api/reroute/route.ts`: ORS directions only (NO matrix), ≤2 calls per request, `orsRateLimiter`.
- `overpass-client.ts`: extract endpoint-fallback loop (`:221-260`) into `runOverpassQuery(query)`; add `fetchPlacesAlongPath`, `fetchPlacesAround`.
- Types (`src/lib/types/nearby.ts`): `PlaceVerification="registered"|"mapped-unnamed"|"detected"`; `NearbyPlace extends Attraction {source:"osm"|"google"|"worldcover"; verification; kind:"poi"|"scenery"}`.

## 4. Features
### F1 — Fullscreen walk mode (MUST)
1. `PlannerFrame.tsx`: pass `onRequestExpand={setIsExpanded}`; `WalkPlannerApp` calls `onRequestExpand?.(true)` in `handleStartWalk`.
2. `WalkPlannerApp.tsx`: `walkMode = walkPhase==="walking"`, `isDetailsOpen` state. Map section (`:1901`): when walkMode `relative h-full flex-1`. `<aside>` (`:1323`) stays MOUNTED (form state survives): walkMode && !isDetailsOpen → `hidden @4xl:block`; walkMode && isDetailsOpen on narrow → bottom sheet (`absolute inset-x-0 bottom-0 z-[700] max-h-[70%] rounded-t-2xl overflow-y-auto shadow`) with close button. Remove top-of-frame `<OffRouteNotification>` (`:1283`); POI pill (`:1310`) replaced by F4. Render `<WalkHud/>` inside the map section.
3. New `src/components/walk/WalkHud.tsx`: top band reserved `top-[calc(env(safe-area-inset-top)+3.5rem)]` — NO cards there on narrow screens. Bottom stack top→bottom: the one `WalkAlertCard`; pill row `Details` + `End walk` (`handleEndWalk`); `WalkStatsBar` with `pb-[max(.75rem,env(safe-area-inset-bottom))]`. Logical classes (`start-3`/`end-3`), `dir="auto"` on place names. Palette: `bg-cream/95 backdrop-blur`, `text-forest`, CTA `bg-terra`, alert accent existing red, shadow `shadow-[0_4px_20px_rgba(30,61,47,0.12)]`.
4. `MapView.tsx`: `hudInset?: boolean` → class `walk-hud`; `globals.css` `.walk-hud .leaflet-bottom{margin-bottom:var(--hud-h,9rem)}` so attribution stays visible.
5. `layout.tsx` viewport: `viewportFit:"cover"`, `colorScheme:"light"`.
Acceptance: at 390×844, Start Walk → map fills frame, no form fields until Details; no walk UI overlaps `AccountIndicator` (e2e bounding-box); OSM attribution visible; desktop ≥@4xl keeps sidebar; expand/collapse doesn't stop GPS.

### F2 — Live speed + progress + pace cards (MUST)
- `src/lib/walk/speed-estimator.ts`: `class SpeedEstimator {record({coordinates,timestamp,accuracyMeters,speedMps?}); current(now): {kmh:number|null; state:"moving"|"paused"|"unknown"}}`.
- `src/lib/walk/walk-stats.ts`: `cumulativeDistances(geometry)`, `progressAlong(geometry,segIdx,closestPoint)→{walkedM,remainingM}`, `timeToFinishMin({remainingM,kmh,plannedPace,remainingVisitMin})` (use measured speed only if between 0.5× and 1.5× planned), `paceBarTone(kmh,plannedPace)→"good"|"warn"|"bad"`.
- `src/lib/walk/pace-advisor.ts`: `class PaceAdvisor {record(sample); evaluate(now, nearStop): "slow"|"fast"|null}` with hysteresis/cooldowns above. Timestamps from fix (same rule as `PaceChecker.evaluationTime`), never `Date.now()`.
- Wiring: `walk-tracker.ts` adds optional `speedMps: pos.coords.speed` on `PaceUpdate`, `maximumAge:5000`; simulator sets `speedMps = 1000/(pace*60)`. On accepted fixes (accuracy ≤50m) feed estimator + advisor. 5s ticker calls `paceAdvisor.evaluate(lastFix.timestamp, nearUnvisitedStop)` → `paceAdvisory`.
- Cards: slow 🐢 "You're going slower than planned · Show shorter route" → `runPaceTriggeredRebuild("sustained-slow-pace")`; secondary "Keep all stops" → `runExtendedTimeRebuild`. Fast: "You're at a great pace! · Extend the hike" → `runPaceTriggeredRebuild("sustained-fast-pace")` (already `fillRemainingTime:true`, `planner-actions.ts:83`). Cards only offer; nothing rebuilds until tapped. Existing `PaceConfirmationNotification` (`ask` mode) has priority.
- Fixes here: d5 (use `walkSettingsRef.current` at `:1038`,`:1054`); d6 (`ReplanTrigger.recordSample` gets optional `atStop?:boolean`; samples within `VISIT_RADIUS_METERS` of an unvisited stop dropped from both windows; existing tests must still pass + one new test).
- Stats bar (3 tiles like mockup): Walking pace `kmh.toFixed(1)` km/h / "Paused" / "—", bar = ratio to plan coloured good/warn/bad; Time to finish minutes, bar = elapsed÷(elapsed+remaining), red if projected total >1.05× `availableMinutes`; Distance to finish km, bar = walkedM÷(walkedM+remainingM).
Acceptance: in simulation speed tile within ±0.3 km/h of planned; after "Slow pace" drops ~1.6× and slow card appears within 5–6 simulated minutes (not 15); standing still → "Paused" within 20s; no pace card within 100m of a stop; ≤1 card on screen.

### F3 — Correct off-route reroute (MUST)
1. In `WalkPlannerApp.tsx:987` and `:895` pass `deviation.closestPointOnRoute` instead of GPS position to `remainingRoute(...)`. (`walk-engine.test.ts:35` must still pass.)
2. `deviation-detector.ts`: `nextOffRouteState(prev, deviationM, accuracyM): boolean` (off when >50 && >accuracy; on when <30; else prev; accuracy>50 fix doesn't change state). Feed to `markOffRoute` and `DeviationMonitor.record`.
3. `src/lib/walk/rejoin.ts`:
```ts
rejoinCandidates(pos, geometry, segIdx, nextStopAlongM|null): Array<{point; segmentIndex; alongM}>
// sample route every 20m from matched point up to min(500m, nextStopAlongM); score = haversine(pos,p)*1.3 − alongM; best 2; never past next unvisited stop, never behind segIdx
isPlausibleConnector(connectorM, crowM): boolean // connectorM <= 2*crowM + 100
spliceRoute(geometry, candidate, connector): Coordinates[] // [...connector, candidate.point, ...geometry.slice(candidate.segmentIndex+1)]
turnInstruction(headingDeg|null, pos, target): {kind:"straight"|"left"|"right"|"around"|"compass"; text}
// rel=normalize(bearing(pos,target)-heading) in (−180,180]; |rel|≤30 straight; 30<rel≤150 right; −150≤rel<−30 left; else around; null heading → compass text e.g. "Head north-east, 80 m"
```
4. `src/app/api/reroute/route.ts`: `POST {from, candidates: Coordinates[≤2]}`, validate like `api/directions/route.ts`. For each candidate: `getDirections({coordinates:[toOrsCoord(from),toOrsCoord(c)], profile:"foot-walking", instructions:false})` → `decodePolyline`; return first plausible as `{geometry, distanceMeters: routes[0].summary.distance, candidateIndex}`; 422 if none plausible.
5. `runLocalRejoin()` in WalkPlannerApp — NO `stopWalkTracking`, NO rebuild on success: build candidates → POST → `walkGeometryRef.current = spliceRoute(...)`, `lastSegmentIndexRef.current=null`, `setRemainingGeometry(...)`, `walkTracker.updateGeometry(newGeom)` (new 1-line method; simulator no-ops). On failure or deviation >400m: fall back to `runDeviationTriggeredRebuild()`. NEVER draw a straight line.
   - `deviationMode:auto` → `runLocalRejoin` (60s cooldown checked by caller).
   - `ask` → `WalkAlertCard` off-route variant "You're off the route · Turn left to get back on track" with buttons `Show way back` (local rejoin), `Re-plan from here` (existing full rebuild), `I know where I'm going` (dismiss). Replaces visuals of `DeviationConfirmationNotification`, keeps its timeout/silence behaviour.
   - Turn text appears as soon as off route (bearing to `closestPointOnRoute`); once a connector exists use the connector point ≥20m ahead. Heading: `HeadingMonitor.recentHeading(now)` = bearing of last ≥15m stretch within 20s; null → compass text.
6. Full-rebuild fixes: `keepViewport` flag so `showPlan` skips `focusOn` when `autoResume` (`:493`); rebuild origin must be a fix with accuracy ≤50m else `closestPointOnRoute`.
Acceptance: "Stray 300 m" (existing simulator detour) → after 30s a teal line following streets from walker to a point ahead on the old route, no segment crossing a building; never a straight GPS-to-vertex segment while off route; stops/order unchanged after local rejoin; a 75m-accuracy fix 60m off route doesn't flip to off-route.

### F4 — Ahead/left/right awareness (MUST; scenery SHOULD)
1. `/api/nearby` corridor fetch over remaining geometry (simplified ≤80 pts, 250m radius): on walk start, after `spliceRoute`, after any rebuild. Point fetch when deviation >200m. Client store `Map<id,NearbyPlace>` in a ref.
2. `src/lib/walk/poi-relation.ts`: `Relation="here"|"ahead"|"left"|"right"|"behind"`; `relatePlace(pos, headingDeg|null, routeDirDeg|null, place)→{relation,distanceM}`; heading = routeDirDeg (bearing of route over next 30m from closestPoint) when on route else headingDeg; d<25m → "here"; null heading → "here" if d<60 else "ahead"; |rel|≤30 ahead; 30<rel≤150 right; −150≤rel<−30 left; else behind.
3. `src/lib/walk/poi-announcer.ts`: `class PoiAnnouncer {check(pos, heading, routeDir, places, planStopIds, now): Announcement[]}`. Candidates relation≠behind and ≤150m. Rank: plan stops first ("Next stop on your right"), preferred categories, notable (`wikidata`/`wikipedia` tag), distance. Gates from cadence constants. Expiry: falls behind and >60m away, or after 30s. Replaces `PoiAlerter` in WalkPlannerApp (keep `poi-alerter.ts` + its tests, just stop using it).
4. `src/components/map/PoiCallouts.tsx` ("use client", inside `MapContainer`): Leaflet `Marker` with `divIcon` card — category icon, "Restaurant · on your right · 80 m", badge `OSM`; `dir="auto"` on names. Tap → sheet "Would you like to visit?" with detour cost `≈ round((2*distanceM*1.25)/speed_mpm + avgVisitMinutes)` min; `Add to walk` → `buildRecallRebuildRequest(state, place)` (`planner-actions.ts:317`) then `handleBuildWalk`; `Not now` marks announced.
5. Scenery (SHOULD): land-cover tags, `kind:"scenery"`; unnamed polygons "Wooded area (mapped)" `verification:"mapped-unnamed"`; max once per 10 min.
Acceptance: simulation on Tel Aviv fixture: place 40m east of north-bound route → "right", west → "left"; no place announced twice; two announcements never <90s apart; Overpass calls per simulated walk ≤3 (fetch-spy unit test of the loader).

### F5 — Cadence module (MUST)
`walk-cadence.ts` exports every number above. `src/hooks/useWalkTicker(enabled, 5000, onTick)`: single `setInterval` during walking; skip ticks when `document.hidden`; run one tick immediately on `visibilitychange→visible`. Ticker drives pace advisor, stats refresh, callout expiry, corridor staleness; per-fix things stay fix-driven. SHOULD: Screen Wake Lock (`navigator.wakeLock.request("screen")`) while walking, re-acquire on visible, release on end; feature-detect.
Acceptance: one interval added; hidden tab stops evaluation; return re-evaluates immediately; ending walk clears interval + releases wake lock (unmount test).

### F6 — Imagery discovery: DEFERRED (do not build). Never use Google imagery.

## 5. Tests to write (vitest, pure logic)
speed-estimator (Doppler median, positional fallback, stationary jitter → Paused, >3.5 m/s jump rejected); walk-stats; pace-advisor (hysteresis, cooldown, suppression near stop); rejoin (never behind, never past next stop, plausibility, splice starts on connector); turnInstruction incl. 0°/360° seam; poi-relation (4 quadrants + seam); poi-announcer (once per id, 90s gap, category cooldown, max 2 active); deviation-detector hysteresis + accuracy gate; replan-trigger `atStop` dwell not a full stop; reroute-api (mock `getDirections`; falls to candidate 2; 422 when both implausible); e2e stubbed: Start Walk at 390px fills frame with map, HUD doesn't overlap account pill, attribution visible.

## 6. Build order
1. Quick fixes: d5, F3.1, F3.2, `maximumAge`, viewport meta → `npm run test`.
2. `walk-cadence.ts` + `useWalkTicker`.
3. speed-estimator, walk-stats, pace-advisor, ReplanTrigger `atStop`, + tests.
4. F1 layout (PlannerFrame expand, section/aside classes, Details sheet, WalkHud + stats bar, attribution inset). e2e.
5. Alert card (off-route instruction-only + pace variants); delete top banners.
6. rejoin.ts + tests, /api/reroute + tests, runLocalRejoin, `WalkTracker.updateGeometry`, `keepViewport`.
7. Overpass refactor (`runOverpassQuery`), /api/nearby, provider seam, corridor loader.
8. poi-relation, poi-announcer, PoiCallouts, visit sheet.
9. (SHOULD) scenery tags, wake lock.
10. `npm run lint && npm run test && npm run build && npm run test:e2e`; update CLAUDE.md "Decisions Made" (corridor POIs, local rejoin vs full rebuild, Google ToS finding).

## 7. Reviewer checklist
- [ ] No polyline segment starts at raw GPS fix while off route (grep `remainingRoute(` call sites).
- [ ] `runLocalRejoin` success path never calls `stopWalkTracking`/`handleBuildWalk`; failure falls back to full rebuild, never a straight line.
- [ ] `/api/reroute`, `/api/nearby`: rate limiter applied, input validated (finite numbers, array caps, radius clamps), `server-only`, `[lng,lat]` only via `toOrsCoord`.
- [ ] No Overpass/Google call per GPS fix (fetch-count assertion).
- [ ] Every new time window uses fix timestamps, not `Date.now()` (simulator-clock bug hit twice before).
- [ ] `handleStartWalk` reads `walkSettingsRef.current`; ticker, wake lock, callouts cleaned up on end and unmount.
- [ ] 390px layout: no overlap with `AccountIndicator`, attribution visible, safe-area padding, ≤1 alert card and ≤2 callouts.
- [ ] Leaflet components `"use client"` and reached only via `DynamicMap` (`ssr:false`).
- [ ] CSP updated if a new host was added.
- [ ] Existing tests untouched except the deliberate ReplanTrigger addition; full vitest + e2e pass.
- [ ] Brand palette only; logical (RTL-safe) classes; `dir="auto"` on place names.

## Cycle log
(append below: cycle n — build summary, review verdict, must-fix list)

### Cycle 1 — build (Sonnet, resumed after a stalled first agent)
**Reviewed the stalled agent's work** (`pace-advisor`, `poi-relation`, `rejoin`, `speed-estimator`, `walk-cadence`, `walk-copy`, `walk-stats`, `api/reroute`, edits to `deviation-detector`, `heading-monitor`, `replan-trigger`, `simulated-walk-tracker`, `walk-tracker`): matched the spec; no logic changes needed. None had tests; all do now.

**Files created:** `src/lib/hooks/useWalkTicker.ts` (`useWalkTicker` + `useWakeLock`); `src/components/walk/{WalkHud,WalkAlertCard,WalkStatsBar}.tsx`; `src/components/map/PoiCallouts.tsx`; `src/lib/walk/{poi-announcer,nearby-loader}.ts`; `src/lib/places/{nearby-provider,path}.ts`; `src/lib/types/nearby.ts`; `src/app/api/nearby/route.ts`; `e2e/walk-hud.spec.ts`.
**Files changed:** `WalkPlannerApp.tsx` (targeted edits only), `PlannerFrame.tsx` (`onRequestExpand`), `MapView.tsx` (`hudInset`, callouts), `globals.css` (`.walk-hud` attribution lift), `layout.tsx` (viewportFit/colorScheme), `overpass-client.ts` (`runOverpassQuery` extracted; `fetchPlacesAlongPath/Around`, scenery tags), `pace-checker.ts` (`atStop` passthrough), `walk-stats.ts` (+`isNearAnyStop`, `nextStopAlongM`, `routeDirectionDeg`, `detourMinutes`), `walk-copy.ts` (`askTitle`, label), `types/index.ts`, `hooks/index.ts`, `CLAUDE.md` (Decisions Made).
**Tests added (vitest 1353 -> 1438, +85):** speed-estimator, walk-stats, pace-advisor, rejoin (incl. turn seam), poi-relation, deviation-hysteresis, replan-trigger `atStop` (+2 in the existing file, additive), reroute-api, nearby-api, nearby-loader (fetch-spy: 1 corridor call per geometry, 0 per fix), overpass-nearby, poi-announcer, use-walk-ticker (interval, hidden tab, unmount, wake lock), walk-hud (WalkPlannerApp + SimulatedWalkTracker: HUD/stats, speed within 0.3 km/h of plan, Details sheet, onRequestExpand, slow card ~3 simulated min after "Slow pace" and only an offer, auto local rejoin = no re-plan + `/api/reroute`, 422 -> full re-plan fallback, ask-mode "Show way back"). e2e: `e2e/walk-hud.spec.ts` (390x844).
**Verified (run):** `npx tsc --noEmit` clean; `npm run test` 78 files / 1438 passed (all pre-existing tests untouched and green); `npm run build` ok; `npm run test:e2e` 11/11 incl. the new spec (map >=90% of viewport, form hidden, HUD in lower half and clear of the account-pill corner, OSM attribution visible above the HUD, End walk restores the form) plus a screenshot eyeballed at 390x844; `npm run lint`: 0 new problems (1 error + 3 warnings are pre-existing: `useWalkSettings.ts` set-state-in-effect, `gpx-exporter.ts`, two test files).
**NOT verified:** real-device GPS/Doppler behaviour, real Overpass/ORS responses for `/api/nearby` and `/api/reroute` (both mocked), Wake Lock on a real phone, safe-area insets on a notched device, "Paused within 20 s" end to end (covered at unit level only: the simulator cannot stand still), callout cards rendered on a real Leaflet map (the unit tests mock `DynamicMap`; `PoiCallouts` is typechecked/built only), the Samsung forced-dark fix.

**Deviations (and why):**
1. Ask-mode off-route card keeps the old wording `You've gone off the planned route` and button label `Redraw from here` (not "Re-plan from here"): `walk-planner-silence.test.tsx` asserts both and the checklist says existing tests stay untouched. `Show way back` is the new primary action.
2. Pace-card TTL (60 s) is measured on the wall clock, not fix time: it times how long a card has been on screen, and the simulator's 10x fix clock would drop every card after 6 s. All data windows (advisor, estimator, announcer, rejoin cooldown, nearby loader) use fix timestamps.
3. `atStop` / advisor-quiet use "within 100 m of any plan stop" (not only unvisited): `VisitTracker` marks a stop visited on the first fix inside 100 m, so "unvisited" would stop protecting the dwell one fix later.
4. Fixes with accuracy >50 m move the dot only; `latestPaceUpdateRef` (rebuild origin, recorder, stats) is only set from <=50 m fixes, with the matched route point as fallback origin.
5. Turn text while off route always aims at the nearest point of the current route (which, after a splice, includes the connector); the "connector point >=20 m ahead" refinement was not built.
6. `ANNOUNCE_MAX_ACTIVE=2` is effectively unreachable with a 90 s global gap and 30 s expiry (spec constants kept as written; flagging for the reviewer).
7. Scenery ships (cheap): wood/water/beach/forest/nature_reserve and unnamed parks, `kind:"scenery"`, `mapped-unnamed`; big polygons use `out center`, so a very large forest whose centre is >~300 m from the path is filtered out server-side.
8. `OffRouteNotification`, `PaceConfirmationNotification`, `DeviationConfirmationNotification` are no longer rendered by the app but the files and their tests remain (only their constants are imported). `PoiAlerter` + tests likewise kept, unused.
9. `docs/INTERACTIVE_WALK_ADDENDUM.md` (Discovery Collection etc.) appeared in the repo during this cycle; it was NOT built (out of scope for this cycle's brief).

**Open concerns:** `useWalkTicker`'s `onTick` runs `setState` on each tick (cheap, but it re-renders the 1900-line component every 5 s plus once per second from fixes); per-fix `announcer.check` runs inside the 1 Hz throttle rather than on every fix; `/api/nearby` cache and rate limiter are per-instance like the rest.

### Cycle 2 — build (Sonnet)
**Must-fix**
1. `WalkHud.tsx`: ref on the outer wrapper; `--hud-h` is now set on `outerRef.current.parentElement` (the map section carrying `.walk-hud`) and removed from it on cleanup. e2e `walk-hud.spec.ts` gained a second test: stray via Details sheet (`/api/directions` stubbed 500 -> synthetic nudge), waits for the `role=alert` card, asserts attribution bottom <= HUD top; screenshot eyeballed (attribution clear above the card).
2. `pace-advisor.ts`: `record(sample, atStop = false)`; `atStop` empties samples and clears `state`. Call site passes `isNearAnyStop(..., ADVISOR_STOP_QUIET_RADIUS_M)`. Test: 5 min plan pace, 4 min stationary at stop, 90 s plan pace -> `evaluate` null.
3. `replan-trigger.ts`: private `resumeAfterDwell` Set of first-sample-after-dwell timestamps (pruned, cleared on reset); new `hopDistanceMeters` skips the bridging hop in both `isSustainedSlow`/`isSustainedFast`; dwell time still subtracted. Tests (additive): 15 min/km past two 3-min stop stretches -> null; 21 min/km -> `sustained-slow-pace`.

**Worth-fixing (all done)**: mid-walk rebuild keeps `walkMode` true via `rebuildingMidWalk` state (set when a snapshot/autoResume rebuild starts, cleared in the build's `finally` for the current request and in `handleEndWalk`); `PoiAnnouncer.expire(now)` called from `handleWalkTick` (fix-clock now); `lastLocalRejoinAtRef` reset in `handleEndWalk` and the `!autoResume` branch; `isUnmountedRef` guard in `handleStartWalk` + tracker ref nulled on unmount; `rejoin.ts` candidates >= 60 m apart along route (+ test); `/api/nearby` and `/api/reroute` return 400 for null/non-object body (+ tests); `walk-cadence.ts` TTL comment fixed. Skipped: distance-to-finish bar offset, mocked-DynamicMap capture (optional).

**Verified (run)**: `tsc --noEmit` clean; `npm run test` 86 files / 1556 passed; lint unchanged (1 error + 3 warnings pre-existing); `npm run build` ok; `npm run test:e2e` 12/12 incl. new attribution-with-card test. **Not verified**: the new `expire` path and the `rebuildingMidWalk` layout hold have no dedicated test (existing walk-hud tests still pass); real-device behaviour.

### Cycle 3 — build (Sonnet)
**Must-fix:** `handleEndWalk` (`WalkPlannerApp.tsx`) now does `buildWalkRequestIdRef.current += 1` and clears `isWalkPlanLoading`/`isWalkPlanSlow` before teardown, so an in-flight mid-walk rebuild is superseded: both the success path (`showPlan` + `handleStartWalk`) and the catch/failure path (`revertToSnapshot`) already bail on a stale request id. Verified `handleClearAll` calls `handleEndWalk`, so it is covered. No AbortController ref added (id check suffices).
**Worth-fixing:** (1) `PaceAdvisor.record(atStop)` no longer wipes the window: at-stop fixes are dropped, the first fix after is flagged `afterStop`, and `paceRatio` skips that hop's distance and its dwell time (coverage is measured on active walking time); `lastCardAt` semantics unchanged. (2) e2e attribution-with-card check now reads boxes inside `expect.poll`. (3) `rebuildingMidWalk` covered (HUD up while rebuild pending, gone after End walk). (4) `WalkHud.tsx` comment reworded.
**Tests added:** `tests/walk-hud.test.tsx` +2 (held `/api/walk-plan` then End walk, resolve and reject variants; assert no `walk-hud`, form back; both fail without the fix); `tests/pace-advisor.test.ts` +1 (slow walker, stops every 300 m, ratio 1.5 -> "slow"); the cycle-2 at-stop test still passes.
**Verified (run):** tsc clean; targeted vitest 18/18; full `npm run test` 86 files / 1559 passed; `npm run lint` 1 error + 3 warnings (baseline, nothing new); `npm run build` ok; `npm run test:e2e` 12/12. **Not verified:** real-device behaviour.
