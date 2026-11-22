# Feedback round 2026-11-22: phone test of the preview, diagnosis and plan

Branch `feat/design-r13-port` · Status: diagnosis and plan only, no `src/` change · Nothing deployed.

**Source:** Ariel tested the Vercel preview on his phone (Live Walk, Plan, wide-desktop Home). Nine items. Evidence labels: **Confirmed** = read in code or checked live; **Likely** = fits code and report, not provable without a device; **Not confirmed** = could not be shown.

Line numbers are from the working tree on 2026-11-22. `WalkPlannerApp.tsx` (about 5,000 lines) is edited by other sessions, so function names are the stable reference.

**Hard rules for every task below**

- The phone look is approved. Anything in batches C and D lives behind `lg:` / `md:` / `@4xl` (or a new wide-only asset) and must not change a 390x844 render. Each batch ends with a phone screenshot diff (Home, Plan, Live Walk, Me, Login, Hebrew and English, light and dark) against the pre-batch build; zero pixel change is the gate.
- Hebrew RTL stays mirrored. Use `start`/`end` logical utilities, never `left`/`right`.
- No `OPENAI_API_KEY` or `GEMINI_API_KEY` is ever printed or committed.

---

## Summary

| # | Item | Verdict | Batch |
|---|---|---|---|
| 1 | Walking direction on the location dot | Not built: heading is never read from the GPS or sent to the map. Busbo does it with a rotated icon and last-fix bearing. | A |
| 2 | See the whole route in Live Walk | The map already stops above the sheet; what is missing is a "fit route" control. | A |
| 3 | Black circle at the sheet edge | **Confirmed Vercel Preview Toolbar**, not our code. Not on production by default. | A (settings only) |
| 4 | OpenStreetMap or Google? | Base map is Google. The credit is HeiGIT's required routing credit. Wording cannot change, size/weight can. | A |
| 5 | Top-left thing, unrelated icons | Two different top-left controls; icon set is mixed (emoji, filled, stroked, text glyphs). One set planned. | B |
| 6 | "Back to my route" does nothing | Several silent exits plus no confirmation after success. Not reproducible by reading alone; fix makes every path visible. | A |
| 7 | Walked path grey, invisible | **Confirmed**: contrast 1.1 to 1.4 on sand, roofs, dry grass. Paper-map colour used on satellite. | A |
| 8 | Why a map under the Plan; tablet/desktop design | The strip previews the built walk but frames one stop, not the route. Everything except the planner is a phone column. | C |
| 9 | Blurry Home hero on wide screens | **Confirmed**: 1000x1500 portrait source stretched to the full width. New wide asset needed. | D |

---

## 1. Walking direction on the dot (like busbo)

### How busbo does it (Confirmed)

`/Users/arielshorpacker/Documents/obs_vault_try/school-bus/src/live/LiveMap.tsx`, the vehicle effect (line 11):

- It keeps `lastPos` and a `headingRef`. On each new location it computes the displacement in metres (`dy` = dlat x 111320, `dx` = dlng x 111320 x cos(lat)).
- If the move is more than **4 m**, `heading = atan2(dx, dy)` in degrees, 0 = north, and the marker is re-created with `transform: rotate(${heading}deg)` on a top-view bus image (`bus-rear.webp`) or an SVG for the parent view.
- Under 4 m the previous heading is kept, so a parked bus does not spin. No compass sensor, no smoothing.

That is last-fix bearing, which suits a bus (fast, steady). A walker at 1.4 m/s with 5 to 15 m GPS error needs more care.

### What Traike has today (Confirmed)

- `src/lib/geo/locate.ts:113-122` `toFix()` copies latitude, longitude, accuracy, timestamp and `speed`. It drops `pos.coords.heading`.
- `src/lib/walk/walk-tracker.ts:9-18, 121-141` computes `bearing` between consecutive engine-grade fixes and puts it on `PaceUpdate.bearing`, but the app does not use it for the dot. Per fix it is noise (about 1.4 m moved against several metres of error).
- `src/lib/walk/heading-monitor.ts` `recentHeading()` (line 192) gives a steadier heading (15 m chord over the last 20 s) but lags a turn by about 10 to 15 s, and returns null when standing.
- The dot is a plain blue circle, `#2563eb`: `src/components/map/GoogleMarkers.tsx:107-134` (`GoogleCurrentPosition`) and `src/components/map/CurrentPositionMarker.tsx`. Blue is not in the brand. The design brief (`docs/design-brief/BRIEF.md`, "Walker = 34px leather disc, 2.5px surface ring, 1.5px ink hairline") already specifies the walker marker as leather. It was never built.
- No `deviceorientation` use anywhere.

### Plan

1. **Heading source, in priority order** (new pure helper `src/lib/walk/heading-smoother.ts`, `HeadingSmoother`):
   1. `coords.heading` from the browser when finite and the device speed is at least 0.7 m/s (the OS already fuses it, best when moving).
   2. Else bearing between two engine-grade fixes at least 8 m apart (both accuracy at most 25 m).
   3. Else hold the last heading; after 20 s without a valid one, fade the cone out instead of pointing the wrong way.
   Smooth on the circle (EMA, alpha about 0.35), carry an unwrapped angle so 359 to 1 degree does not spin the marker the long way round.
2. Thread it: `LocateFix.headingDeg?` (locate.ts) to `PaceUpdate.headingDeg?` (walk-tracker.ts) to a `currentHeadingDeg` state in `WalkPlannerApp` next to `setCurrentPosition` (about line 2784) to `DynamicMap` prop `currentHeadingDeg` (`MapViewProps` in `MapView.tsx:~65`) to both markers. The simulator (`simulated-walk-tracker.ts`) already knows the direction it walks; give it a `headingDeg` too so tests and the demo show the cone.
3. **Marker design (brand):** leather disc `--tk-leather`, surface ring, ink hairline, with a small cone/chevron on the leading edge, rotated by CSS `transform: rotate(var(--h))` with `transition: transform .4s`. White ring plus ink hairline keeps it readable on satellite. Keep the accuracy halo, recoloured to leather at the same alpha. No cone until a heading exists. Google: rotate the `AdvancedMarker` child div. Leaflet: same markup in the `divIcon`.
4. Compass sensor for standing still: **not in v1.** iOS needs `DeviceOrientationEvent.requestPermission()` from a tap, Android needs `deviceorientationabsolute`, and both add a permission prompt. Offer later as "show which way I face" if Ariel wants it.

### Tests

- `tests/heading-smoother.test.ts`: uses `coords.heading` when moving; falls back to 8 m chord; ignores a poor-accuracy chord; holds then expires; wrap-around 350 to 10 degrees takes the 20 degree arc; standing still never flips.
- `tests/locate.test.ts` extension: `headingDeg` copied only when finite; `NaN`/null becomes undefined.
- `tests/current-position-marker.test.tsx`: renders the cone with the right rotation, no cone when `currentHeadingDeg` is undefined.
- Simulated walk (existing harness): the cone follows the route direction at a turn.

### Risk

Low. Visual only; no change to route, pace or deviation logic (they keep using their own bearings). Watch: iOS Safari reports `heading` as -1/NaN when slow; the guard covers it.

---

## 2. See the whole route in Live Walk

### Findings (Confirmed)

- The map already ends above the sheet: `GoogleMapView.tsx:~158` sets `bottom: var(--hud-h, 9rem)`, and `WalkHud.tsx:~64-77` publishes the sheet height as `--hud-h`. So the route is not hidden behind the sheet; the map is just a short window (about 45 percent of a phone screen once the 62 px tab bar and the sheet are counted) that **follows the walker** (`PositionFollower`, `GoogleMapView.tsx:88-108`) at the zoom he last used.
- There is no way to zoom out to the route in one tap. `MapGlyphs.tsx` has two glyphs only: re-centre and layers. `FitPath` (`GoogleMapView.tsx:79-85`) fits once, only for a saved-walk preview. The Leaflet view (`MapView.tsx`) declares `fitPath` but never uses it.
- A drag pauses following, then `useFollowPause` resumes it after 15 s (`useFollowPause.ts:6`). Any overview built on drag or a one-shot fit would snap back after 15 s.

### Simplest plan

1. **Third glyph "whole route"** in `MapGlyphs` (between re-centre and layers). Tap: pause follow with a long hold, `fitBounds` over remaining route + walked path + current position, with padding top 72 (the chip row), 24 elsewhere. Tap again, or tap re-centre, to resume. Glyph shows `aria-pressed` while in overview.
2. `useFollowPause`: add `hold(ms)` (default 60 s, resumes on re-centre or visibility change as today), so the overview is not cut at 15 s.
3. Pass `routeGeometry` and `walkedGeometry` into `PositionFollower` (Google) and the Leaflet follower so the same hook and the same fit logic serve both views; Leaflet gets `fitBounds` too (and finally honours `fitPath`).
4. Not now: a collapsible sheet. The `peek` state is already the smallest; a fit button solves the request with one control. Revisit only if he still wants more map after trying it.

### Tests

- `tests/use-follow-pause.test.tsx`: `hold(60_000)` does not resume at 15 s, does at 60 s, resumes on `resume()` and on visibility.
- New `tests/map-glyphs.test.tsx`: three buttons when following is on, correct labels in Hebrew, `aria-pressed` toggles.
- A pure helper `fitPadding(hudInset, isPhone)` with a unit test; the `fitBounds` call itself is verified in the Playwright phone screenshot (route fully inside the map window).

### Risk

Low. Watch the Leaflet and Google views drifting; keep one shared hook (as the 2026-11-21 follow fix already does).

---

## 3. The black circle at the sheet's edge

### Verdict: it is the Vercel Preview Toolbar (Confirmed)

- Vercel's docs ("Managing the visibility of the Vercel Toolbar", checked 2026-11-22): "By default, the toolbar will appear as a circle with a menu icon", on **preview** deployments. That matches the dark circle with a list icon at the edge.
- Our code has no such control: no `@vercel/toolbar` or `vercel.live` in `package.json` or `src/`; the only `fixed` elements are the shell (`Rail`, `TabBar`, screens, `ModalSheet`, `ConsentGate`, `WalkFinishCard` confetti). `AccountIndicator` and `RefreshButton` (the only other round fixed controls) are dead code, rendered nowhere. The Live Walk glyphs are paper/forest coloured and at the top, not dark.
- `vercel env ls preview` shows no `VERCEL_PREVIEW_FEEDBACK_ENABLED`, so the Vercel default (toolbar on) applies.
- It appears only to people signed in to Vercel on a team member account, so real users and testers do not see it. **Production:** not shown by default (the docs list it for "preview or enabled environments"; production needs explicit enabling, the browser extension, or `@vercel/toolbar`, none of which this repo has).

### How to remove it (owner steps, 1 minute, no code)

Pick one:

1. Dashboard, project `hiking-route-planner`, Settings, General, **Vercel Toolbar**, **Pre-Production Deployments: Off** (Production stays as is).
2. Or add the env var `VERCEL_PREVIEW_FEEDBACK_ENABLED=0` for the Preview environment and redeploy.
3. Or just for his phone session: tap the circle, scroll the menu, "Disable for Session"; or drag the circle to the X that appears at the bottom.

No `vercel.json` setting exists for this; do not add code for it. For Playwright runs against a preview, the docs' `x-vercel-skip-toolbar` request header keeps the toolbar out of screenshots.

### Hebrew, for Ariel

העיגול השחור הוא סרגל הכלים של Vercel לגרסאות תצוגה מקדימה, לא חלק מהאפליקציה. רק מי שמחובר לחשבון Vercel רואה אותו, ובגרסה האמיתית (production) הוא לא מופיע. מכבים אותו בהגדרות הפרויקט ב-Vercel: Settings, General, Vercel Toolbar, Pre-Production Deployments: Off.

### Tests / risk

None needed. Zero risk to the app.

---

## 4. "Is the map OpenStreetMap? It should be Google"

### Answer (Confirmed from code)

- The base map is **Google**: `src/components/map/DynamicMap.tsx:12-18` picks `GoogleMapView` whenever `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` is set and `NEXT_PUBLIC_MAP_PROVIDER` is not `leaflet`. The Preview environment has both variables, and the screenshot shows Google satellite.
- The text "openrouteservice by HeiGIT | Data from OpenStreetMap" is not the map. It credits the **walking route lines**, which come from openrouteservice using OpenStreetMap street data. `GoogleMapView.tsx:149-153` builds it, `MapCredits.tsx` draws it. `docs/data-source-terms.md` records HeiGIT's terms: the credit must read exactly that.

### Hebrew, 2 lines

המפה עצמה היא של Google. השורה הקטנה היא קרדיט חובה על מקור קווי ההליכה (openrouteservice על נתוני OpenStreetMap), והיא לא משנה את המפה.

### Smaller or less intrusive? (partly)

- **Wording: no.** Terms require the exact wording; the ORS terms say it can sit "on the map image or elsewhere", and OSM's rules want it reasonably visible. (One search snippet showed an older wording, `© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors`; our checked-2026-10-26 text is the current one. Re-read https://account.heigit.org/info/tos before changing anything.)
- **Style: yes, safely.** Today it is a paper pill, 11 px, at `bottom-6 end-2` (bottom-left in Hebrew), tappable for a bigger box. Options that keep the wording always visible: drop the pill background for a text-only 10.5 px line at 80 percent opacity with a light halo; or move it to the start corner on one line.
- **Collapsing to a bare "i" button** (full text on tap) is arguably allowed by "or elsewhere" but contradicts our own recorded decision (wording always visible). Do it only after a written OK from HeiGIT, or accept the risk consciously.
- Recommendation: restyle only (task A5, optional); keep the wording and its visibility.

### Tests / risk

Existing credit tests keep passing; add one asserting the exact wording is in the DOM without a tap. Low risk.

---

## 5. The top-left thing, and icons that do not match their function

### What is "top-left" (Confirmed, it is two different controls)

- **Plan screen, gear (Hebrew: top-left of the chat card):** `src/components/assistant/AssistantChat.tsx:626-640`, pushed to the end with `ms-auto`, so it sits at the **left in Hebrew**. It toggles `AssistantSettings` (`AssistantSettings.tsx:90`): standing defaults the assistant uses "when you do not say otherwise", saved in this browser only (`localStorage traike.assistantDefaults.v1`): time available, search radius, end-at-most-this-far, max walking distance, walking pace preset, and "what I like" (less/normal/more per category, for "surprise me"). Its label is "Assistant settings" with no visible word.
- **Live Walk map, top-left in Hebrew:** `MapGlyphs.tsx` (`end-3 top-3`): the re-centre crosshair and the layers glyph. Layers does not open a layers menu: `onOpenDetails` opens the **whole Details sheet** at its display section (`WalkPlannerApp.tsx` `openDetailsAtDisplay`).
- **"Traike" tag at the top of the Live Walk map (`WalkHud.tsx:93-101`):** a `<span class="tk-paper-tag pointer-events-auto">` with no handler. It looks tappable and does nothing.

### Icon audit (Confirmed from code)

| Where | Today | Problem | Plan |
|---|---|---|---|
| Tab bar: Plan / Walks (`shell/icons.tsx:13-33`) | trail + ring vs S-curve + two rings | Near-identical; neither says "plan" or "saved walks" | Plan = dashed trail with stop rings (a route being composed). Walks = solid trail on a small card/list tile (saved). |
| Tab bar: Home, Walk, Me | house, walker, head+shoulders | Fine | Keep; Walk gets a small live dot while a walk runs |
| Chat gear (`AssistantChat.tsx:638`) | filled polygon gear, 17 px | Different style from the rest; hides what it does | "Sliders" glyph plus a visible label "Preferences / העדפות" |
| Chat mic / speak / attach / custom walk (`AssistantChat.tsx:717, 869, 887`, strings 115, 158) | emoji 🎤 🔊 ⏹ 📎 📍 | Colour emoji change per phone; ban-listed in `BRIEF.md` ("no emoji") | Stroke SVGs: mic, speaker, stop, paperclip/image, Ring |
| Map glyphs (`MapGlyphs.tsx`) | crosshair, layers stack | Layers opens a full sheet | Re-centre = navigation arrow (filled when following); layers = "map style" stack that opens only a small style popover (or relabel the action); new fit-route glyph (item 2) |
| Location chips ("My location", `StartLocationPicker.tsx:170-178`, `LocationChip.tsx`) | champagne ring | Ring = "stop" in the brief; users read a dot, not a place | Ring with core stays as the brand's place mark, but add a pin-with-ring glyph for "use my GPS" (target) vs search (magnifier) |
| Map credits, close buttons, notices (`MapCredits.tsx:29`, `AssistantChat.tsx:672`, `DroppedStopsPanel.tsx:45`, `WalkPlannerApp.tsx:4970`) | text glyphs ⓘ ✕ ⚠ ✓ ★ | Font-dependent | One `CloseIcon`, `InfoIcon`, `WarnIcon`, `CheckIcon` |
| Live Walk "Traike" tag (`WalkHud.tsx:94-101`) | brand mark, not a control | Looks like a button; duplicates the app icon in a different drawing | Remove from the walk map (recommended), or make it the Ask entry |
| Walk sheet: End walk, Ask | text, a chat pill | No icon | Stop (square) for End walk; chat bubble for Ask, same glyph as the assistant |
| Misc: `Refresh` (`ui/RefreshButton.tsx`), `SideTabs` path icons | unused / legacy | Dead or off-system | Delete `AccountIndicator` and `RefreshButton` (dead); redraw `SideTabs` icons from the new set or remove the component if unused on the desktop planner |
| Brand mark in three drawings | `traike-icon.png`, HUD svg, `PlanIcon` | Three versions of the logo | One `TraikeMark` svg component |

### Plan: one set (task B1 to B6)

Grammar from `BRIEF.md` ("Trail mark on limestone"): 24 viewBox, **1.75 stroke**, round caps and joins, 22 px, `currentColor`; two primitives only (Ring = a place/stop, Trail = a route line); leather only for "go / you / now"; pine ink for selected states; no emoji, no Lucide. One file `src/components/ui/icons.tsx` (move and extend `shell/icons.tsx`); each icon matches one function and is used for that function everywhere ("same action = same icon", `BRIEF.md` line 15). RTL: icons that imply direction get `rtl:-scale-x-100` (arrow, back, walker, trail).

### Tests

- `tests/icons.test.tsx`: every exported icon renders an `svg` with `aria-hidden`, `viewBox="0 0 24 24"`, `stroke-width` 1.75, no fixed colours (only `currentColor` or tokens).
- A lint-style test grepping `src/components` for the banned emoji and `✕ ⓘ ⚠ ★` in JSX (allow-list for place-category data).
- Contact sheet in Playwright (all icons, light and dark, `dir=rtl`) saved to `docs/design-brief/shots/` for Ariel to approve before the swap lands.

### Risk

Medium on taste, low on logic. Ship in two steps: new set plus contact-sheet approval first, then the swaps. Phone layout is unchanged because icons keep their 22 px boxes.

---

## 6. "Back to my route" does not work

### What the button does (Confirmed)

`OffRouteCard.tsx` `onBack` is wired at `WalkPlannerApp.tsx:~3782`: in ask mode it clears the countdown, then `runLocalRejoin()` (`:2442`). That picks up to two rejoin points ahead on the old route (`rejoin.ts:rejoinCandidates`), calls `POST /api/reroute` (ORS foot-walking, `src/app/api/reroute/route.ts`) for a street connector, and splices `connector + rejoin point + rest of route` (`rejoin.ts:104`, `spliceRoute`) into `remainingGeometry`.

### Why it can look like nothing happened

Not reproduced (no device, and the existing tests only assert that `/api/reroute` was called: `tests/walk-hud.test.tsx:388-399`, never that the card goes away or the line changes). Ranked by how likely each is in the field:

1. **No confirmation after success (Likely, main cause).** After the splice the walker is still off the road he was on. `spliceRoute` starts at the connector, which starts where **ORS snapped him to a street** (`route.ts` returns the ORS geometry, not `from`); the walker's own position is not part of the line. Off-route state clears only when he is within 30 m of the new line (`deviation-detector.ts:134-149`, on above 50 m, off below 30 m). In a park or on a trail the snap can be 40 m or more away, so he stays "off route", the card stays up in its "notice" mode (`WalkPlannerApp.tsx:~3487-3490`), and he sees the same card with a new green line he may not notice. Also `if (!offRoute) setRemainingGeometry(remaining)` (`:2992`) keeps the line frozen while off route, which is right but means nothing moves.
2. **Silent exits on a manual tap (Confirmed in code):**
   - `:2447` `rejoinInFlightRef` already true: return.
   - `:2449` `collapseFlow.isCollapsed()`: return. The collapse phase is set the moment the fetch for direction options starts (`useCollapseFlow.ts` `feed` then `request`), while the off-route card is still up (it is hidden only once options exist, `optionsOffer === null`). A tap during that fetch is dead.
   - `:2458` cooldown `LOCAL_REJOIN_COOLDOWN_MS` (60 s, `walk-cadence.ts:51`): return. Written by a successful rejoin and also by the shortcut feature (`applySplicedRoute`, `:727-735`). A second stray within a minute, tapped "Back", is dead.
3. **Failure paths with no message (Confirmed):** a 422/429/502 from `/api/reroute`, no plausible connector (`isPlausibleConnector`), or no candidates all go to `rejoinFailed()` (`:2450`), which either counts toward a collapse or starts a **full rebuild** (`runDeviationTriggeredRebuild`, `:2452`, also `:2455`, `:2464`) without ever telling him the way back failed. During the rebuild the off-route card is replaced by the sheet alert "Updating your route…" (the first branch of the alert chain, `:~3410`), which reads as a different action from the one he tapped; the card's own busy state (`isFindingWayBack`) is not set on this path. ORS is configured on Preview (`ORS_API_KEY` present), so a missing key is not the cause.
4. **Stale `from` (Likely, minor):** `latestPaceUpdateRef` is the last engine-grade fix. The manual tap has no 20 s staleness guard (only the auto timeout at `:2605` has `STALE_FIX_MS`). After a GPS gap the connector starts where he was.
5. **Collapse machine never told about a success (Confirmed, hardening):** `rejoinFailed` exists on `useCollapseFlow`; a success is never reported, so a successful-but-unfollowed rejoin leaves the machine in `OFF_ROUTE` and the 8-minute collapse clock running.

### Fix plan (minimal, makes every path visible and removes the silent ones)

1. `runLocalRejoin` returns an outcome (`routed | busy | cooldown | collapsing | rebuilding | failed | stale`). For a **manual** tap (`auto === false`): ignore the cooldown; show a `showWalkNotice` (`:1420`, the existing sheet notice) for every outcome except `routed`; in `collapsing`, cancel the collapse fetch (`collapseFlow.clear()`) and carry on with the rejoin, or disable the button while `collapseFlow.loading`.
2. On `routed`: show a notice "Way back drawn, follow the green line (120 m)", mark the excursion answered (`setOffRouteDismissed(true)`; it already re-arms when he is back on the line, `:2865`), call a new `collapseFlow.rejoinSucceeded()` (`rejoinResult(..., ok: true)`), and if the connector's first point is more than 40 m from `from`, say "walk to the road first" in the notice. If he later drifts more than 50 m from the **new** line the card returns by itself.
3. `rejoinFailed` / far-away branches say why before the full rebuild starts ("No street way back found, rebuilding your route from here"), so the "Updating your route…" alert that follows makes sense.
4. Staleness guard: if the last fix is older than 20 s, say "waiting for GPS" instead of splicing from it.
5. **Preview-only diagnosis aid:** when `process.env.NEXT_PUBLIC_VERCEL_ENV === "preview"`, append the outcome code to the notice so the next field test names the exact path.

### Tests (write red first)

In `tests/walk-hud.test.tsx` (simulated walker, `rerouteMode` stub already exists):

- success with a connector that starts 60 m from the walker: card gone, notice shown, line replaced; stray again beyond 50 m of the new line: card returns.
- manual tap inside the 60 s cooldown: not silent, rejoin runs.
- tap while `collapseFlow` is loading: not silent.
- `/api/reroute` 429, 422, 502 each: explanatory notice, then the full-rebuild alert; never a no-op.
- stale fix: "waiting for GPS" notice, no `/api/reroute` call.
- `tests/use-collapse-flow.test.tsx`: `rejoinSucceeded` resets phase and failures.
- Update `tests/walk-hud.test.tsx:388` to assert the outcome (card state and line), not just the fetch.

### Risk

Medium (touches the walk engine paths). Keep the change to `runLocalRejoin` and the `onBack` handler; do not alter detection thresholds. The monolith is edited by other sessions: land it on its own commit, rebase first.

---

## 7. The walked part of the route is grey and hard to see

### Findings (Confirmed)

- `src/lib/map/route-colors.ts:8-9`: walked `#b9ad9c` (light) / `#6e655a` (dark); `globals.css:33, 81` (`--tk-walked`); drawn at 5 px, 0.9 opacity, no casing, below the route (`GoogleMapView.tsx:183`, `MapView.tsx:225-228`). These are the brief's `route-past` tokens, tuned for the painted paper map (land `#F2ECE1`), not for satellite. The satellite/roadmap choice never reaches `routeColors`, and the colour scheme follows the theme only.
- WCAG contrast ratios, computed on 8 typical hybrid-imagery colours (script run 2026-11-22):

| Background | canopy | shadow | veg | sea | asphalt | dry grass | sand | roof/concrete |
|---|---|---|---|---|---|---|---|---|
| current walked `#b9ad9c` | 5.4 | 7.4 | 2.6 | 3.4 | 3.3 | **1.4** | **1.1** | **1.4** |
| gold `--tk-sun` `#f6b81c` | 6.6 | 9.2 | 3.2 | 4.2 | 4.1 | 1.7 | 1.1 | 1.1 |
| cream `#f8f3ea` | 10.7 | 14.8 | 5.2 | 6.7 | 6.6 | 2.7 | 1.8 | 1.5 |
| pine ink `#1b2620` | 1.3 | 1.1 | 2.7 | 2.1 | 2.1 | 5.2 | 8.0 | 9.6 |

  The current colour disappears on exactly the beige, dry-grass and rooftop imagery that Israeli cities are made of. The remaining route survives only because of its 9 px white casing (white vs canopy 11.8:1).
- No single fill works on both dark and light imagery; the route solves this with casing, so the walked trail needs the same trick.

### Plan

1. **Core plus casing, subtle:** core `#f6b81c` (brand sun) 4 px at 0.95, casing `#1b2620` 7 px at 0.5. Worst case across the eight backgrounds, best of core or casing: 3.23:1 (passes the 3:1 non-text bar). Same pair in both themes. Keep the walked line under the route and thinner (4 vs 5 px) so it reads as "behind you".
2. Make it map-type aware: `routeColors(theme, mapType)`; on the roadmap keep the muted `route-past` greige (that paper look is approved), on satellite use the new pair. Pass `mapType` into `LineProps` (casing is a second `Line`, as the route already does).
3. Check the next-stop marker ring (`GoogleMarkers.tsx:~34`, `0 0 0 3px var(--tk-sun)`) does not read as the same thing; if it does, use `#ffb347` for the trail instead and keep sun for the stop.
4. Take a three-way screenshot (current, gold+ink, cream+ink) over real Google hybrid tiles of a beige street, a park and the sea, phone size, and let Ariel pick before merging.

### Tests

- Update `tests/design-tokens.test.ts:32-33` (it pins the old walked hex).
- New unit test: for every (theme, mapType) pair, contrast of `max(core, casing)` against each of the eight reference backgrounds is at least 3:1; guards future palette edits.
- Component test for `GoogleMapView` is not practical; verify with the screenshot.

### Risk

Low. One palette function and two `Line` calls; roadmap look unchanged.

---

## 8. Why a map under the Plan, and a design pass for tablet and desktop

### 8a. What the Plan map is for (Confirmed)

`WalkPlannerApp.tsx:~4848-4856`. On a phone it is hidden while idle (`planMapHidden`, `:3811`). Once the assistant returns places or a route, a strip `h-[26%] min-h-[170px]` appears under the chat. Purpose: **preview the built walk before starting** (stops, route, pinning a stop with a tap, `onTogglePin`), with "Full map" (`mapFull`) to open it full screen. On a container 896 px wide (`@4xl`, laptop or tablet landscape) it is the big pane next to the 320 to 400 px form. In his screenshot it shows because places existed and his saved base map is satellite (`traike.mapType.v1`).

Problems found: (1) after a build the map **centres on the first stop at zoom 14** (`focusOn(plan.orderedAttractions[0].coordinates, 14)`, `:1225`), so the strip shows one stop, not the route; (2) two "Full map" entries (the overlay button `:4900-4909` and the `tk-bar` row `:4798`); (3) 170 px of height is too little to read a route.

**Recommendation: keep, redesign minimally.** Auto-fit the strip to the route and stops when a plan appears (reuse `fitPath`, make Leaflet honour it); add the brief's paper tag ("4 stops, 4.1 km") on the strip; remove the duplicate "Full map" row on phone (keep the overlay button); raise the strip to 32 percent. Hide it, as now, when there is nothing to show. Do not remove it: pinning and "what does this walk look like" need a map.

### 8b. Responsive state today (Confirmed)

- Only the planner adapts (container queries, `@4xl` two panes, `@6xl` wider sidebar; Rail at `lg`, TabBar below).
- Home (`HomeView.tsx:232, 291`), Me (`MeView.tsx:158`), Friends (`SocialView.tsx:487`), band headers (`ScreenBand.tsx:30, 37`) are `max-w-[560px]` centred columns; Login/Signup (`AuthScreen.tsx:39`) is a 440 px column with side borders.
- `forgot-password`, `reset-password`, `pricing`, `privacy` still use the older `font-brand` (Heebo) and a centred-card pattern, different from `AuthScreen`'s Manrope/Frank Ruhl system.
- Live Walk: `WalkSheet.tsx` (root div classes) is `absolute inset-x-0 bottom-0`, so on desktop the sheet spans the whole map (about 1,000 px), the stats bar stretches, and the map window shrinks.
- No tablet tier exists; 640 to 1023 px is the phone layout stretched.

### 8c. Plan per screen (tiers: phone under 640 unchanged; tablet 640 to 1023, bottom TabBar kept; desktop 1024 and up, Rail)

| Screen | Tablet (md, 768) | Desktop (lg, 1024+; xl 1280) |
|---|---|---|
| Home | Hero full-bleed; text block at the start side, timeline beside it in two columns; recent walks in a 2-column grid; content `max-w-[860px]` | Hero band `min-h` 46vh with the wide image (item 9); content in two columns: left = hero text, minutes, CTA; right = route timeline and recent walks; `max-w-[1120px]`; no 560 px column |
| Plan | Two panes when the container is at least 720 px (`@3xl`, form 300 px + map), else stacked with a 38 percent map | Keep `@4xl` two panes (320 px, 400 px at `@6xl`); sidebar form `max-w-[440px]` inside |
| Live Walk | Sheet `max-w-[560px]` centred | Sheet becomes a **floating panel** at the start side, 400 px wide, bottom-anchored with margin; map fills the rest; stop chip stays top; Details sheet becomes the existing `@4xl` side column |
| Walks / Friends / Me | Single column `max-w-[720px]`, cards in 2 columns where they are lists | Two-column grid `max-w-[1040px]` (list left, detail or profile card right); band art stays the header, capped at the column |
| Login / Signup | Same card, centred, `max-w-[480px]` | Split layout: art and guide on the start half, form on the other, `max-w-[960px]`; the phone band becomes the left panel |
| Forgot / reset password | Rebuild on the `AuthScreen` frame (shared `AuthFrame` component) | Same split as Login |
| Pricing / privacy | `max-w-[720px]`, new fonts | `max-w-[1120px]` pricing grid; privacy `max-w-[720px]` |

Implementation shape: three tokens only, defined once (`--tk-page-max-tablet: 860px`, `--tk-page-max-desktop: 1120px`, a `.tk-page` and `.tk-grid-2` utility pair in `globals.css`); every screen opts in by class. Container-query breakpoints already used by the planner stay as they are.

### 8d. Design coherence pass

One `AuthFrame` for all auth pages; move `pricing`/`privacy`/auth to `font-app-sans` and the same `tk-btn` controls; delete `font-brand` usages that remain outside marketing. Done after batch B so the new icons land once.

### Tests

- Playwright screenshots at 390, 768, 1024, 1440, 1920 for each screen, English and Hebrew, light and dark, saved under `docs/design-brief/shots/r14/`; phone shots must be pixel-identical to the pre-batch build.
- `e2e/responsive.spec.ts`: no horizontal scroll at each width; Rail visible at 1024 and up, TabBar below; Home shows two columns at 1280.
- Existing `tests/walk-hud.test.tsx` layout assertions must still pass (the desktop floating-panel rules are `lg:` only).

### Risk

Medium-high by volume, low per screen; the phone gate is the safety net. Do Home and Live Walk first (they were what Ariel saw).

---

## 9. Home hero: blurry on wide screens, figure position

### Findings (Confirmed)

- `HomeView.tsx:225-226`: `<Image fill sizes="100vw" className="object-cover object-[50%_38%]">` of `home-forest.jpg`, **1000x1500 portrait** (byte-identical to `docs/design-brief/gemini/assets/meadow-hiker.jpg`). A 1368 px content width (1440 screen minus the 72 px Rail) scales it 1.37x; a 1920 screen 1.9x; retina doubles that. That is the blur. Also the portrait crop into a short band (about 330 px) shows only a strip of meadow on desktop.
- The hiker sits at about 52 to 76 percent of the image height; the header's bottom gradient (`HomeView.tsx:227-230`, to paper at 88 to 100 percent) fades exactly that zone, so even on phone he is partly washed out. The `city` variants (`home-city.jpg` 941x340) have the same resolution limit.
- No script in the repo generated these. The assets came from the Gemini round and a chat tool. First-party options: the OpenAI key in `.env.local` is valid and lists `gpt-image-2`, `gpt-image-2.5-flare`, `gpt-image-2.6-sunburst` and others (checked by listing models only; nothing was generated).
- **Gemini check (one call, 2026-11-22):** `GEMINI_API_KEY` is not in `/Users/arielshorpacker/Documents/obs_vault_try/school-bus/.env.local` (the file has no such name). The Traike repo's own `.env.local` key, the one `docs/design-brief/ask-gemini.mjs` reads, answered **HTTP 402 RESOURCE_EXHAUSTED: "Your prepayment credits are depleted"** for `gemini-4-carbon`. Not the earlier 403, but still unusable until credits are added at AI Studio. Design help from Gemini is blocked; I did not substitute another model.

### Plan

1. **Phone stays exactly as is.** Keep the existing `<Image>` pair behind `lg:hidden`/`md:hidden` (`max-w` rule so nothing changes under 640 px); add a wide pair `hidden md:block` (and night variant `dark:`).
2. **New wide asset (task D2):** landscape **2880x1200** (2x at 1440) forest-meadow scene, same mood and palette as `home-forest.jpg` (misty valley, wildflowers, orange pack), the traveler **forward and larger** in the lower-left third (start side for LTR; mirror via `rtl:-scale-x-100` for Hebrew so the figure sits on the reading side), clear sky/mist area on the opposite side for the text, no text in the image. Plus a night variant. Export JPEG about 250 to 400 KB each; Next serves responsive sizes (`sizes="(min-width:1024px) calc(100vw - 72px), 100vw"`).
3. Generation route: OpenAI image API (`gpt-image-2`, size 1536x1024 then upscale and crop, or two passes) via a small script `scripts/gen-home-hero.mjs` reading `OPENAI_API_KEY` from the environment (never logged); keep the prompt and the chosen seed/file in `docs/design-brief/`. Run the **asset-brief gate first**: scope, number of generations, rough cost, Ariel approves the anchor frame before the night variant. Fallback if the key or quota fails: ask Ariel to provide the image from his usual chat tool.
4. **Wide layout** (with item 8): hero as a full-bleed band; text and CTA at the start side in a column of about 440 px; the traveler is visible on the other side, not under the gradient; timeline and recent walks in the second column below.
5. **"Figure slightly more forward, visible on phone too":** this conflicts with "the current phone Home image is approved". Do not touch the phone image. If Ariel wants the traveler more visible on phone, treat it as a separate variant behind `?homebg=` (`homeBg` state already exists, `HomeView.tsx:144`) and show it to him next to the approved one. Open question below.

### Tests

- `tests/home-view.test.tsx`: phone `<Image>` props unchanged (`src`, `sizes`, `object-position`); wide variants present with `hidden md:block`.
- Playwright: at 1920 the rendered image's natural width at least 1.5x its displayed width (no upscale); phone screenshot identical to before.
- A file-size budget check (hero JPEGs at most 450 KB).

### Risk

Medium on taste and cost (image generation), low on code. The upscale blur is also reduced immediately by serving the existing portrait only on phone and the new landscape elsewhere.

---

## Implementation order (small tasks for separate Sonnet agents)

Each task: its own commit, `npx tsc --noEmit -p .` clean, full `npx vitest run` green, phone screenshots unchanged unless the task is a phone-visible bug fix. Land in batch order; inside a batch tasks are independent unless noted. `WalkPlannerApp.tsx` tasks (A1, A2) go one at a time, rebasing first.

### Batch A: bug fixes (3, 6, 7, 1, 2, 4)

| Task | Item | What | Files | Tests |
|---|---|---|---|---|
| A0 | 3 | Owner step: turn the Preview Toolbar off (Settings, General, Vercel Toolbar, Pre-Production Off, or `VERCEL_PREVIEW_FEEDBACK_ENABLED=0`). No code. | Vercel dashboard | Ariel reloads the preview: circle gone |
| A1 | 6 | Rejoin outcomes, notices, cooldown bypass, collapse-loading handling, stale-fix guard, preview-only outcome code, `collapseFlow.rejoinSucceeded` | `WalkPlannerApp.tsx` (`runLocalRejoin`, `onBack`), `useCollapseFlow.ts`, `walk-copy.ts` (he and en strings) | the six tests in item 6, red first |
| A2 | 7 | Satellite-aware walked colours, core plus casing | `route-colors.ts`, `GoogleMapView.tsx`, `MapView.tsx`, `globals.css`, `tests/design-tokens.test.ts` | contrast test; three-way screenshot for Ariel |
| A3 | 1 | `HeadingSmoother`, thread `headingDeg`, brand walker marker with cone (Google and Leaflet), simulator heading | `heading-smoother.ts` (new), `locate.ts`, `walk-tracker.ts`, `simulated-walk-tracker.ts`, `WalkPlannerApp.tsx` (one state and one prop), `MapView.tsx`, `GoogleMarkers.tsx`, `CurrentPositionMarker.tsx` | smoother, locate, marker, simulated turn tests |
| A4 | 2 | `hold(ms)` in `useFollowPause`, third "whole route" glyph, shared fit logic in both views; Leaflet honours `fitPath` | `useFollowPause.ts`, `MapGlyphs.tsx`, `GoogleMapView.tsx`, `MapView.tsx` | follow-pause and glyph tests; phone screenshot with the route fitted |
| A5 | 4 | Optional: restyle the credit (text line, less weight), keep exact wording always visible; add the wording test | `MapCredits.tsx` | wording-in-DOM test |

Order: A0 (any time), A1, A2, A3, A4, A5. A2 and A4 touch the map views, so do A2 first.

### Batch B: icon set (5)

| Task | What | Files |
|---|---|---|
| B1 | Create `ui/icons.tsx` with the full set (grammar above), contact-sheet script and shots; **stop for Ariel's approval** | `src/components/ui/icons.tsx`, `scripts/icons-sheet.mjs`, `docs/design-brief/shots/r14/` |
| B2 | Tab bar and rail: new Plan and Walks icons, live dot on Walk; `TraikeMark` component replaces the three logo drawings | `shell/icons.tsx` to re-export, `TabBar.tsx`, `Rail.tsx`, `HomeView.tsx`, `AuthScreen.tsx`, `WalkHud.tsx`, `WalkPlannerApp.tsx` header |
| B3 | Chat: gear becomes sliders plus visible "Preferences / העדפות" label; mic, speaker, stop, attach, custom-walk SVGs | `AssistantChat.tsx`, `AssistantSettings.tsx` |
| B4 | Map glyphs (arrow, style, fit), remove the non-interactive "Traike" tag from the walk map, walk sheet End walk and Ask icons | `MapGlyphs.tsx`, `WalkHud.tsx`, `WalkChatBox.tsx` |
| B5 | Replace text glyphs (close, info, warn, check, star) | `MapCredits.tsx`, `DroppedStopsPanel.tsx`, `StandingFactsPanel.tsx`, `RecommendedLayer.tsx`, `GoogleRecommendedLayer.tsx`, `WalkPlannerApp.tsx:4970` |
| B6 | Delete dead code (`AccountIndicator`, `RefreshButton`), emoji-ban test | `components/auth/AccountIndicator.tsx`, `components/ui/RefreshButton.tsx`, `tests/icons.test.tsx` |

### Batch C: responsive tablet and desktop (8)

Do after A and B so layout work does not fight icon swaps.

| Task | What | Files |
|---|---|---|
| C1 | Page-width tokens, `.tk-page` and `.tk-grid-2` utilities, `responsive.spec.ts` skeleton and the screenshot matrix script | `globals.css`, `e2e/responsive.spec.ts`, `scripts/responsive-shots.mjs` |
| C2 | Plan map strip: fit to route on build, paper tag, 32 percent height, one "Full map" entry | `WalkPlannerApp.tsx` (`:1225`, `:4798`, `:4848-4909`), `plan-copy.ts` |
| C3 | Live Walk desktop floating panel (400 px, start side); tablet `max-w-[560px]` | `WalkSheet.tsx`, `WalkHud.tsx` |
| C4 | Home two-column at `lg`, tablet grid | `HomeView.tsx` |
| C5 | Walks, Friends, Me: tablet and desktop grids | `MeView.tsx`, `SocialView.tsx`, `ScreenBand.tsx`, `MyWalksPanel.tsx` |
| C6 | `AuthFrame` shared by login, signup, forgot, reset; desktop split layout | `AuthScreen.tsx`, `forgot-password/page.tsx`, `reset-password/page.tsx` |
| C7 | Pricing and privacy on the app type system and widths | `pricing/page.tsx`, `privacy/page.tsx` |
| C8 | Optional: planner two-pane at `@3xl` for tablet portrait (behind one constant) | `WalkPlannerApp.tsx` aside classes |

### Batch D: hero image (9)

| Task | What | Files |
|---|---|---|
| D1 | Asset-brief gate: scope, generation count, cost; Ariel approves the anchor frame | none (message to Ariel) |
| D2 | Generate wide day (and night) hero via `gpt-image-2`; save prompt and file | `scripts/gen-home-hero.mjs`, `public/images/traike/home-forest-wide.jpg`, `home-forest-wide-night.jpg`, `docs/design-brief/` |
| D3 | Wire wide images behind `md:`; phone `<Image>` untouched; wide layout from C4 | `HomeView.tsx` |
| D4 | Tests and screenshots (no upscale at 1920, phone identical, size budget) | `tests/home-view.test.tsx`, `e2e/responsive.spec.ts` |
| D5 | Only if Ariel asks: phone variant with the traveler forward, behind `?homebg=` | `HomeView.tsx` |

---

## Open questions for Ariel

1. Item 9 conflict: the phone Home image is approved, and he also wants the traveler more visible on phone. Keep phone untouched (default), or build a second variant to compare?
2. Walked trail colour: gold with dark edge, or cream with dark edge? (Three-way screenshot in A2.)
3. "Traike" tag on the Live Walk map: remove (recommended) or make it the Ask button?
4. The gear: relabel as "Preferences" in place, or move these defaults into Me?
5. Compass for "which way I face while standing still": not now, or yes with the iOS permission prompt?
6. Gemini: top up AI Studio credits if he wants design rounds from it again (currently HTTP 402).

## What could not be verified

- Item 6 on a real device (no repro by reading alone; the plan makes the next test self-explaining).
- Vercel toolbar setting values (only the env list was read; settings live in the dashboard).
- HeiGIT's current attribution page (the fetch returned only a stub); our recorded wording from 2026-10-26 is the reference.
- No image or Gemini generation was run beyond one capability check each.
