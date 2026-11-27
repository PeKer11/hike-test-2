# Device movement plan: the dot does not move on Galaxy Tab S6 / Note 9 (2026-11-25)

Branch `feat/design-r13-port`, HEAD `8c97a7e`. Read-only diagnosis; no repo code changed.

Report: on a Galaxy Tab S6 and a Galaxy Note 9 (Chrome, Android), the dot, map and stats do not move when the walker walks ("כשזזים זה לא זז"). On his other phone it moved, with some lag.

## 1. Root causes (file:line)

The other phone is the control (B1 below): GPS at 5-12 m with a real Doppler speed. Every path through the pipeline works for it. The two Samsung devices fail in three ways. Each way makes the pipeline decide "standing" or "don't trust this", and that holds the dot and freezes the stats.

### RC1: network-only fixes (Tab S6: no GNSS fix, Wi-Fi/cell only, 30-150 m, no speed)

1. **The dot holds from the second fix on.** `dot-stabilizer.ts:91` returns `nodoppler` when no fix carries a speed. Then `:103-113` switches to hold.
2. **To escape, the walker has to cover the fix's whole accuracy.** `dot-stabilizer.ts:114`: `radius = max(15, accuracyM)`. A network accuracy of 60-150 m means 60-150 m of walking before the dot moves at all. `:121-122` then also needs 3 agreeing fixes over at least 3 s, and network fixes come every 2-10 s. Network accuracy is mostly bias (which access points the phone sees), not scatter. A held point's own fixes move far less than the accuracy says.
3. **Fixes worse than 50 m never reach the engine.** `WalkPlannerApp.tsx:3269` (`if (update.accuracyMeters > ENGINE_MAX_ACCURACY_M) return;`, `walk-cadence.ts:17`). On those fixes nothing updates: `latestPaceUpdateRef`, the stats clock, `matchedRef`, the walked distance or the speed. The engine saw only 22-69% of the tablet's fixes. `speed-estimator.ts:51` also drops every fix worse than 35 m. With no Doppler, `LiveSpeed` is `unknown` (`live-speed.ts:29`), so the speed cell is empty or stale.
4. **If the network fixes report speed 0** (A0), `live-speed.ts:39-50` records the 0 and says paused. The cell shows עצירה / 0 km/h for the whole walk. `walk-stats.ts:40-43` (`steadyWalkedM`) then holds the walked distance, because the state is paused.

### RC2: Doppler stuck at 0 while walking (Note 9 hypothesis: `coords.speed` = 0.0 on GNSS fixes)

1. **The phone looks like it is standing.** `dot-stabilizer.ts:90`: 3 readings with a median under 0.35 m/s → `stopped` → hold. To escape, `:121` needs **10 agreeing fixes over 10 s** beyond `max(15, acc)`. So the dot jumps 25-35 m about every 25 s.
2. **Recentre pulls the dot backwards.** `dot-stabilizer.ts:101` fills `good` with the fixes of the last 30 s, and `:132-139` slides the dot to their mean. While walking that mean is about 20 m behind the walker. In the trace (B3, seed 1) the dot went from 73 m back to 32 m at t = 90 s.
3. **No trail is drawn.** `trail-filter.ts:208` freezes the trail while Doppler says stopped: 0 m of trail over the whole walk.
4. **The speed cell says עצירה the whole walk.** `live-speed.ts:39-42` shows 0 km/h. The fallback is no better: `speed-estimator.ts:130` takes the Doppler median (0) before it looks at positions.
5. **The distance moves in big steps.** `walk-stats.ts:40-43` holds the walked distance while paused. `STEADY_MAX_JUMP_M = 60` (`walk-stats.ts:37`) then releases it in 61 m steps.

### RC3: GNSS with no Doppler at all (Note 9 hypothesis: `coords.speed` null), worse in poor urban fixes (25-60 m)

- **Same hold-and-escape loop as RC1** (`dot-stabilizer.ts:91/114/121`). The dot jumps 15-25 m about every 20 s. In urban fixes it is up to 38 m behind and its first move takes up to 46 s.
- **The fixes over 50 m** hit the engine gate (`WalkPlannerApp.tsx:3269`) and the 35 m `SpeedEstimator` gate. In 2 of 3 seeds the speed was `unknown`, and the distance stalled at 115 m of 252.

### Not causes (checked)

- **Doppler on only some fixes** (B2: 55% real, 25% null, 20% zero) works. The live median of the readings that are present says moving.
- **A good-GPS phone** (B1) works. That matches the other phone.
- **The tracker's 150 m gate** (`walk-tracker.ts:115-118`) dropped nothing in these scenarios. A tablet indoors can report more than 150 m, though. `trk-drop` on the debug line shows it.
- **`locate.ts` ordering and kinds** dropped nothing. The watch timestamps are monotonic.
- **`OffRouteGate`** (`deviation-detector.ts:170-171`) is only less sensitive while "stopped". It does not freeze anything.

### Device facts to confirm on the phones (hypotheses, not verified here)

- **Tab S6.** It may have a GNSS receiver, but without a SIM it has no assisted GPS. Indoors, near buildings or in a bag, Chrome's fused provider then serves Wi-Fi fixes, often for minutes. The harness treats that as network-only. If the tablet does get GNSS, it falls under B1/B4.
- **Note 9.** Whether Chrome reports speed `0`, `null`, or a real value while walking decides between RC2 and RC3. The new debug fields in commit 7 answer this in one walk.

## 2. Harness

A scratch harness outside the repo, run with the repo's vitest and the `@` alias. It streams fixes through the **real modules**: `WalkTracker.handleFix`, `TrailFilter` (dotHeld, accept, tailAllowed, withLiveTail), `DotStabilizer`, `LiveSpeed`, `SpeedEstimator`, `detectDeviation`, `progressAlong` and `steadyWalkedM`. The glue copies `WalkPlannerApp.tsx` 3225-3350 and `refreshWalkStats` 854-908, including the 500 ms publish gate, the 50 m engine gate and the 5 s tick.

- **Route and walk.** A straight route. The walker stands 20 s, then walks 1.4 m/s for 180 s (252 m). There is also a 200 s standing variant. Seeds 1-3.
- **Noise model.** GNSS noise is AR(1)-correlated drift. Wi-Fi fixes are the weighted centroid of the 3 nearest access points (one every 20-40 m, up to 35 m off the street), plus 4 m noise. Network accuracy steps through 30/40/60/90/150 m.

| id | device class |
|---|---|
| A | Tab S6 network-only: 30-150 m stepwise, every 2-10 s, speed null, heading null |
| A0 | the same, but speed reported 0 |
| B1 | control (the other phone): GPS 5-12 m, 1 s, real Doppler |
| B2 | Note 9 GPS 8-25 m, Doppler 55% real / 25% null / 20% zero |
| B3 | Note 9 GPS 8-25 m, Doppler always 0 |
| B4 | Note 9 GPS 8-25 m, Doppler always null |
| C1 | Note 9 poor urban 25-60 m, every 1-3 s, Doppler 70% |
| C2 | Note 9 poor urban 25-60 m, every 1-3 s, no Doppler |

### Walking, before → after (seeds 1/2/3 or range)

"After" is the prototype of section 3: the stabilizer changes plus the WalkPlannerApp glue.

| id | | first move s | dot lag p50 / p90 m | longest frozen s | trail m | walked m (truth 252) | speed cell "moving" % | km/h median |
|---|---|---|---|---|---|---|---|---|
| A | before | 24/52/61 | 36-61 / 56-89 | 46-62 | 121-179 | 200/224/138 | 0-64 | 7.3/7.0/- |
| | after | 21/33/37 | 12-14 / 30-44 | 26-36 | 121-177 | 268/224/264 | 71-91 | 7.0/5.9/5.5 |
| A0 | before | 7/7/18 | 12-14 / 23-34 | 19-23 | 121-175 | 200/224/138 | **0-12** | **0.0** |
| | after | 7/7/18 | 12-14 / 30-44 | 26-36 | 121-177 | 268/224/264 | 71-90 | 7.0/5.9/5.5 |
| B1 | before = after | 4-9 | 1-2 / 3-5 | 1 | 252-266 | 263-273 | 100 | 5.0-5.1 |
| B2 | before = after | 5-6 | 2-3 / 6-8 | 1-4 | 243-274 | 258-275 | 87-92 | 4.5-4.6 |
| B3 | before | 37/15/23 | 19-22 / 32-35 | 23-30 | **0** | 212/256/273 (61 m steps) | **0** | **0.0** |
| | after | 16/14/16 | 2-3 / 6-19 | 7-18 | 258-271 | 267/258/275 | 100 | 4.5-5.0 |
| B4 | before | 17/8/17 | 12-14 / 23-24 | 21-26 | 251-277 | 258-275 | 74-100 | 4.2-5.0 |
| | after | 16/7/16 | 2-3 / 6-10 | 8-25 | 259-279 | 258-275 | 100 | 4.5-5.0 |
| C1 | before | 4/8/20 | 5-10 / 11-17 | 2 | 24-297 | 270/282/**48** | 0-89 | 5.0/5.5/- |
| | after | 4/8/20 | 5-10 / 11-17 | 2 | 24-297 | 270/282/261 | 100 | 5.0-5.7 |
| C2 | before | 30/22/46 | 19-38 / 36-62 | 31-43 | 99-288 | 277/**115**/202 | 0-93 | 5.2/-/- |
| | after | 15/13/36 | 6-9 / 16-20 | 14-25 | 99-301 | 277/266/238 | 70-100 | 4.8-5.2 |

Notes:
- **A first move is still 21-37 s.** That is the honest floor with 30-150 m network fixes and a 25 m radius: 25 m takes 18 s at 1.4 m/s, plus the 2-10 s between fixes. After that the dot follows continuously (trend mode), so the longest freeze halves.
- **A and A0 km/h runs a little high** (5.5-7.0 against 5.0), from access-point snapping. That is why the cell gets an "≈" (commit 6).
- **A0 lag p90 grows a little** (23-34 → 30-44 m). The dot now follows the Wi-Fi fixes in trend mode instead of the raw "unsure" follow. Its p50 stays the same, and its speed, distance and freezes improve.

### Standing still, before → after (dot path m/min; what the stats say)

| id | before | after | note |
|---|---|---|---|
| A | 0 | 0 | the speed cell now says paused instead of unknown |
| A0 | 45-56 | 26-49 | 1 of 3 seeds contradicts Doppler once (harmless: the speed cell still ends paused) |
| B1 | 0 | 0 | unchanged: the good-GPS stability is kept |
| B2 | 0-4 | 0-4 | unchanged |
| B3 | 0-4 | 0-4 | 0 contradictions: a standing phone whose Doppler reads exactly 0 keeps holding |
| B4 | 0-6 | 0-20 | within the no-Doppler budget |
| C1 / C2 | 5-55 / 0-11 | 5-55 / 0-19 | |

### The repo's own bars (`tests/dot-stabilizer.test.ts`), on the prototype

- **Before:** S1 0-2 m/min (≤ 0.21 moves/min), S3 17-46, S4 48-82, W1 starts in 1 s with lag diff 0.00, W2 worst hold 4 s.
- **After:** S1 0-2 (≤ 0.21), S3 28-49, S4 68-100, W1 1 s / 0.00, W2 4 s. **Every bar still passes** (S1 ≤ 10, S3 ≤ 60, S4 ≤ 120, W1 ≤ 5 s, W2 ≤ 10 s).
- **Tried and rejected:** a 15 m no-Doppler radius cap. It cuts A's first move to 21-33 s but breaks S3 (38-82 m/min > 60).

## 3. The fix (what the prototype does)

The principle: positions are a second movement signal. When Doppler is missing, or says 0 while the fixes plainly travel, the displacement of the fixes decides. Stability on a phone with real Doppler is unchanged, because every new rule only acts where Doppler is absent or contradicted.

1. **No-Doppler radius cap.** `radius = max(15, min(accuracy, 25))` when the state is not Doppler-stopped. The escape needs **2** agreeing fixes over **≥ 2 s** (was 3 / 3 s). The Doppler-stopped rule stays at 10 / 10 s with `max(15, acc)`.
2. **Trend follow.** On an escape, enter trend mode when:
   - (a) this escape is within 60 s of the previous one and within 60° of its direction, or
   - (b) the escape's own candidates advance along it by at least `max(8 m, 0.6 m/s × span)`.

   In trend mode the dot follows every fix. It leaves trend mode, and holds at the mean of the last 5 s, when the mean of the last 5 s is less than 12 m from the mean of 15-25 s ago (no progress for about 20 s). Doppler `moving` or `unsure` still means plain follow, and trusted Doppler `stopped` still means hold.
3. **Doppler contradiction.** Doppler stops being trusted for 60 s, renewed while trend lasts, when either:
   - (a) the walker is in trend while Doppler says stopped, or
   - (b) every Doppler reading in the last 10 s is **exactly 0** and the fixes travelled **≥ 18 m** between the mean of the last 5 s and the mean of 15-25 s ago. A chip that really holds static also holds its position, so a standing phone does not trip this: 0 trips in B3 standing.

   While Doppler is not trusted, the stabilizer reads the state as `nodoppler`, recentre uses no fixes (it only collects them when Doppler is trusted), and `dopplerTrusted(ts)` is exposed.
4. **WalkPlannerApp glue.**
   - (a) When `!stab.dopplerTrusted(ts)`, `speedMps` is stripped from the update before the engine (`3269-3305`, `3342`). `LiveSpeed`, `SpeedEstimator` and `TrailFilter` then fall back to positions: the trail draws and the 0 km/h stops.
   - (b) The speed cell (`868`) becomes: trusted live → sustained → `stab.positionSpeed(now)`. That last one is the displacement over 20 s: moving in trend or follow at ≥ 0.7 m/s, paused while held.
   - (c) A stats lane for fixes worse than 50 m (`3269`). They update `latestPaceUpdateRef` and the clock. When the dot was published, `matchedRef` is set from the **shown dot's** projection, so the walked distance follows the dot. Trail, off-route, visits, discovery and pace remain engine-grade only (≤ 50 m).
5. **An honest indicator instead of a freeze.** While the median accuracy over the last 30 s is above 50 m, or the provider guess is `net`, the walk shows a chip: **"דיוק מיקום נמוך — המיקום משוער"** / "Low location accuracy, position is approximate". The speed cell gets an "≈". The halo already shows the accuracy.

## 4. Commits (each small, each test first)

The tests port the harness generators (A, A0, B1-B4, C1, C2) into `tests/helpers/device-fixes.ts`. All numbers use seeds 1-3.

1. **`test: device fix generators + failing movement bars`.** Add `tests/helpers/device-fixes.ts` and `tests/dot-stabilizer-devices.test.ts`. These bars fail today:
   - A: first move ≤ 40 s, lag p50 ≤ 16 m, longest freeze ≤ 40 s.
   - B3: first move ≤ 20 s, lag p50 ≤ 5 m.
   - B4: lag p50 ≤ 5 m.
   - C2: first move ≤ 40 s, lag p50 ≤ 10 m.
   - Standing B1/B2/B3: ≤ 5 m/min and 0 Doppler contradictions.
   - Every existing bar in `tests/dot-stabilizer.test.ts` stays as it is.
2. **`feat: no-Doppler escape radius capped at 25 m, 2 fixes over 2 s`.** `dot-stabilizer.ts:114,121`. New constants in `walk-cadence.ts`: `DOT_NODOP_RADIUS_CAP_M = 25`, `DOT_ESCAPE_FIXES_NODOP = 2`, `DOT_ESCAPE_SPAN_NODOP_MS = 2_000`. Test: a 15 m cap fails S3. Keep that test as a guard.
3. **`feat: trend follow on consistent escapes, stall exit`.** `DOT_TREND_PAIR_MS 60_000`, `DOT_TREND_MAX_TURN_DEG 60`, `DOT_TREND_STALL_MS 20_000`, `DOT_TREND_STALL_M 12`, `DOT_PROGRESS_MIN_M 8`, `DOT_PROGRESS_MIN_MPS 0.6`. Turns the A/B4/C2 bars green. S4 stays ≤ 120.
4. **`feat: Doppler contradiction (exact-0 + 18 m / 20 s, or advancing escape); recentre only on trusted Doppler`.** `dot-stabilizer.ts:90,101,132`. Adds `dopplerTrusted(ts)` and `positionSpeed(ts)`. Turns B3 green. B3 standing: 0 contradictions. Fixes the backwards recentre: a walking-with-Doppler-0 test asserts the shown dot never moves more than 5 m backwards along the walk.
5. **`fix: distrusted Doppler never reaches the engine; speed cell falls back to positions`.**
   - Extract a pure `pickShownSpeed({ live, sustained, position, dopplerTrusted })` into `walk-stats.ts`, unit-test it, then use it at `WalkPlannerApp.tsx:867-868`.
   - Strip `speedMps` at `3269` when it is not trusted.
   - Test in `tests/walk-planner-app.test.tsx` style: 120 fixes walking with speed 0 give a trail, and the speed cell is not עצירה.
6. **`fix: low-accuracy fixes keep the clock and the walked distance (on the shown dot)`.** `WalkPlannerApp.tsx:3269`: the stats lane. Test: 2 minutes of 60-90 m fixes walking → walked distance grows by at least 100 m, the off-route badge never fires, and visits are not recorded.
7. **`feat(gpsdebug): provider guess, null/zero rates, update interval, accuracy median, stabilizer mode`.**
   - Code: `gps-debug.ts` `received()` takes `headingDeg` (pass it from `locate.ts:180`). It keeps the last 30 watch intervals and accuracies.
   - New fields: `prov gps|net|mix` (`gps` = speed on ≥ 50% of fixes and accuracy median ≤ 25 m; `net` = speed on < 10% of fixes, or always exactly 0, with accuracy median ≥ 30 m; else `mix`), `spd∅ %`, `spd0 %`, `hdg∅ %`, `iv` (median s), `accMed`, `trend y/n`, `dopT y/n`, `contra N`.
   - Test: `formatGpsDebug` in `tests/gps-debug.test.ts`.
8. **`feat: low-accuracy chip and ≈ on the speed cell`.** Copy in `locate-copy.ts` (he/en). The chip shows while the accuracy median over 30 s is above 50 m or `prov` is `net`. Test: render with `lang="he"` and the Hebrew text; it is gone after 30 s of 10 m fixes.

Out of scope, seen in passing: with no Doppler, a standing phone still draws trail (B4 standing: 55-134 m in 200 s) and C1 standing wanders 5-55 m/min. Both are the trail filter's, not the dot's. Raise them separately.

## 5. Phone checklist (`?gpsdebug=1`)

**Tab S6**
1. Outdoors, start a walk and stand 30 s. Read `prov`, `spd∅`, `spd0`, `hdg∅`, `iv`, `accMed`.
   - `prov net`, `spd∅ ≈ 100%` (or `spd0 ≈ 100%`), `iv` 2-10 s, `accMed` ≥ 30: this is RC1. Expect the low-accuracy chip.
   - `prov gps`: the tablet got GNSS. Use the Note 9 list.
   - `trk-drop` climbing: fixes worse than 150 m. Note it.
2. Walk 3 minutes in a straight line.
   - The dot first moves within 40 s.
   - Then `trend y` and the dot follows continuously, at most 25-35 s behind.
   - The speed cell shows ≈ 4-7 km/h, not עצירה or empty. The walked distance grows.
3. Stand 1 minute.
   - `trend n` within 20-30 s, then `hold y`. The dot stops wandering (`d60` ≤ 120 m).

**Note 9**
1. Outdoors, stand 30 s.
   - `prov gps`, `accMed` 5-25. Record `spd0` / `spd∅`.
   - The dot holds (`hold y`, `d60` ≤ 15 m) and `contra 0`.
2. Walk 3 minutes and read `dop`.
   - `dop` ≈ 1.2-1.6: Doppler works. `st move` within 1-3 s. Not this bug.
   - `dop 0.0` all the time: RC2. Within 20 s `contra 1`, `dopT n`, `trend y`. The trail draws, and the speed is not עצירה.
   - `dop -` (`spd∅` high): RC3. `trend y` within about 20-30 s, then the dot follows. The speed comes from positions.
3. Stand again 1 minute.
   - `dopT y` returns within 60 s, then `st stop`, `hold y`, and the speed shows עצירה.
4. Urban street with tall buildings (`accMed` 25-60):
   - The dot moves within 40 s and the walked distance does not stall.
   - The chip shows only when `accMed` is above 50.

## 6. Decisions (defaults in bold)

1. **Exact-0 Doppler threshold: how far the fixes must travel in about 20 s before a Doppler of 0 is ignored.**
   - **18 m (default):** B3 first move 14-16 s. A standing phone never trips it (0 of 3 seeds).
   - 15 m: B3 first move 12-14 s, but 2 of 3 standing seeds trip it once. One of them then shows "moving" and 20 m/min of wander while standing.
   - 20 m: standing is just as clean, but one seed starts after 37 s.
2. **Fixes worse than 50 m and the stats.**
   - **They drive the walked distance and an "≈" speed from the shown dot (default).** A: distance 224-268 m of 252, and a speed cell that works.
   - Keep the stats blank on such fixes. Today that leaves the distance at 138-224 m and the speed cell empty most of the walk on the tablet.

   Either way they never drive the trail, off-route, visits or pace.
