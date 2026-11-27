# Live-device follow-up: late first move, a plan-view dot that never updates, English in the Hebrew UI (2026-11-26)

Branch `feat/design-r13-port`, HEAD `e4480e3`. Read-only diagnosis; no repo code changed. This follows
`docs/DEVICE-MOVEMENT-PLAN-2026-11-25.md` (commits `c48e1a3..e4480e3`).

Device facts measured on the owner's Galaxy Note 9 (Android 9, Samsung Internet 28 and Chrome, USB remote debugging):
- The watch delivers a fix about once a second, at 7-18 m accuracy.
- Lying still, `coords.speed` is exactly 0 (spd0 ~100%), and `coords.heading` is null.
- The screenshot of "the dot doesn't move" was taken in the **plan** view, not in a walk.

The harness (section 5) streams fixes through the **real** `src/lib/walk/dot-stabilizer.ts`. The "after" numbers come from a scratch prototype of section 1.3, run against the same generators. Seeds 1-12, except where a row says otherwise.

---

## (a) Item 3: in a walk with null (or 0) speed, the dot is held for 30-35 s

### Root cause (file:line), reproduced

The device trace reproduces exactly in the harness. The walker lies still with Doppler exactly 0, then walks 1.4 m/s with ±3 m jitter at 9 m accuracy, speed null. The harness sees the same sequence as the phone: `stop/hold`, then a brief `unsure`, then `nodop hold`, escape 1, and finally trend:

```
t=0..7   st stopped   hold   (raw>dot grows 1→10 m)        ← stale Doppler-0 window
t=8..9   st unsure    follow (one 10-12 m jump onto raw)    ← 1-2 leftover readings
t=10..21 st nodoppler hold   raw>dot 6→19 m, esc 0          ← 15 m radius
t=22     escape → mean of 3 candidates (dot 2 m behind raw), esc 1
t=23..32 hold again, raw>dot 4→17 m
t=33     escape 2 is "consistent" → trend; from here pub +1/s   (seeds 2/3: trend at 36/33 s)
```

Five causes add up to that 30-35 s:

1. **Stale Doppler keeps the state "stopped" for about 8 s.** `stateAt()` (`dot-stabilizer.ts:142-150`) keeps readings for `STOP_WINDOW_MS = 10 s` (`:28`). The walk's first fixes carry no speed, so the 3+ old exact-0 readings still give `stopped` (`:147`). `noSpeedWhileStopped` (`:213`) then refuses every speedless fix as an escape candidate, however far it lands.
2. **One spurious jump, then a fresh hold.** Once only 1-2 old readings are left, the state is `unsure` (`:149`), and `:179-186` follows the raw fix (one 10-12 m jump). As soon as the window empties, the state is `nodoppler`, and `:206-209` starts a new hold on that raw fix.
3. **The radius is 15 m even for 9 m fixes.** `:211` uses `max(DOT_ESCAPE_MIN_M = 15, min(acc, 25))` (`walk-cadence.ts:105`). That is 11 s of walking at 1.4 m/s. The escape then needs 2 fixes ≥ 2 s apart (`:218-219`), which at 1 Hz means 3 fixes.
4. **The first escape can never start trend at 1 Hz.** `advancing` (`:228`) needs the candidates to advance `max(DOT_PROGRESS_MIN_M = 8, 0.6 m/s × span)` along the escape, inside a 2 s span. At walking speed that is 2.8 m, not 8 m. Only a **second** escape (`consistent`, `:231-234`) starts trend, and that costs another 15 m + 2 s.
5. **Each escape lands behind the walker.** It moves the dot to the mean of the candidates (`:247`).

The plan's 7-16 s estimate covered B4: null speed from the first fix, and drift while standing. It measured the first escape, not the start of continuous follow. The stale-zero carry-over (causes 1-2) is new in this trace.

### Why "≤ 5-8 s and never moves while standing" is only partly achievable

Position-only, the question is whether a standing phone's own fixes travel as far in 5-8 s as a walker does (7-11 m).
- **A clean phone:** ±3 m jitter, or slow drift (AR σ 3-4 m, τ 30-60 s). Its fixes travel 3-4 m in 8 s, so a 6-8 m radius separates standing from walking.
- **The harness's B3/B4 standing model:** σ 5 m, τ 15 s. It wanders about 2.5 m every second, which is faster than walking pace. Independent ±5-8 m jitter behaves the same way. No position rule can start in under 8 s on such a phone without also moving the dot while it stands. Only a motion sensor could (decision 2).

So the fix measures the phone's own standing noise and picks the radius from it. A clean phone gets a fast start. A noisy phone automatically keeps the current (slow) rules, and the B3 bar stays green.

### The smallest fix (prototype in the scratch harness)

All changes are in `dot-stabilizer.ts`, plus constants in `walk-cadence.ts`. Nothing changes for real (non-zero) Doppler.

1. **Stale zeros say nothing.** In `stateAt`, after the `dop.length === 0` line (`:148`), add: if every reading is exactly 0 and none is in the live window (3 s), return `"nodoppler"`. This removes the `unsure` jump.
2. **Exact-0 does not veto a speedless good fix.** In `:213`, `noSpeedWhileStopped` applies only when the readings are not all exactly 0. A real GNSS Doppler (0.05-0.3) still vetoes it, which is the S3 guard test.
3. **Fast start lane.** It applies in `nodoppler`, or in `stopped` where every reading is exactly 0 ("weak"), on fixes with accuracy ≤ 20 m, while holding.
   - Keep a buffer `fast` of those fixes (the last 40 s), and `holdSince`, the timestamp the hold began.
   - **base** = buffer fixes since `holdSince`, in the last 20 s, older than 3 s. It needs ≥ 5 fixes. **anchor** = mean(base).
   - **scale** = RMS distance between pairs of hold fixes 8 s ± 0.5 s apart, from the last 40 s since `holdSince` and older than 3 s. It needs ≥ 8 pairs. This is how far this phone's own standing fixes travel in 8 s, jitter and drift together.
   - If `2 × scale > 15 m`, there is no fast lane. Fall through to today's rules.
   - Otherwise **R** = `max(6, 2 × scale)`.
   - **Trigger.**
     - The last 3 good fixes are all within 3 s.
     - Their mean is ≥ R from the anchor.
     - Each one projects ≥ 0.7 R along anchor→mean.
     - The last projects no less than the first.
   - **On trigger:**
     - `trend = true`, `trendSince = ts`, and store the anchor and R.
     - If the state was weak `stopped`, call `contradict(ts)`. Doppler then stops being trusted, so the engine strips the zeros (existing glue).
     - Publish the raw fix with mode `"trend"`.
4. **Young-trend exit.** In the trend branch (`:189`), while `ts - trendSince < 20 s` and the trend came from the fast lane, do **not** run the 20 s stall check (`:191`). That check compares against fixes from before the walk started and would kill a 6 s-old trend.
   - Instead, exit when the mean of the last 3 good fixes is closer than `R − 2 + 0.7 m/s × age` to the anchor (a false start that does not keep going).
   - On exit, hold at that mean and set `holdSince = ts`.
   - Also set `holdSince = ts` at the existing hold entries (`:195-196`, `:206-209`).
5. **Speed with no lag.** While `trend`, `positionSpeed()` (`:116-122`) returns the least-squares velocity of the last 10 s of `hist` (needs ≥ 4 fixes), instead of the 20 s progress. `pickShownSpeed` (`walk-stats.ts:43-52`) gets a `trending` argument: when Doppler is not trusted-live and the stabilizer is trending, it returns `position` before `sustained`. That is the caller at `WalkPlannerApp.tsx:873-879`.

New constants (`walk-cadence.ts`):

| constant | value |
|---|---|
| `DOT_FAST_MAX_ACCURACY_M` | 20 |
| `DOT_FAST_RADIUS_MIN_M` | 6 |
| `DOT_FAST_RADIUS_MAX_M` | 15 |
| `DOT_FAST_SCALE_K` | 2 |
| `DOT_FAST_LAG_MS` | 8_000 (±500) |
| `DOT_FAST_NOISE_WINDOW_MS` | 40_000 |
| `DOT_FAST_BASE_WINDOW_MS` | 20_000 |
| `DOT_FAST_FRESH_MS` | 3_000 |
| `DOT_FAST_CONFIRM_FIXES` | 3 |
| `DOT_FAST_MIN_BASE` | 5 |
| `DOT_FAST_MIN_PAIRS` | 8 |
| `DOT_FAST_KEEP_MPS` | 0.7 |
| `DOT_FAST_KEEP_MARGIN_M` | 2 |
| `DOT_FAST_YOUNG_MS` | 20_000 |

**Tried and rejected:**
- A fixed radius (scatter × 2.5): it triggers 1-6 times per 270 s on B3/B4 standing (up to 79 m/min).
- A "wander" gate: it slows R00 to 16 s.
- A ±2.5 s lag band: B3 standing seed 3 trips once, and the repo bar fails.

### Before → after (12 seeds; first move = dot ≥ 5 m along the walk; lag = truth − dot along the walk)

Walking: stand 30 s, then walk 1.4 m/s for 90 s. "repro" is the device trace.

| scenario | before: first move s | before: lag @10 s / @20 s | before: lag p90 | after: first move s | after: lag @10 s / @20 s | after: lag p90 |
|---|---|---|---|---|---|---|
| **repro**: still, Doppler 0 → walk null, acc 9, ±3 m (trend starts at) | 8 (jump), trend 33-36 | 1 / **15** m | 12-15 | **4-8**, trend 4-8 | 0 / -1 m | 3 |
| good GPS, null speed (acc 7-12, ±3 m) | 10-15 | 15 / 13 | 6-14 | **5-11** (median 8) | 0 / -1 | 3 |
| good GPS, speed 0 walking (acc 7-12, ±3 m) | 15-17 | 14 / -1 | 3 | **5-11** (median 8) | 0 / -1 | 3 |
| realistic drift (AR σ4 τ60, acc 7-18), null | 10-18 | 11 / 9 | 8-21 | **4-9** | -1 / 1 | 2-9 |
| same, speed 0 | 13-18 | 13 / 1 | 3-11 | **4-10** | -1 / 1 | 2-9 |
| same, 0 → null | 8 (jump) / 8-24 | 1 / 15 | 8-20 | **4-10** | -1 / 1 | 2-9 |
| ±5 m jitter, null (fast lane self-disables) | 10-18 | 14 / 12 | 5-15 | 10-18 | 13 / 5 | 4-15 |
| ±8 m jitter, null / 0 (self-disables) | 5-21 / 7-20 | | 8-17 | unchanged | | |
| harness B1, B2, C1, C2 (real Doppler / urban) | unchanged | | | unchanged | | |
| harness B3 / B4 (σ5 τ15) | 6-23 / 5-22 | | 6-24 | unchanged (lane off) | | |
| **Tab S6 network-only** A / A0 | 15-42 / 7-35 | | 15-37 / 7-33 | **unchanged** (fixes > 20 m never use the lane) | | |

Standing 300 s, dot path from 30 s on:

| scenario | before: m/min, moves/min | after: m/min, moves/min | after: fast-lane false starts |
|---|---|---|---|
| ±3 m, acc 10, speed null / 0 | 0, 0 / 0, 0 | 0, 0 / 0, 0 | 0 |
| ±5 m, null / 0 | 0 / 0 | 0 / 0 | 0 |
| ±8 m, null / 0 | 0-3.2 / 0-2.4 | same | 0 |
| drift σ4 τ60, null / 0 | 0-3.9 / 0-2.3 (≤ 0.2 moves/min) | 0-3.9 / 0-4.6 (≤ 0.9 moves/min) | 0-1 |
| drift σ3 τ30, null / 0 | 0 / 0-2.2 | 0-4.4 / 0-4.0 (≤ 1.1 moves/min) | 0-1 |
| harness B1 / B2 / B3 / B4 | 0-3.7 / 0-14.4 / 0-17.9 / 0-25.4 | identical | 0 |
| Tab S6 A / A0 | 0 / 27-56 | identical | 0 |

Speed cell (Doppler null or 0; LiveSpeed + SpeedEstimator + `pickShownSpeed`; truth 5.0 km/h; seeds 1/2/3):

| | +10 s | +15 s | +20 s | +30 s |
|---|---|---|---|---|
| before, null speed | 0.0-1.6 | 1.5-2.0 | 2.4-2.9 | 4.0-4.4 |
| before, speed 0 | עצירה | עצירה | **0.0** | 2.5-3.3 |
| after (both) | **4.9-5.8** | 4.7-5.3 | 5.1-5.7 | 4.3-5.5 |

**Repo bars on the prototype:** all 35 tests in `tests/dot-stabilizer.test.ts` and `tests/dot-stabilizer-devices.test.ts` pass, with no bar changed. That includes S1/S3/S4, W1/W2, B1-B3 standing with 0 contradictions, the "a fix without speed never moves the dot while Doppler says standing" guard, and the positionSpeed test.

**Honest limits:**
- **A clean phone that wanders.** It can now false-start at most about once per minute in the worst seed. It then makes one short trend publish and one recentre, under 5 m/min. Before, that was ≤ 0.2 moves/min.
- **±5-8 m per-second jitter, and B3/B4-type wander.** These keep today's 10-20 s start. There the speed condition contradicts "never move while standing" (see decision 2).
- **The dot shakes in trend.** It follows raw fixes (±3 m back and forth), as a good-Doppler phone already does today.

Seen in passing, not fixed here: on a Doppler 0 → null switch, `TrailFilter.accept`'s `providerSwitch` (`trail-filter.ts:137-144`) treats the first ~10 s of speedless fixes as another provider. No trail is drawn and the live tail is off until the share drops below 50%. On the phone this only happens with the CDP override, unless the Note 9 really drops speed while walking.

---

## (b) Item 2: the plan-view dot never follows

**Cause.** The plan map's dot is `currentPosition` (`WalkPlannerApp.tsx:5656`). In plan mode it is set once, as the walk's origin: `onSetOrigin` at `:4822-4825` and `onLocationDetected` at `:5048-5051`. Those come from `locate({ purpose: "start" })` in `StartLocationPicker.tsx:102` and `WalkCompanionPanel.tsx:335`.
- `locate.ts:212` clears the watch on the **first** fix ≤ 50 m of **any** kind. That includes the quick `getCurrentPosition`, which is `enableHighAccuracy: false` and may be cached for up to 2 min (`:256`, `COARSE_MAX_AGE_MS`).
- That matches the debug line `rx 2 (w0 q2 r0) … age 60.9s`: two quick reads, one of them a 61 s old cached position. The high-accuracy watch was cleared before it delivered a single fix.
- `START_WATCH_CAP_MS` (`:67`, `:347`) ends any watch after 25 s anyway.

**Recommendation (smallest change):**

1. **A quick fix never ends the start watch.**
   - Change `locate.ts:212` to `if (purpose === "start" && kind === "watch" && fix.source === "gps" && fix.accuracyMeters <= GOOD_ACCURACY_M) clearWatch();`.
   - Every "my location" start is then a fresh high-accuracy fix, not a 1-2 min old cached one.
   - Test in `tests/locate.test.ts`: a quick fix at 20 m keeps the watch, and the first watch fix ≤ 50 m clears it.
2. **A "follow" purpose for a visible map.**
   - Add `LocatePurpose = "start" | "walk" | "follow"`.
   - `follow` is `start` without the clear on a good fix (`:212`), without the 25 s cap (`:347`), and without the IP fallback (`:261`, `:350`).
   - It keeps the "improving only" filter off (`:207`), like a walk.
   - Test: after a good watch fix the watch is still active, and `stop()` clears it.
3. **Wiring in `WalkPlannerApp`.**
   - Add a small hook `useFollowHere({ enabled, onDot })`.
   - It runs `locate({ purpose: "follow" })` only while all of these hold:
     - `!walkMode`
     - the Plan screen is shown
     - the map is shown (`!planMapHidden`, `:4482`)
     - `document.visibilityState === "visible"`
     - **the origin is "my location"** (an `originIsHereRef`):
       - set true by the picker's GPS pick and by `onLocationDetected`;
       - set false by a map tap (`:4006`), an address pick, or `build.origin` (`:4867`).
   - It stops on `visibilitychange` → hidden, and starts again on visible.
   - Fixes go through a **separate** `new DotStabilizer()` (reset on each start), so standing jitter holds exactly as in a walk.
   - On `publish`, at most once per second, call `setCurrentPosition(coords)`. Do **not** call `focusOn`: the camera does not jump, as in Google Maps.
   - The planned route is not rebuilt. The chat's next request starts from the new spot (`origin={currentPosition…}`, `:4807`). That is right for "start from my location".
4. **Battery.**
   - A high-accuracy watch costs about what Google Maps costs in the foreground: GNSS stays on while the page is visible.
   - It stops when the tab hides, when the Plan screen is left, when the map collapses, and when a walk starts (the walk tracker takes over).
   - Optional: stop after 10 min with less than 30 m of movement, and resume on any map touch (decision 3).

**Acceptance.**
- In a jsdom test with a mocked geolocation, the plan map's dot follows 1 Hz fixes walking 1.4 m/s within 8 s and holds on ±3 m standing jitter.
- No `watchPosition` is active after `visibilitychange` → hidden, or after switching to another tab.

---

## (c) Item 4: English in the Hebrew UI

The mechanism: `uiLang` (`WalkPlannerApp.tsx:2402`), passed down as `lang="he" | "en"`. Each component has its own copy object `{ en: {...}, he: {...} }` (pattern: `PLAN_COPY` in `src/components/route/plan-copy.ts`, and `locateCopy`).
- **Keep `en` as the default value of every new `lang` prop.** Existing tests read the English text (for example `tests/dropped-stops-panel.test.tsx:63`).
- Wording follows the minimal-design rule: no hint paragraphs; the hint sentences below are dropped in Hebrew.

### Plan screen (reported by the owner)

| file:line | English | Hebrew |
|---|---|---|
| `route/WalkPlanResults.tsx:56` | Your Walk Plan | המסלול שלך |
| `:58` | {n} min total | {n} דק׳ בסך הכול |
| `:59` | {n} min walking | {n} דק׳ הליכה |
| `:59`, `:82` and `lib/utils/geo.ts:104-115` `formatDistance` | `m` / `km` / Unknown distance | מ׳ / ק״מ / מרחק לא ידוע (add a `lang` argument) |
| `:77` | {n} min visit | {n} דק׳ ביקור |
| `:82` | · {n} min walk · | · {n} דק׳ הליכה · |
| `:97` / `:101` / `:105` | Walking time / Visit time / Total; values "{n} min" | זמן הליכה / זמן ביקורים / סה״כ; "{n} דק׳" |
| `:114` | Didn't fit in time budget: | לא נכנסו בזמן: |
| `:36-39` | No attractions found in this area for your time budget. Try increasing… | לא מצאנו מקומות שמתאימים לזמן שלך. |
| `planner/WalkPlannerApp.tsx:5073` | Saved for later / Save for later | נשמר להמשך / שמירה להמשך |
| `:5236` | Simulate this walk (10× speed) | הדמיית הליכה (פי 10) |
| `:5193` | No attractions fit your time budget. | אין עצירות שנכנסות בזמן. |
| `:5194` | Only {a} of {b} attractions fit — expand time or radius? | רק {a} מתוך {b} עצירות נכנסו |
| `:5206` | + 15 min and retry | ‎+15 דק׳ ולנסות שוב |
| `:293` | That took longer than we could wait. Try a smaller search radius or fewer stops. | זה לקח יותר מדי זמן. נסו פחות עצירות. |
| `:1822` | The AI could not build a walk that fits. | לא הצלחנו לבנות הליכה שמתאימה. |
| `:1867` | Failed to build walk plan. | בניית ההליכה נכשלה. |
| `:1959` | Network error. Please try again. | שגיאת רשת. נסו שוב. |
| `:3134` | Build a walk plan before starting live tracking. | קודם בונים מסלול. |
| `assistant/StartLocationPicker.tsx:120,141-144`, `lib/start-location.ts:22`, `shell/LocationChip.tsx:21` | "My last location", shown as "מתחילים מ: My last location" | Keep the string only as a **stored sentinel**: export `MY_LOCATION_LABEL` from `start-location.ts`. Display `t.myLocation` (המיקום שלי, `locate-copy.ts:34`) wherever `label === MY_LOCATION_LABEL` (the picker's `setLabel(saved.label)` at `:143`, and the chip's comparison). |

### Saved walk names and dates (Home "saved & recent", Walks tab)

| file:line | English | Hebrew |
|---|---|---|
| `lib/walks/walk-history.ts:61-66` `titleForWalk` | "{first} + {n} more, Nov 26"; "Walk, Nov 26" (`toLocaleDateString("en")`) | Add `lang`: "{first} ועוד {n} · 26 בנוב׳" and "הליכה · 26 בנוב׳" (`he-IL`). The caller is `WalkPlannerApp.tsx:1888` → `newWalkFromPlan(…, lang)`. |
| already stored rows (`shell/HomeView.tsx:358`, `walks/MyWalksPanel.tsx` title) | stored English auto-titles | At display: if `w.title === titleForWalk(w.stops, new Date(w.createdAt), "en")` (an untouched auto title), show `titleForWalk(…, lang)`. Otherwise show the walker's own title. |

### Walk screen

| file:line | English | Hebrew |
|---|---|---|
| `planner/WalkPlannerApp.tsx:4803` | Chat with Traike · re-plan (summary, visible while walking) | צ׳אט עם Traike · תכנון מחדש |
| `:3605` | GPS signal is weak right now. Waiting for the next location update... | אות ה-GPS חלש. ממתינים למיקום הבא… |
| `:3609` | Live tracking issue: {message} | בעיה במעקב: {message} |
| `walk/AttractionDistancesPanel.tsx` (needs a `lang` prop, passed at `WalkPlannerApp.tsx:5154`) `:68` | Attractions ahead | התחנות הבאות |
| `:71` | {d} of {n} stops | {d} מתוך {n} תחנות |
| `:80` | aria "{d} of {n} stops done" | "{d} מתוך {n} תחנות הושלמו" |
| `:94` | Hide/Show {d} done stop(s) | הסתרת/הצגת {d} שהושלמו |
| `:139-140` | aria "Confirm skipping pinned {x}" / "Skip {x}" | "לאשר דילוג על {x}" / "דילוג על {x}" |
| `:144` | Skip pinned? / Skip | לדלג על נעוצה? / דילוג |
| `:152-153` | aria "Unpin {x}" / "Pin {x}" | "ביטול נעיצה {x}" / "נעיצה {x}" |
| `:173` | passed (+ `formatDistance` units) | עברנו |
| `walk/DroppedStopsPanel.tsx` (needs a `lang` prop, passed at `WalkPlannerApp.tsx:4966`) `:38` | Dropped from your walk | ירדו מההליכה |
| `:43` | aria "Dismiss dropped stops" | "סגירה" |
| `:61` | Behind you now — you'd have to turn back | כבר מאחוריך |
| `:62` | Didn't fit the time you have left | לא נכנס בזמן שנשאר |
| `:67` | aria "Put {x} back in the walk" | "להחזיר את {x} להליכה" |
| `walk/WalkFinishCard.tsx:75` | {km} km | {km} ק״מ (via `t.km`) |
| `map/WalkerMarker.tsx:86,126` | aria "Your position" | "המיקום שלך" |
| `:5135`, `:5139` | GPX/CSV file name "My Walk" | "ההליכה-שלי" |

### Walks tab (`walks/MyWalksPanel.tsx`; `lang` prop exists, strings are raw)

| line | English | Hebrew |
|---|---|---|
| `:114` | That is too short to get by dropping stops: ask the assistant… | קצר מדי. בקשו מהעוזר הליכה חדשה. |
| `:126` | Allow your location to start the walk from here. | אפשרו מיקום כדי להתחיל מכאן. |
| `:191` | Last walked {date} · {n}× | הליכה אחרונה {date} · {n}× |
| `:206`, `:313` | Making that version… | מכינים גרסה… |
| `:226` | Hide from map / Show on map | הסתרה מהמפה / הצגה במפה |
| `:231` | Hide runs / Earlier runs | הסתרת הליכות / הליכות קודמות |
| `:235` | Shared with friends / Private | משותף עם חברים / פרטי |
| `:258` | {m} min | {m} דק׳ |
| `:300` | My walks | ההליכות שלי |
| `:312` | Loading… | טוען… |
| `:315` | Couldn't load your walks / Check your connection… | לא הצלחנו לטעון / (drop the hint) |
| `:321` | Build one and it shows up here. | (drop the hint) |
| `:195`, `:247`, `:255`, `:274`, `:286`, `:303`, `:333` | aria-labels | Hebrew equivalents |

### Lower priority

- **Advanced planner and desktop tooltips:**
  - `WalkPlannerApp.tsx:4636` and `:5491` (`title`)
  - `:4646` Planning mode
  - `:4683` Map click mode
  - `:4024` Custom Start / End
  - `:4596` alt "Traike walking guide"
  - `PlannerFrame.tsx:158-159`
  - `GoogleMarkers.tsx:102`
- **`WalkCompanionPanel.tsx:93-97,122`** (pace and category option labels): translate if that panel is reachable in the redesigned Plan screen. Verify on the phone.
- **Leave in English:** the simulator debug strip (`:5253-5330`, only with simulate on), the map attribution (`:5363`), and AI-bound prompt text (`AssistantChat.tsx:279-291`).

Not causes: `PaceConfirmationNotification`, `DeviationConfirmationNotification` and `OffRouteNotification` are not rendered by `WalkPlannerApp`.

---

## (d) Commits for the Sonnet builder (each test first, small)

1. **`test: fast-start fixtures + failing bars`.**
   - Add `genStill(seed, { standS, walkS, acc:[lo,hi], noise: {uniform a} | {ar σ τ white}, standScale, speedStand, speedWalk })` to `tests/helpers/device-fixes.ts` (port of `scratchpad/followup/gen.ts`).
   - New `tests/dot-stabilizer-fast-start.test.ts`, seeds 1-6. Failing today:
     - repro (still Doppler 0 → walk null, acc 9, ±3, stand ×0.3): first move ≥ 5 m ≤ 8 s, `trending` by 8 s, lag @20 s ≤ 5 m.
     - good GPS null and good GPS 0 (acc 7-12, ±3): first move ≤ 11 s, median ≤ 8 s.
     - drift σ4 τ60 null / 0: first move ≤ 10 s.
   - Standing bars that must stay green:
     - ±3/±5/±8, null and 0: ≤ 3.5 m/min, fast starts 0.
     - drift σ4 τ60 and σ3 τ30, null and 0: ≤ 5 m/min, ≤ 1.2 moves/min.
   - Existing files unchanged.
2. **`fix(stabilizer): stale exact-0 Doppler is no Doppler; it does not veto speedless good fixes`.**
   - `dot-stabilizer.ts:148-149`, `:213`.
   - Test: 10 fixes of Doppler 0, then speedless fixes advancing 1.4 m/s. The state is never `unsure`, and no publish lands more than 3 m ahead of the raw fix.
3. **`feat(stabilizer): fast start lane with a noise-scaled radius + young-trend exit`.**
   - Section (a) points 3-4, with the constants in `walk-cadence.ts`.
   - Turns the commit-1 walking bars green, and all 35 existing tests stay green.
   - Guard test: B3/B4 standing seeds 1-6 make 0 fast starts (their 8 s noise scale is > 7.5 m, so the lane is off).
4. **`feat(speed): position speed from the last 10 s while trending; pickShownSpeed prefers it`.**
   - `dot-stabilizer.ts:116-122`, `walk-stats.ts:43-52`, `WalkPlannerApp.tsx:873-879`.
   - Test: the repro speed cell is 3.5-6.5 km/h at walk +10 s and +20 s, for null and for 0.
5. **`feat(gpsdebug): fast lane fields`.**
   - `fast y/n`, `R <m>`, `fst <count>`, in `gps-debug.ts` `dot()` and `formatGpsDebug`.
   - Test in `tests/gps-debug.test.ts`.
6. **`fix(locate): a quick fix never ends the start watch`.** `locate.ts:212` + `tests/locate.test.ts`.
7. **`feat(locate): follow purpose`.** `locate.ts:29,207,212,261,347,350` + test.
8. **`feat(plan): the my-location dot follows while the plan map is visible`.**
   - Section (b) point 3.
   - Test: a mocked watch at 1 Hz moves the dot within 8 s of walking and holds on jitter. No watch remains after visibility hidden or a tab switch. A map-tap origin does not start the watch.
9. **`i18n(plan): WalkPlanResults, save/simulate/retry/errors, my-location sentinel`.**
   - Test: render `WalkPlanResults` with `lang="he"` and assert no `/[A-Za-z]{3,}/` outside stop names.
   - Test: the picker with a saved sentinel shows "המיקום שלי".
10. **`i18n(walks): titleForWalk lang + display of untouched auto titles`.**
    - Extend `tests/walk-history.test.ts`: the he title is "A ועוד 1 · 24 באוק׳". The English expectations stay.
11. **`i18n(walk): AttractionDistancesPanel, DroppedStopsPanel, finish km, chat summary, tracking messages, marker aria`.**
    - Same no-Latin assertion with `lang="he"`.
12. **`i18n(walks tab): MyWalksPanel strings`.**

**Acceptance (builder self-check before "done"):**
- `npm test` is green, including all 35 existing dot-stabilizer tests unchanged.
- The new bars show the "after" numbers of section (a).
- `?gpsdebug=1` in a dev build with a CDP geolocation override (null speed, 1.4 m/s, ±3 m) shows `trend y` within 8 s.
- On the Plan screen with the map open, the dot follows the override within 8 s, and `rx w` keeps rising.
- With the UI in Hebrew, the Plan screen, Walk screen, Home and Walks show no English except place names.

### צ'קליסט לטלפון (Note 9, עם ‎?gpsdebug=1)

1. **מסך תכנון, מפה פתוחה, "מתחילים מ: המיקום שלי"** (לא "My last location"):
   - הולכים 20 מטר: הנקודה זזה תוך 5–8 שניות.
   - עומדים דקה: הנקודה לא זזה.
   - בשורת הדיבאג `rx w` עולה כל שנייה.
2. **הליכה (Start):** עומדים 30 שניות.
   - רושמים את `spd0` ואת `spd∅`.
   - `hold y` ו-`d60` ≤ 15 מ׳.
3. **הולכים בקו ישר 2 דקות:**
   - הנקודה זזה תוך 5–8 שניות, ו-`trend y` (או `st move` אם הטלפון מדווח מהירות).
   - המהירות מראה 4–6 קמ״ש תוך 10 שניות, לא "עצירה" ולא 0.
   - הקו הזהב מצטייר בלי קשקושים.
4. **עוצרים דקה:**
   - תוך 20 שניות `trend n`, ואז `hold y`.
   - המהירות חוזרת ל"עצירה".
5. **עברית:**
   - בתכנון: "המסלול שלך", "דק׳ בסך הכול", "שמירה להמשך".
   - בשמות מסלולים: "ועוד 1" ותאריך בעברית.
   - בהליכה: "התחנות הבאות".
   - אין מילים באנגלית חוץ משמות מקומות.

---

## Decisions (defaults in bold)

1. **Fast-lane radius.**
   - **k = 2 × the 8 s noise of the hold, min 6 m, off above 15 m (default).** Realistic phones start in 4-11 s (median ≤ 8). Noisy phones keep today's behaviour.
   - k = 1.8, min 5 m: starts about 1 s sooner, but standing drift goes up to 13 m/min.
2. **Phones whose standing fixes wander faster than walking pace** (±5-8 m every second, or B3/B4).
   - **Keep the current 10-20 s start (default).**
   - Later option: a step detector from `devicemotion` (Android needs no permission; on iOS it comes with the compass permission). It knows "walking" within about 2 s regardless of GPS. The catch: a CDP-override test on a phone lying on a desk would then (correctly) never move the dot.
3. **Plan-view follow watch.**
   - **On while the Plan map is visible and the start is "my location"; off when hidden (default).**
   - Optional: auto-pause after 10 min with under 30 m of movement.

## Harness

Scratch, outside the repo: `/private/tmp/claude-501/-Users-arielshorpacker-Documents-obs-vault-try/5c003174-ca44-44b7-a010-7afa6c52ccda/scratchpad/followup/` (it may be cleared on reboot; commit 1 ports what matters).

| file | what it does |
|---|---|
| `vitest.config.mjs` | aliases `@/lib/walk/dot-stabilizer` to the prototype when `PROTO=1` |
| `gen.ts` | generators |
| `trace.test.ts`, `trace-after.test.ts` | device repro traces, before and after |
| `compare.test.ts` | the tables above |
| `sweep.test.ts` | parameter sweeps |
| `speed.test.ts` | the speed-cell table |
| `dot-stabilizer-proto.ts` | the prototype (`P` holds the chosen values) |
| `scan.py` | the English-string scanner |

Run them from the repo root:

```
INC=<scratch>/compare.test.ts ./node_modules/.bin/vitest run --config <scratch>/vitest.config.mjs --silent=false --reporter=verbose
```

Use `PROTO=1 INC=tests/dot-stabilizer.test.ts,tests/dot-stabilizer-devices.test.ts …` to run the repo's own bars on the prototype.
