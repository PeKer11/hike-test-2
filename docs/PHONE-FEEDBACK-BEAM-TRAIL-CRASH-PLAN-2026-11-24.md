# Phone feedback 2026-11-24: direction beam, walked-trail colour, blank Walks tab

Branch `feat/design-r13-port`, HEAD `420a1d5`. Read-only diagnosis. No source or test was changed.
Owner's test: phone, Hebrew UI, live walk, Google map.

| # | Complaint | Verdict | Root cause in one line |
|---|---|---|---|
| 1 | The beam is too big and lags behind turns | **Confirmed in code** | 62 px x 76° wedge (4x the dot). While walking it follows the GPS course, which is throttled to 1 Hz and smoothed over 3 to 5 fixes. Compass ticks re-render the 5,368-line planner and restart a 400 ms CSS transition. |
| 2 | The walked trail is grey, it used to be gold | **Likely, not a code regression** | Gold exists only on Satellite (`route-colors.ts:41-44`). On the Google roadmap the trail is the greige `#b9ad9c` / `#6e655a` (by design since 8085e40). The map-type choice lives in per-origin localStorage and falls back to roadmap. |
| 3 | "Crash": the מסלולים tab is a blank cream screen | **Confirmed. It is not an exception, it is layout gating** | During any live walk, `view=walks` hides the side panel on a phone (`walkMode && !isDetailsOpen`), hides the map column (`hubTab`), and the walks list itself is gated on `!walkMode`. Nothing is left but the cream frame and the tab bar. The mid-walk route change is incidental: it is simply how he was in a live walk. |

The "floating black circle" is not app UI. Nothing in `src/` draws a fixed black circle outside the hidden panel and map. It is most likely the Vercel preview toolbar, or the Next dev indicator on a dev server.

---

## 1. Direction beam: too big, and late

### Evidence

- `src/components/map/WalkerMarker.tsx:17-22`: the dot is a 13 px core with a 2 px ring and a 1 px hairline, 19 px across.
- `WalkerMarker.tsx:32-35`: `BEAM_RADIUS_PX = 62`, `BEAM_PX = 160`, half-angle 38°. The wedge is 62 px long and 2·62·sin 38° ≈ **76 px wide**, about 4x the dot.
  - `:42` gradient: 0.9 opacity out to 25 % of the radius, 0.55 at 60 %, and blur 2.4 px. Most of the wedge reads as solid.
  - dea49a6 made it bigger. It was 50 px at 80° before.
- `GoogleMarkers.tsx:112-127`: the accuracy halo is the same leather colour (fill 0.12, stroke 0.4). At zoom 17 to 18 with 15 to 30 m accuracy it is 40 to 100 px across, so halo and beam merge into one large orange blob.

### Why it lags (in the order the owner feels it)

| Source of delay | Where | Effect |
|---|---|---|
| **The GPS course wins whenever speed ≥ 1 m/s**, which is most of a walk | `heading-source.ts:22`, `WalkPlannerApp.tsx:3059` | While walking, the beam never shows the compass. It shows the OS course-over-ground, which already trails a real turn by 1 to 3 s. |
| GPS heading reaches React at most once per second | `WalkPlannerApp.tsx:3053` (1 s throttle), `:3058` | Up to 1 s of extra latency. |
| `HeadingSmoother` ALPHA 0.35 per fix | `heading-smoother.ts:15,80` | After a 90° turn the error is 58° after 1 fix, 38° after 2, 25° after 3 and 10° after 5, so about **3 to 5 s** to settle. Without `coords.heading` the chord fallback needs ≥ 8 m (`:7,70`), about 6 to 10 s. |
| Source flips at the 1 m/s line | `heading-source.ts:22`, `WalkPlannerApp.tsx:3059` | Walking pace is 1.0 to 1.4 m/s, so the source flips between GPS course and compass. The two disagree by 10° to 30°. `nearestEquivalent` stops a full spin but not this swing. |
| Compass: 150 ms throttle, 2.5° dead band, EASE 0.5 | `useCompassHeading.ts:51-55,80-88` | About 90 % of the 60 Hz events are dropped. A 90° turn takes about 4 accepted ticks (≈ 600 ms) to come within 6°, and the beam can then rest 2.5° off. |
| **Every compass tick is a React state change in the planner** | `useCompassHeading.ts:88` via `useWalkerHeading` at `WalkPlannerApp.tsx:666` | Up to 6.7 re-renders a second of a 5,368-line component. Each re-render also re-creates both walked-trail polylines (see 2.4). On a mid-range phone this costs frames, which reads as stutter and lag. |
| CSS `transition: transform 400ms ease-out` | `WalkerMarker.tsx:64,88` | It is restarted every 150 ms, so the beam is always mid-animation and trails the value by up to 400 ms. |
| Leaflet rebuilds the divIcon on each whole degree | `CurrentPositionMarker.tsx:18-33` | The element is replaced, so the transition never plays and the beam jumps. This affects the Leaflet map only. On Google the AdvancedMarker is not re-created (vis.gl keeps it; only `position` is set). |
| Android heading = `360 - alpha` | `useCompassHeading.ts:45` | That is only right when the phone lies flat. Held upright at 45° to 80° (how people walk with a map), a small `gamma` skews it by tens of degrees. |

Typical totals: about 3 to 6 s behind while walking (GPS path), about 0.8 to 1.2 s standing (compass path).

### Plan (ordered)

**B1. Size** (`WalkerMarker.tsx:32-42`)
- Keep the dot: 13 px core plus ring, 19 px across.
- `BEAM_RADIUS_PX = 40` (allowed range 36 to 44). Half-angle 30° (60° wide), so the chord is 40 px. `BEAM_PX = 96`, which is greater than 2 x radius plus the blur margin.
- Gradient stops: `0.15 → 0.75`, `0.55 → 0.35`, `1 → 0`. Blur `stdDeviation` 1.2.
- Halo (`GoogleMarkers.tsx:114-125`, `CurrentPositionMarker.tsx:36-42`):
  - fill 0.12 → 0.07, stroke 0.4 → 0.25;
  - skip the halo when `accuracyM ≤ 10`, so a good fix shows a clean dot and beam.
- Tests (update) in `tests/walker-marker.test.tsx`:
  - `:130-132` "reaches about 60 px" becomes "reaches 36-44 px from the dot (about 2x the dot)";
  - `:165-172` "about 76 degrees wide" becomes "about 60 degrees wide (55..65)".
- New test, same file: `it("the beam is at most 2.3x the dot's 19 px")`.

**B2. Rotate outside React** (removes the planner re-render per tick)
1. New `src/lib/walk/heading-store.ts`: `createHeadingStore()` returning `{ get(): number|null; set(v): void; subscribe(fn): () => void }`.
2. `useWalkerHeading` (`src/lib/hooks/useWalkerHeading.ts`) returns a **stable store**, not a number. The compass reader and the GPS heading write a *target* into a ref. One `requestAnimationFrame` loop eases the shown value toward the target and calls `store.set`. The loop runs only while active and `document.visibilityState === "visible"`, and idles once it is within 0.2° of the target. The planner never re-renders for heading.
   ```ts
   // per frame
   const a = 1 - Math.exp(-dtMs / TAU_MS);        // TAU_MS ≈ 90: 63 % in 90 ms, 95 % in 270 ms
   shown += a * shortestTurn(shown, target);      // unwrapped, short way through north
   if (Math.abs(shown - lastWritten) >= 0.3) store.set(lastWritten = shown);
   ```
3. `WalkerMarkerShape` takes `headingStore?: HeadingStore`. It keeps `headingDeg` for tests and static use. It renders the beam span **always**, with `display:none` while there is no heading. In `useLayoutEffect` it subscribes and writes `beamRef.current.style.transform = \`rotate(${deg}deg)\`` (and toggles `display`). Remove the `transition` (or use at most `60ms linear`); the rAF filter is the smoothing.
4. Plumb the store through:
   - `WalkPlannerApp.tsx:5252` (`currentHeadingDeg={walkMode ? walkerHeadingDeg : null}` becomes `headingStore={walkMode ? headingStore : undefined}`);
   - `MapViewProps` in `MapView.tsx` and `GoogleMapView.tsx:179,254`;
   - `GoogleCurrentPosition` (`GoogleMarkers.tsx:108-135`) and `CurrentPositionMarker`.
   - `walkerHeadingDeg` is used only for the map (checked: lines 660, 666, 5252), so nothing else needs the number.
5. Leaflet parity (`CurrentPositionMarker.tsx`): build the divIcon once (memo on nothing). Subscribe to the store and rotate `markerRef.current?.getElement()?.querySelector("[data-testid=walker-beam]")`.

**B3. Compass reader** (`useCompassHeading.ts` becomes a plain reader that writes a ref, with no React state)
- Read every event: no 150 ms throttle, and no dead band on input. The rAF filter handles jitter.
- iOS: `webkitCompassHeading` (already). Return null when `webkitCompassAccuracy < 0` (already).
- Android: on `deviceorientationabsolute`, use the W3C tilt-compensated compass heading from alpha, beta and gamma (the spec's `compassHeading` example) instead of `360 - alpha`.
- Keep the screen-angle correction (`:38-47`). Record `lastCompassAt` so the source policy knows whether the reading is fresh.

**B4. Source policy** (`heading-source.ts`). **Ariel to decide.** Recommended:
- **Use the compass whenever a calibrated reading arrived in the last 1.5 s.** Use the GPS course only when there is no compass (desktop, refused, uncalibrated, stale). The simulated-walk rule stays (path bearing).
- Why: the beam is only seen with the phone in the hand and the screen on, and then the compass is the truth. The "phone in a pocket lies" case is never on screen. Google Maps' blue-dot beam works the same way.
- Optional: GPS course at ≥ 2.5 m/s with hysteresis (2.5 on, 1.8 off) for cycling.

**B5. GPS path, when it is used**
- Push the heading to the store on every accepted fix, outside the 1 s throttle at `WalkPlannerApp.tsx:3053`.
- `HeadingSmoother` ALPHA 0.35 → 0.5.

**B6. Tests**
- `tests/use-compass-heading.test.ts` (rewrite around a fake rAF and fake timers):
  - `it("follows a 90° turn to within 10° in 300 ms of 60 Hz events")`;
  - `it("never sets React state per orientation event (render count ≤ 1 over 600 events)")`;
  - `it("uses the tilt-compensated heading on Android when the phone is held upright (beta 70, gamma 10)")`;
  - keep the iOS, uncalibrated, screen-angle and listener-cleanup cases (`:29-131`).
- `tests/heading-source.test.ts`: `it("prefers a fresh compass over the GPS course while walking")`, `it("falls back to the GPS course when the compass is stale (> 1.5 s)")`.
- New `tests/walker-beam-dom.test.tsx`: `it("rotates the beam by writing style.transform; WalkerMarkerShape renders once for 100 store updates")`, using `React.Profiler` `onRender` count.
- `tests/use-walker-heading.test.ts`: keep the unwrap cases (switching source never spins the beam), now through the store.
- `tests/google-current-position.test.tsx`: `it("creates the accuracy halo once and moves it with setCenter/setRadius across 5 fixes")`. Mock `useMapsLibrary("maps")` with a fake `Circle` class that counts constructions.
- Manual (owner, phone): stand and turn on the spot, then walk around a corner. The beam should turn with the phone with no visible lag.

**Risk.** Medium. Direct DOM writes bypass React: keep the beam element stable (always rendered, toggled with `display`) so React never replaces it. The compass-first policy changes behaviour, so it needs Ariel's sign-off first. iOS still needs the permission tap (already wired at `WalkPlannerApp.tsx:2876` and in the chat's `onStart`).

---

## 2. Walked trail is grey, not gold

### Evidence (git pickaxe)

- `git log -S f6b81c` returns `8085e40` (token added), `e7769a5` (feedback doc) and `a4ac3d9` (satellite gold). **No commit after `a4ac3d9` touches the trail colours.** The commits after it that touch `GoogleMapView.tsx` (5571118, 19d1837, 420a1d5, …) change follow, fit and fonts only.
- History of the walked trail on the roadmap:
  - before 8085e40 (2026-11-16): slate `#94a3b8`;
  - after it: greige `#b9ad9c` light / `#6e655a` dark.
  - It has **never** been gold on the roadmap.
- `src/lib/map/route-colors.ts:9-12,41-44`: `walkedTrail()` returns gold (`#f6b81c`, 4 px, 0.95, with a dark 7 px casing at 0.7) **only when `mapType === "satellite"`**. Otherwise it returns greige, 5 px, 0.9, no casing. This was the deliberate choice in `docs/FEEDBACK-ROUND-2026-11-22.md` §7 plan step 2 ("on the roadmap keep the muted route-past greige").
- `GoogleMapView.tsx:201,240-245` draws exactly that, under the route (z 0/1 against z 2/3).
- `WalkPlannerApp.tsx:566-582`: the map type is `useState("map")`, upgraded to `"satellite"` only from `localStorage["traike.mapType.v1"]`. It is per-origin: a new preview URL, a private tab or cleared site data shows the roadmap, so the trail is greige.
- Dark mode makes it worse: `#6e655a` on Google's dark roadmap is plain grey.
- `WalkPlannerApp.tsx:4787`: the toggle still says "Show the path I walked (**gray**)", in English inside the Hebrew UI.

**Conclusion.** The gold he remembers was the Satellite view from the 11-22 round. He is now on the roadmap, or his satellite choice was lost with the origin, so he gets the greige that was never changed. This is inference: confirm from his screenshot (painted map or imagery).

### 2.4 Related bug: the trail's polylines are re-created on every planner render

- `WalkPlannerApp.tsx:5249` passes `walkedGeometry={… [...walkedTrackRef.current]}`, a **new array each render**.
- `GoogleMapView.tsx:39-61` (`Line`) has `path` in its effect deps, so the old `google.maps.Polyline` is removed and a new one is built.
- With compass ticks (2 casing+core polylines x up to 6.7 renders/s, copying up to 5,000 points) this costs CPU, which feeds the beam lag, and can make the trail flicker.

### Plan (ordered)

**T1. One gold trail on every base map, weak but visible** (`route-colors.ts`)
- Satellite: unchanged (`SATELLITE_TRAIL`, already contrast-tested in `tests/route-colors.test.ts:52-80`).
- Roadmap: brand gold, quieter than the route. Starting values, to be tuned by **measured** contrast (below):
  - light: core `#f6b81c`, 4 px, opacity 0.7, plus a thin casing `#9a6b00` 6 px at 0.3;
  - dark: core `#f6b81c` 4 px at 0.6, no casing.
- Rule (owner's standing rule "weak but visible"): it must read as "behind you" next to the green route. Its contrast against Google roadmap land, roads, parks and water must sit in a band: at least 1.8:1 (visible) and below the route's own contrast (quieter).
- Measure the background colours with PIL from real phone screenshots of the Google roadmap, light and dark (see the memory note "measure, not approximate"). Do not guess them.

**T2. Tokens and pins**
- `src/app/globals.css:33,84` (`--tk-walked`) → the roadmap gold.
- `tests/design-tokens.test.ts:32-33` and `tests/route-colors.test.ts:44-45` update the pinned hex values.

**T3. Copy** (`WalkPlannerApp.tsx:4787`): "(gray)" becomes localized text with no colour word:
- he: `הסתר את הדרך שהלכתי` / `הצג את הדרך שהלכתי`;
- en: `Hide the path I walked` / `Show the path I walked`.

**T4. Stop re-creating lines**
- `Line` (`GoogleMapView.tsx:35-64`): create the Polyline in an effect keyed on `[map, maps, dashed, arrows]`. Update it in two more effects: `line.setPath(path)` keyed on `[path]`, and `line.setOptions({ strokeColor, strokeOpacity, strokeWeight, zIndex })`.
- `WalkPlannerApp`: add a `walkedVersion` counter bumped next to the push at `:3062` (inside the 1 s block). Then `const walkedPath = useMemo(() => [...walkedTrackRef.current], [walkedVersion])` and pass `walkedPath` at `:5249`.

**T5. Optional:** persist `mapType` in walk settings (synced) as well as localStorage, so a new preview URL keeps Satellite.

**Tests**
- `tests/route-colors.test.ts`:
  - `it("the walked trail is gold on every base map and theme")`;
  - `it("on the roadmap it is weak but visible: contrast against the measured roadmap colours is between 1.8:1 and the route's own")`.
- New `tests/google-line.test.tsx`: `it("builds one Polyline and updates it with setPath across 10 renders")`. Mock `@vis.gl/react-google-maps` `useMap`/`useMapsLibrary` with a fake `Polyline` class counting `new`, `setPath` and `setMap(null)`.
- `tests/walk-planner-sol-midwalk.test.tsx` harness (the DynamicMap mock records props): `it("walkedGeometry keeps its identity between renders that add no fix")`.
- Manual: a three-way phone screenshot (roadmap light, roadmap dark, satellite) for Ariel's sign-off before merge.

**Risk.** Low. Two palette entries, one copy string and one `Line` refactor. `Line` is also used for route and preview lines, so check that dashed and arrows lines still draw (`previewRoutes`, `GoogleMapView.tsx:248-250`).

---

## 3. The מסלולים tab is blank (and "the map cannot be opened")

### Evidence

- `WalkPlannerApp.tsx:557`: `walkMode = walkPhase === "walking" || rebuildingMidWalk`.
- `:1354-1359`: `hubTab = view === "walks" || "social"`, `walksScreen = view === "walks"`.
- **Side panel (aside) hidden** at `:4182`: `walkMode && !isDetailsOpen ? "hidden @4xl:block"`. The phone frame is narrower than `@4xl` (896 px), so the aside, which holds the WalksBand and the list, gets `display:none`.
- **Map column hidden** at `:5180`: `… : hubTab ? "hidden" : "flex"`. The WalkHud lives inside that column (`:5306-5361`), so it goes too.
- **List not rendered** at `:4374,4385,4413,4420`: every Walks block is gated on `isSignedIn && !walkMode`.
- What is left: the `bg-cream` frame (`PlannerFrame.tsx:138`, `WalkPlannerApp.tsx:4158`) plus the shell's `TabBar` (`AppShell.tsx:91`), which matches the owner's description exactly.
- **Not a render exception.** There is no error boundary anywhere (no `error.tsx` or `global-error.tsx` under `src/app`, no `getDerivedStateFromError`), so a render throw would have taken down the whole React root. The tab bar would have gone with it, or Next would have shown "Application error". The tab bar survived, so nothing threw.
- **Reproduced** with a scratch copy of the sol-midwalk harness, run outside the repo. Start a simulated walk, then re-render with `view="walks"`:
  - aside class contains `hidden @4xl:block`;
  - the map column (parent of the `map` test id) carries `hidden`;
  - `MyWalksPanel` is not rendered.
  - Scratch file: `/private/tmp/claude-501/-Users-arielshorpacker-Documents-obs-vault-try/5f0d39b7-bcca-484b-9f54-eab4a21014de/scratchpad/repro/walks-blank.test.tsx`.
- **Age.** This has been the behaviour since the shell (`a5783cb`) put a tab bar on the live walk (`d544ecc`). The aside gate dates from `d572a44e` (2026-10-05) and the map gate from `af63cee8`/`5571118`. The tablet/desktop commits (19d1837, 352787a, 5571118) did not cause it. On ≥ 896 px the aside does show during a walk, but it shows walk details, not the list.
- The e2e suite never opens Walks during a walk. `e2e/app-shell.spec.ts:69-87` visits Home only.

**"The map cannot be opened."** In code, the הליכה tab (`nav.ts:18`, walkLive) goes to `view=walk`, where `hubTab` is false and the map shows. Two readings, both covered by the fix and tests below:
- (a) The blank screen has no way back to the walk, and the bar's Walk tab is easy to miss.
- (b) Something on his phone that this diagnosis cannot see.

Ask the owner exactly what he tapped. The e2e test in C5 locks the Walks → Walk path.

### Related, found on the same path (undo of the owner's exact change)

His notice "נוסף: גן אלוש, גן סמטת החרוב · +40 דק׳" with "ביטול" comes from `runApplyChangesRebuild` (`:2126-2156`, `added.length * 20` = 40).

- **U1. Undo unpins only the first added place.**
  - `:2152` passes `added[0].id` as the notice's `placeId`; `:5335-5340` unpins only that id.
  - `keepPinned` (`:2000-2007`) pinned **both**. After "ביטול", "גן סמטת החרוב" stays pinned, and later rebuilds send its id in `pinnedAttractionIds` with no matching stop.
- **U2. Undo does not forget the dropped stops.**
  - `:2143` adds `dropStopIds` to `droppedStopIdsRef`. Neither the undo (`:5329-5341`) nor `revertToSnapshot` (`:3330-3402`) removes them.
  - The restored stops stay in `excludeIds`, which only filters discovery (`api/walk-plan/route.ts:465-470,552,608`), so the effect is low.
- **U3. A refused change leaves a trace.**
  - `:2143` (and `runDropStopsRebuild` at `:2320`) mark stops as dropped **before** `handleBuildWalk` may refuse with "still updating" (`:1573-1577`).
  - Compare `addPlaceToLiveWalk`, which checks `midWalkRebuildInFlightRef` first (`:2054-2058`).
- **U4. The "nothing fit" check looks at the first place only.** `announceAdded` checks only `added[0]` (`:2038-2041`). If the first place was dropped and the second added, it says "nothing fit".
- **U5. Walks-list actions would break a live walk once the list is visible.**
  - `showWalkOnMap` sets `walkPreview`, and while it is set the live route is not drawn (`:5240-5242`, `walkPreview ? [] : …`).
  - `onWalkAgain` / `onEditAsNew` (`:4403-4410`) start a new build over the live walk.

### Plan (ordered)

**C1. Failing test first.** New `tests/walks-tab-live-walk.test.tsx`, reusing the harness from `tests/walk-planner-sol-midwalk.test.tsx:1-137`: mocked DynamicMap, AssistantChat stand-in, fetch stubs, `SimulatedWalkTracker`. Also mock `MyWalksPanel` to a test id, and set `walk-settings` with `uiLanguage: "he"`.
- `it("during a live walk the Walks tab shows the walks list and 'חזרה להליכה' (phone width)")`
  - start the simulated walk, `signedIn = true`, `rerender(<WalkPlannerApp view="walks" onNavigate={nav} />)`;
  - assert a `my-walks` test id with no ancestor whose class has a bare `hidden` token;
  - assert a button `חזרה להליכה`; clicking it calls `nav("walk")`.
  - **Fails today.**
- `it("the owner's sequence: 'לבצע הכול' adds two places, 'ביטול' undoes it, then Walks renders and Walk shows the map")`
  - `assistantAnswer` = two `add-place` actions. `useWalkChat` turns them into `apply-changes` labelled `לבצע הכול (2 הוספות, 0 דילוגים)` (`useWalkChat.ts:282-285`).
  - click it, flush, click `ביטול` in `walk-notice`;
  - `view="walks"`: list visible. `view="walk"`: the map column has no `hidden`.
- `it("Undo after 'Apply all' unpins every added place")` (U1): the next rebuild's `pinnedAttractionIds` contains neither chat id.
- `it("a change refused while an update is running marks nothing as dropped")` (U3): the next rebuild's `excludeIds` lacks the stop.

**C2. Minimal fix: a Walks screen that works during a walk** (`WalkPlannerApp.tsx`, additive)
1. `const walksDuringWalk = walksScreen && walkMode;`
2. Aside (`:4182`): when `walksDuringWalk`, use plain `hidden` (at every width), so the walk details never show under the Walks band. It stays mounted, so the chat and the form survive.
3. Add one sibling inside the root flex row (next to the aside, before the map wrapper at `:5175`), rendered only when `walksDuringWalk`. It is a full-height scroll column `order-1 flex-1 overflow-y-auto bg-cream`, containing:
   - the `WalksBand` (as at `:4255`);
   - a sticky pill button **"חזרה להליכה" / "Back to your walk"** that calls `onNavigate?.("walk")`;
   - `WalksTabs` (as at `:4375-4383`);
   - `MyWalksPanel segment={walksSegment}` with the live-walk guards from C3.
4. Leave every `!walkMode` gate as it is, so the non-walk Walks screen does not change.

**C3. Guards while a walk is live** (U5)
- `onShowOnMap` / `onOpenOnMap`: omit them while live (the prop is optional).
- `onWalkAgain` and `onEditAsNew`: ask first with `window.confirm("לסיים את ההליכה הנוכחית ולהתחיל את זו?")` (en: "End the current walk and start this one?"). On yes, run `handleEndWalk()` then the original action.
- `onNewRoute`: go back to the walk.

**C4. Error boundaries, so a screen never goes blank on a throw**
1. New `src/components/ui/ScreenBoundary.tsx`: a class component with `getDerivedStateFromError` and `componentDidCatch` (`console.error("[ScreenBoundary]", name, error)`). Props: `name`, `lang`, `onHome?`, `walkLive?`. Fallback, Hebrew first:
   - title **"משהו השתבש במסך הזה"**;
   - body: with a live walk, **"ההליכה שלך ממשיכה ונשמרת."**; otherwise **"אפשר לנסות שוב."**;
   - button **"נסו שוב"**: resets the boundary state, which re-mounts its children;
   - button **"חזרה להליכה"** (live) or **"חזרה לבית"**;
   - last resort: link **"טעינה מחדש"** (`location.reload()`). The walk is saved every 15 s and on changes (`active-walk-store.ts`, `WalkPlannerApp.tsx:1049,1078`) and is offered again as "Continue walk" on Home.
   - English copy alongside.
2. Placement. Inner first, so the GPS watch keeps running when a panel throws:
   - inside `WalkPlannerApp`, around `MyWalksPanel`, `SavedPlacesTab`, `FriendsPanel`, `AssistantChat`, `DynamicMap`, `WalkHud`, and the C2 column;
   - in `AppShell.tsx:73-89`, around `HomeView`, `SocialView`, `MeView`, and (outermost) `PlannerFrame`.
3. Route level: `src/app/app/error.tsx` (client, uses `reset()`) and `src/app/global-error.tsx` with the same Hebrew copy. They replace Next's "Application error" page.

**C5. Never-blank guard tests**
- New `tests/no-blank-screen.test.tsx`: for `view ∈ {plan, walk, walks}` × `live ∈ {false, true}`, at phone width, at least one heading or button has no ancestor with a bare `hidden` token. A token like `hidden @4xl:block` counts as hidden on a phone.
- New `tests/screen-boundary.test.tsx`:
  - `it("a child that throws shows 'משהו השתבש במסך הזה' and 'נסו שוב' re-mounts it")`;
  - `it("a throwing walks panel during a live walk leaves the walk running")`: mock `MyWalksPanel` to throw, and assert the HUD and the tracker are still alive.
- New e2e `e2e/walks-during-walk.spec.ts`, phone 390 x 844, simulated walk, stubs as in `e2e/app-shell.spec.ts:69-87`:
  - start the walk, tap `מסלולים`: the band or list is visible, as is `חזרה להליכה`;
  - tap `הליכה`: `walk-hud` and the map canvas are visible;
  - `appErrors(watch)` is empty.

**Risk.** Medium-low.
- C2 is additive: one sibling block and one class condition. It must not change the non-walk Walks screen; the existing `tests/walks-segments.test.ts`, `tests/my-walks-variants.test.tsx` and e2e `responsive.spec.ts` cover that.
- Do not wrap the whole planner as the first defence: a boundary above `WalkPlannerApp` unmounts it and stops GPS. Use it only as the outermost fallback.
- `WalkPlannerApp` is a monolith that other sessions also edit: rebase first and land each fix in its own commit.

---

## Order of work (one commit each, tests first)

1. **C1 → C2 → C3**: the Walks tab works during a walk. This is the highest-impact item; the owner is stuck without it.
2. **C4 → C5**: boundaries and never-blank tests.
3. **U1, U3, U4** (small fixes in `runApplyChangesRebuild`, the notice `placeIds: string[]`, and drop-after-refusal). **U2**: on undo, clear the dropped ids from that change.
4. **B1**: beam size, plus the halo tone-down.
5. **T4 + B2 + B3 + B6 + B7 (halo created once)**: lines built once, beam rotated outside React, compass reader. B4 waits for Ariel's decision on compass-first. B5 regardless.
6. **T1-T3**: gold trail on the roadmap, after Ariel signs off the three-way phone screenshot.
7. Run `npx vitest run`, `npx playwright test e2e/walks-during-walk.spec.ts e2e/app-shell.spec.ts e2e/walk-hud.spec.ts`, `npm run lint` and `npm run build`.
8. Owner phone check: a live walk on the Google roadmap and satellite. Turn on the spot, walk a corner, open מסלולים and come back, add 2 places by chat and undo.

## Questions for Ariel

1. Beam source: compass whenever it is fresh (recommended), or keep "GPS course while walking ≥ 1 m/s"?
2. Trail on the roadmap: gold everywhere (recommended, matches "weak but visible"), or gold only on satellite as today?
3. "The map cannot be opened": which button did you press after the blank Walks screen? (הליכה, תכנון, or the black circle?)
4. Were you on Satellite in the earlier test, and on the regular map this time?
