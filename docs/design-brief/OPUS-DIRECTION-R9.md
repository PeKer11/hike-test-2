# Traike: design direction for round 9 (Opus, 2026-11-19)

Sources reviewed: OPUS-DIRECTION-R8.md; the ROUND 8 section of BRIEF.md; all round-8 output screenshots in gemini/r8/ (phone and desktop, day and night, EN and HE); shots/cur-*; shots/r6-phone-me (the loved header); and the real assets (city-hero-day/night, guide, guide-night, compass, boot, pin, empty-walks, theme thumbnails).
Every crop, colour stop and height below comes from Playwright test renders (390px phone and 440/964/1180px desktop, day and night, EN and HE). I sampled colours with PIL. Nothing here is a guess.

---

## 1. Diagnosis of round 8

**What worked, and stays.** Gemini built the round-8 system faithfully:
- Ring, Trail and Paper.
- Pine as the selected colour.
- One leather button per screen.
- Frank Ruhl Libre with Assistant.
- The hard sheet and the dense rows.

The owner's word is "coherent". Round 9 does not touch that system. It changes the **tops**, the **day colour**, and adds a few **crafted details**.

**Why every top looks the same (measured):**
- Five of the six phone screens use the same painting window. It is the full file, right-anchored at x0.78, showing source x ≈ 440-941: the bougainvillea edge, the tower and the sign. Me is the only exception.
- Every band has the same skeleton: wordmark at top-start, a paper chip at top-end, text, then a melt that takes 38% of the band.
- Login is a copy of Plan: guide arch, speech card and headline. So the owner sees one header six times.

**Why the day tint is murky (measured with PIL):**

| Header | Hue | Saturation | Lightness | Mid-tones |
|---|---|---|---|---|
| Loved round-6 Me | 26-28° | 0.93 | 0.35-0.41 | bright amber |
| Round 8 | 15-21° (brick red) | — | 0.25-0.33 | greyed, e.g. `#BA7149` s 0.45, `#C16A39` s 0.54 |

The cause is the multiply blend. The day painting is a pastel *daylight* scene (pale-blue sky, pink bougainvillea, grey-cream stone). Multiplying those colours onto a red-brown sky shifts every hue toward brown and purple. So the fix is to correct the hue and stop the colour leaking from the art. Lightness is not the problem.

**The four defects you measured, confirmed:**
1. **Empty orange area under the text on phone Home.** The facts line ends at y 315 and the band ends at y 440, leaving 125px of empty melt. The melt was a percentage (38%) of the band, so a taller band just meant more emptiness.
2. **Compass on the seam.** It straddles the hairline between band and sheet, and it crowds "120 m away".
3. **Muddy brown-purple day painting.** See the measurement above.
4. **Repetition.** See the measurement above.

**Other round-8 defects to fix at the same time:**
- **Login:** "Skip · Try first" sits in a place chip with a Ring. The Ring means a place, so this misuses it.
- **Walks:** "12 walks · 48.4 km" is in a Ring chip. Same misuse.
- **Walks:** the Haifa row's "Walk" button wraps under its text.
- **Plan:** the speech card truncates with "…".
- **Desktop Walk:** the pin accessory covers "2.8 km left".
- **Desktop Me:** the rail says "Sign in" while the user is signed in.
- **Desktop Login:** it is a phone-width column inside an empty 1180 frame.
- **Me:** it shows the location chip, which is irrelevant there.

---

## 2. The decision: "One evening, six windows"

Every header is the same **sky** and ends in the same **seam**. Only the **window** changes: what you see through it is what that screen is for. The family comes from the constants; the uniqueness comes from the window.

**Constants (what makes the six one family):**
1. **Sky.** Day uses the "Amber Hour" ramp; night uses the "Lantern Hour" ramp (tokens in §3).
2. **Seam.** The melt is always the last 52px of the band, a fixed pixel length and never a percentage. The sheet's first element, with its 1px hairline, starts right after it. Nothing crosses the seam except the guide's arch on Plan.
3. **Text zone.** Text goes on the inline-start side, with a 16px gutter (20 on the desktop column, 32 on wide bands). It must end **at least 64px above the seam** and at most 88px above it. At 64px above the seam the day sky is `#B25007`, where `#FFF5E8` text measures 4.82:1.
4. **Art recipe.** Day is the "amber print"; night is native colour (§3).
5. **One window per screen.** No crop is ever reused on another screen.
6. **At most one paper element on a band.**
7. **The wordmark appears only on Home and Login,** the two front doors. Every other phone screen puts its own title in the top slot. On desktop the wordmark lives only in the rail and never on a band.

**The six windows:**

| Screen | Window | What it says |
|---|---|---|
| Home | **The view**: tower, sea and the trail sign, close crop | Tonight you walk *there* |
| Plan | **Under the lantern**: lantern, bracket and bougainvillea, plus the guide | The guide lights your way |
| Walk | **The map itself**, with the numeral on a trail-sign plate. No painting | You are inside the walk now |
| Walks | **Footprints**: the empty-walks drawing printed in cream on the sky | Where you have walked |
| Me | **Open sky**: no art (the loved round-6 Me) | Just you |
| Login | **Quiet wall** (olive leaves and lantern) with a centred lockup. Desktop shows the full painting | The front door |

---

## 3. Colour fix: the amber print (day) and lantern hour (night)

**Day sky ("Amber Hour", hue 24-27°, saturation ≥0.9).** It is derived from the loved round-6 values, darkened at the top for text:
```css
--sky: linear-gradient(180deg,#9C4209 0,#A94A08 45%,#B25007 calc(100% - 64px),#C2621A calc(100% - 52px),
       #DA8C4C calc(100% - 40px),#EDBB8A calc(100% - 27px),#F6DCC2 calc(100% - 13px),var(--surface) 100%);
```
Contrast against `#FFF5E8`: `#9C4209` 6.09, `#A94A08` 5.31, `#B25007` 4.82. The stops are anchored to the band's bottom in pixels, so the melt is always 52px whatever the band height.

**Day art: the amber print.**
```css
.band-art{ mix-blend-mode:multiply; filter:grayscale(1) contrast(1.12) brightness(1.06); }
```
Why this works:
- Desaturating the art first means it can contribute only *lightness*. The hue is locked to the sky's amber, so pink, blue and grey can no longer turn into brown or purple. Measured output: tower and sign `#6B2F05` (h 25°, s 0.91), city `#9C5623` (h 25°), melt `#BE5E15` (h 26°). There is no mud anywhere.
- Multiply only darkens. Any art that ends up under white text can only *raise* its contrast.
- The pale fog and the pale sky of the source file collapse into the sky itself, so no washed-out patch appears.
- I tested 11 recipes side by side. These are the losers:
  - plain multiply (round 8)
  - luminosity (leaves a white blob behind the tower)
  - soft-light / overlay (yellow hot spots, red sign)
  - sepia-normal (yellow cast)
  - gradient-map filters (flat)

**Night sky ("Lantern Hour").** Warm charcoal with an ember line at the horizon:
```css
--sky: linear-gradient(180deg,#0F0C0A 0,#15100D 40%,#21160F calc(100% - 64px),#2E1D12 calc(100% - 40px),
       #241A13 calc(100% - 18px),var(--surface) 100%);
```

**Night art.** `mix-blend-mode:normal; filter:saturate(.85)`. The night painting at native colour (navy wall, lit lantern, moon) is the best-looking asset in the set, so it is never tinted.

**Hard rules:**
- Never multiply a full-colour image.
- Never use `cover`.
- Never let the art box exceed 1.15x the source.

The source is 941x340, and a scale of 1.15 is the measured limit before the painting turns soft.

---

## 4. Per-screen header system (exact)

How the crop works:
- `.band` is `position:relative; overflow:hidden; background:var(--sky)`.
- `.band-art` is an absolutely positioned box inside it, using `background-repeat:no-repeat` and the exact `background-size` / `background-position` in px below. px values are LTR.
- Its masks are intersected: `-webkit-mask-composite:source-in; mask-composite:intersect`.
- "Scale" means CSS px per source px.

### Home: "The view"
- **Phone band 272.**
  - Art box: `inset-inline:0; top:0; height:272px`. Background `city-hero-{day|night}.jpg`, `background-size:1082px auto` (x1.15), `background-position:-690px -112px`. The visible source is x 600-939, y 97-337, so the file's blurred top-right smudge (source y < 90) is cropped out.
  - Masks: horizontal `linear-gradient(90deg,transparent 0 28%,#000 62%)`; vertical `linear-gradient(180deg,#000 0,#000 calc(100% - 92px),transparent calc(100% - 40px))`.
  - Top bar (56px): wordmark at start, location chip at end ("Habima · Tel Aviv", Now-Ring).
  - Then the hero numeral "65" with a hanging "min" (§5), and a facts line (Assistant 600 17, max-width 230, max 2 lines). Measured clearance: 78px above the seam.
  - Compass: 58px, `inset-inline-end:18px; bottom:10px`, fully inside the band.
- **Desktop column 440, band 300.**
  - `background-position:-643px -112px`; horizontal mask `transparent 0 26%, #000 60%`.
  - Top bar: chip at end only (the wordmark is in the rail). Gutter 20.
  - Compass 60px, `inset-inline-end:22px; bottom:10px`.

### Plan: "Under the lantern"
- **Phone band 318.**
  - Art box height 300, `background-size:941px auto` (x1.0), `background-position:-130px 0`. The lantern sits at x ≈ 300-355, y 20-90.
  - Masks: horizontal `transparent 0 30%, #000 64%`; vertical `#000 0, #000 120px, transparent 200px`.
  - No top bar. The title sits in the top slot: "Where shall we walk?" in Frank Ruhl 600 28, max-width 240, padding-top 20.
  - Guide arch: 136x184 at `inset-inline-start:16px; bottom:-18px`. It is the only thing that crosses the seam.
  - Speech card: width 196 at `inset-inline-end:16px; bottom:22px`. Title "Chat with Traike", body max 2 lines with **no ellipsis**: "Pick a vibe or name your stops."
  - The start location leaves the band and becomes the first sheet row, "Start · Habima, Tel Aviv": Now-Ring, Lead 18, and a "Change" text button at the end.
- **Desktop column 440, band 330.** Art box height 312, `background-position:-110px 0`. Speech width 220.

### Walk: "The map itself" (no painting, no sky, no melt)
- **Phone: the map is the header, 340px tall,** in the paper map tokens.
  - **Trail-sign plate** (§5, S4) at `inset-inline-start:12px; top:12px`. It holds the numeral "4" (Frank Ruhl 700 64) with a hanging "min · 310 m", then the direction "Left on Nahalat Binyamin" (Assistant 600 16, max-width 190).
  - **Paper tag** at `inset-inline-end:12px; top:12px`: "Stop 2 of 4" with a Now-Ring.
  - Keep the plate's footprint (about 210x104) free of the route, the pin and the street labels by shifting the map's visual centre 40px down.
  - The seam is a hard edge: the section bar's 1px line. No wordmark and no accessory.
- **Desktop:**
  - The same plate sits on the map pane at `inset-inline-start:20px; top:20px`, numeral 72.
  - The column band is **sky only, 176px**: the next stop's name as the title (Frank Ruhl 600 34), then "Stop 2 of 4 · ETA 18:36 · 2.8 km left" (Body 16).
  - No accessory on Walk at all; the map pin is the pin.

### Walks: "Footprints"
- **Phone band 184, sky only, plus the footprints print.**
  - `<img src="assets/empty-walks.png">` absolutely positioned, 220x220, `inset-inline-end:-24px; top:-34px`, `filter:brightness(0) invert(1) sepia(.2)`, opacity 0.9 by day and 0.7 at night.
  - Use an `<img>`, **not** a CSS mask. Chromium blocks `mask-image` on file:// pages; I watched it fail.
  - Title "My walks" at the top slot (padding-top 20), then the facts line "12 walks · 48.4 km" (Body 16, plain text, no chip).
  - No boot here; the boot moves to the empty state.
- **Desktop wide band 964 x 220.** Footprints 300x300 at `inset-inline-end:60px; top:-56px`. Title "My walks & friends" (34), gutter 32.

### Me: "Open sky"
- **Phone band 168, sky only.** Name (Frank Ruhl 600 28) and email (Body 16) at the top slot, padding-top 20.
- No chip and no wordmark.
- The first sheet section is a stats row: 3 cells with 1px `--line` dividers and no card. Numerals in Frank Ruhl 700 34 with hanging units ("12", "48.4 km", "31"); labels Meta 14 muted.
- **Desktop wide band 964 x 184.**

### Login: "Quiet wall"
- **Phone band 300.**
  - Art box height 300, `background-size:706px auto` (x0.75), `background-position:0 0`. It shows the olive leaves, the stone and the lantern.
  - Vertical mask only: `#000 0, #000 150px, transparent 250px`.
  - **Centred lockup** at padding-top 96: mark 44 plus "Traike" in Frank Ruhl 700 52. Then "Walks built around you" (Assistant 600 18).
  - "Skip" is a plain text link at `inset-inline-end:16px; top:14px` (Assistant 700 16, underline, offset 3px), never a chip.
  - **No guide on Login.** The guide belongs to Plan.
- **Desktop: full-width band 1180 x 300.**
  - Day art box: `inset-inline-end:0; width:941px; height:244px; background-size:941px auto; background-position:0 -96px` (x1.0, native, smudge excluded). Masks on the box: horizontal `transparent 0, #000 38%`; vertical `#000 0, #000 150px, transparent 236px`.
  - Night art box: `width:830px; height:300px; background-size:830px auto; background-position:0 0` (the full night painting with moon and lantern). Masks: horizontal `transparent 0, #000 38%`; vertical `#000 0, #000 200px, transparent 290px`.
  - Lockup at start: padding 80px 64px. Mark 52 plus "Traike" in Frank Ruhl 700 64; tagline 20.
  - The form sits in a 400px column under the band, aligned with the lockup (padding-inline-start 64): primary "Continue", secondary "Continue with Google".

### RTL (all screens)
**Flip:**
- `.band-art` gets `transform:scaleX(-1)`. It mirrors the image and its masks together, so keep the px values exactly as written.
- The footprints `<img>` gets `transform:scaleX(-1)`.
- **New:** the guide gets `transform:scaleX(-1)`, so his raised hand points at the speech card. Unflipped, he gestures away from it (verified).

**Never flip:**
- **The brand lockup.** Put `dir="ltr"` on it. This replaces round 8's "mirror the mark", because logos do not mirror.
- The map, the route geometry, and digits.

**Hanging unit:** it moves to the inline-end automatically (`דק׳` hangs to the left of "65").

---

## 5. Signature details (seven, each derived from an asset)

These are the details that make it read "made by one hand, for this product". Each one carries meaning; none is decoration.

**S1. The hanging unit.** The unit hangs from the numeral's cap line instead of sitting on the baseline: "65" with a raised "min". Use it on the Home numeral, the Walk plate, the Me stats and the walk-row durations.
```css
.num{display:inline-flex;align-items:flex-start;font:700 88px/.84 'Frank Ruhl Libre';letter-spacing:-.03em;font-variant-numeric:lining-nums tabular-nums}
.num .u{font:700 18px/1 Assistant;letter-spacing:0;margin-inline-start:6px;margin-top:6px}
```
Sizes:
- Hero: 88 on phone and desktop (round 8's 72 phone / 88 desktop becomes 88 everywhere; it measured fine at 390).
- Plate: 64 phone, 72 desktop, unit margin-top 4px.
- Walk-row duration: 30, unit 14 with margin-top 2px.
- Me stats: 34, unit 14 with margin-top 3px.

**S2. The footstep trail.** The part already walked is *footsteps*, from the dashed trail in `empty-walks.png`. Upcoming is always solid.
- **Map:** the passed route is `stroke:var(--route-past); stroke-width:5; stroke-dasharray:.1 9; stroke-linecap:round`, which gives round dots every 9px. The upcoming route stays the solid 6/7px Pine line with its 2px casing.
- **Stop list:** the spine between passed stops is 4px wide, `background:radial-gradient(circle,var(--route-past) 1.5px,transparent 1.6px) 0 0/4px 8px repeat-y`. The spine between upcoming stops is 2px solid `--spine`.

**S3. The Ring life-cycle plus the finish pennant.** One symbol, four states:

| State | Spec |
|---|---|
| Upcoming | Hollow Ring |
| Now | Ring with a leather core |
| Passed | Rim in `--route-past`, no core; the name in `--muted` |
| Finish | Bullseye with a pennant. 22x22 SVG: pole `M11 10V1.5` (ink, 1.75, round); flag `M11 1.5l6 2.4-6 2.4z` (ink fill); ring `circle cx11 cy14 r6`, 2px ink rim, surface fill; core `r2.6` ink |

- On the map the finish uses the same drawing at 1.25x.
- The pennant comes from the flag in `empty-walks.png`. It is ink, never leather.
- **No numbers inside Rings.** They would need sub-14px digits. The time column and "Stop 2 of 4" already carry the order.

**S4. The trail-sign plate** (from the painted wooden trail sign and its routed border).
```css
.plate{background:var(--plate);color:#FFF5E8;border-radius:6px;padding:12px 16px 14px;
  box-shadow:inset 0 0 0 3px var(--plate),inset 0 0 0 4px rgba(255,245,232,.30),0 2px 0 rgba(0,0,0,.35)}
/* --plate: day #1B2620, night #0F0C0A (cream on it = 18:1) */
```
Use it in **exactly two places**:
1. **The Walk numeral plate.**
2. **The map's next-stop callout, as a signpost.** The plate has 8/10/8/14 padding: the stop name (Assistant 600 16) and a time tag. A 2px x 28px post in `--plate` drops from the plate's inline-start + 11px down to the top of the pin. The callout sits on the side away from the walker.

Nothing else is a plate.

**S5. Ring-lit tab icons.** All five icons are custom: 22px, 24 viewBox, stroke 1.75, round caps and joins. Each contains **exactly one Ring**, the element with class `r`:

| Icon | Paths (the `r` element is the Ring) |
|---|---|
| Home | `M4 11.2 12 4.6l8 6.6V20H4z` + window `circle cx12 cy14.6 r2.5` |
| Plan (= brand mark) | `M4 20.5c5-1 4.6-7 8.6-8.4s4.6-2.6 5.4-3.4` + `circle cx19 cy6.6 r2.6` |
| Walk | head `circle cx13.4 cy4.4 r2.2` + `M12.8 8.2 10.6 14l3 2.6.6 4.9M10.6 14l-2.2 6.5M13 9.6l3.2 3 2.2-.8M18.9 8.6l.6 12.4` |
| Walks | `circle cx6 cy18 r2.5` + `circle cx18 cy6 r2.5` + `M8.3 16.9c6.2-1.6 1.6-8.2 7.4-9.9` |
| Me | head `circle cx12 cy8.4 r3.6` + `M5 20.2c.8-4.2 3.6-6.3 7-6.3s6.2 2.1 7 6.3` |

- **Selected tab:** the Pine pill (unchanged) **plus that icon's Ring filled with leather** (`.on .r{fill:var(--leather)}`). It reads as "you are here".
- The desktop rail rows use the same icons and the same rule.

**S6. Walk rows with serif durations.**
- Row: min-height 64, padding 8/16.
- 48px mini-map tile: `--map-land`, radius 4, 1px line, one white street cross. The route is a 2.5px Trail from a Now-Ring start to an ink-core finish.
- Name: Lead 18/600. Meta: 14 muted, e.g. "4.1 km · 4 stops · Saved".
- At the inline-end, the duration "65" with a hanging "min" (S1, 30px).
- **The whole row is the tap target** (pressed/hover = `--surface-2`). **No per-row "Walk" buttons.** This also fixes the Haifa wrap bug.

**S7. Empty states with one real object.**
- Layout: `boot.png` at 84px with the accessory drop-shadow, one Lead 18/600 line, and one secondary button. Centred, padding 24/16/20.
- Examples: "No friends' walks yet" / "Invite a friend"; "No walks yet" / "Plan a walk".
- The footprints drawing is never reused here; it is the Walks header.

**Rejected (decided, do not reintroduce):**
- **A stone/ashlar edge on the sheet top.** It is ornament; the hairline seam is the busbo formula.
- **Stop numbers in Rings.** Covered under S3.
- **A sun disc or any radial "glow" on the sky.** It is banned.
- **The pin accessory on Walk.** The map pin is the pin.

---

## 6. Defect fixes (how each one is closed)

| Defect | Fix | Verified |
|---|---|---|
| Empty orange area under the text (Home) | The melt is a fixed 52px, not 38%. The band is 272, not 300. Text clearance is 64-88px. The compass fills the bottom-end. | Clearance 78px, of which 52 is melt |
| Compass on the seam | The accessory sits entirely inside the band, `bottom:10px`, and never crosses the seam. The section bar keeps its end text. | Measured 10px gap |
| Muddy day painting | The amber print recipe plus the Amber Hour sky | Output h 24-26°, s 0.80-0.91; no pink, purple or grey |
| Same top everywhere | Six windows, wordmark only on Home and Login, chip only on Home (Walk has a stop tag), no painting on Walk, Walks or Me | Six visibly different tops rendered |

The extra defects listed in §1 are closed as follows:
- **Skip:** a text link.
- **Walks stats:** a facts line.
- **Haifa row:** row buttons removed.
- **Speech card:** copy shortened to 2 lines.
- **Desktop Walk:** no accessory.
- **Desktop rail:** shows the user's name row (Me icon plus name) when signed in, and "Sign in" only when signed out.
- **Desktop Login:** a full-width band with the form below.
- **Me:** chip removed.

**Before running Gemini (orchestrator, because I am read-only):**
- Copy `public/images/traike/empty-walks.png` to `docs/design-brief/gemini/assets/empty-walks.png`. The round-8 HTML already references it, and it currently 404s.
- Pass these shots: `asset-empty-walks`, `asset-city-hero-day`, `asset-city-hero-night`, `asset-guide`, and the r8 shots `phone-en-day-home` / `-plan` / `-walks` (copied into `shots/` as `r8-*`) as "what to change".

Test renders (scratchpad):
- `/private/tmp/claude-501/-Users-arielshorpacker-Documents-obs-vault-try/66cd326c-6bd1-4549-a04c-90d7c93d57a4/scratchpad/tint.png`: 11 day recipes
- `/private/tmp/claude-501/-Users-arielshorpacker-Documents-obs-vault-try/66cd326c-6bd1-4549-a04c-90d7c93d57a4/scratchpad/heads2.png`: six phone headers, day, night and HE
- `/private/tmp/claude-501/-Users-arielshorpacker-Documents-obs-vault-try/66cd326c-6bd1-4549-a04c-90d7c93d57a4/scratchpad/desk.png`: desktop bands
- `/private/tmp/claude-501/-Users-arielshorpacker-Documents-obs-vault-try/66cd326c-6bd1-4549-a04c-90d7c93d57a4/scratchpad/sig.png`: signature details
- `/private/tmp/claude-501/-Users-arielshorpacker-Documents-obs-vault-try/66cd326c-6bd1-4549-a04c-90d7c93d57a4/scratchpad/login3.png`: desktop login, day

---

## 7. Ready-to-paste section for BRIEF.md

```markdown
# ROUND 9 — OWNER: "IT'S FINE (COHERENT) BUT IT CAN BE MORE UNIQUE AND HIGHER QUALITY. AND WHY IS THE TOP THE SAME ON EVERY SCREEN?"
BASE = the round 8 file. KEEP the whole round-8 system unchanged: Ring / Trail / Paper, Pine = every selected state, leather = go/you/now only, one primary button per screen, hard-edged sheet, dense hairline rows, solid selected row, orange button with dark lip, big guide in his arch, map as the star, Frank Ruhl Libre + Assistant, tokens, radii, tab bar, desktop rail, toggles setDevice/setLang/setTheme/setScreen, screens home/plan/walk/walks/me/login.
CHANGE three things only: (1) every screen gets its OWN header ("One evening, six windows"), (2) the day colour recipe (round 8's day painting went muddy brown-purple), (3) seven signature details. Plus fix the listed defects.

## Family constants (identical on every header)
- SKY day "Amber Hour": linear-gradient(180deg,#9C4209 0,#A94A08 45%,#B25007 calc(100% - 64px),#C2621A calc(100% - 52px),#DA8C4C calc(100% - 40px),#EDBB8A calc(100% - 27px),#F6DCC2 calc(100% - 13px),var(--surface) 100%).
- SKY night "Lantern Hour": linear-gradient(180deg,#0F0C0A 0,#15100D 40%,#21160F calc(100% - 64px),#2E1D12 calc(100% - 40px),#241A13 calc(100% - 18px),var(--surface) 100%).
- SEAM: the melt is ALWAYS the last 52px of the band (px, never %). Nothing crosses the seam except the guide's arch on Plan.
- TEXT: inline-start, gutter 16 phone / 20 desktop column / 32 wide band; must end 64-88px above the seam (#FFF5E8 on #B25007 = 4.82:1). No text-shadow.
- DAY ART = "amber print": .band-art{mix-blend-mode:multiply; filter:grayscale(1) contrast(1.12) brightness(1.06)}. NEVER multiply a full-colour image (that is what made round 8 muddy).
- NIGHT ART = native colours: mix-blend-mode:normal; filter:saturate(.85).
- Crops use exact px background-size/background-position (values below are LTR); background-repeat:no-repeat; NEVER cover; never scale the art above 1.15x (source 941x340). Masks intersected (-webkit-mask-composite:source-in; mask-composite:intersect).
- One window per screen; never reuse a crop on two screens. Max one paper element on a band.
- Wordmark appears ONLY on Home and Login (phone). Every other phone screen puts its title in the top slot (Frank Ruhl 600 28, padding-top 20). Desktop: wordmark only in the rail, never on a band.

## The six windows
| Screen | Window | Phone | Desktop |
|---|---|---|---|
| HOME "The view" | tower + sea + trail sign | band 272. Art box full band height, city-hero-{day,night}.jpg, background-size 1082px auto (x1.15), background-position -690px -112px. Masks: 90deg transparent 0 28%, #000 62%; 180deg #000 0, #000 calc(100% - 92px), transparent calc(100% - 40px). Top bar 56: wordmark start + location chip end. Numeral "65" with hanging "min" + facts line (Assistant 600 17, max-width 230, max 2 lines). Compass 58px at inset-inline-end 18, bottom 10 (fully inside the band). | column 440, band 300, background-position -643px -112px, horizontal mask transparent 0 26%, #000 60%; chip end only; compass 60 at end 22, bottom 10. |
| PLAN "Under the lantern" | lantern + bracket + bougainvillea + the GUIDE | band 318. Art box height 300, background-size 941px auto (x1.0), background-position -130px 0. Masks: 90deg transparent 0 30%, #000 64%; 180deg #000 0, #000 120px, transparent 200px. No top bar: title "Where shall we walk?" in the top slot (max-width 240). Guide arch 136x184 at inline-start 16, bottom -18. Speech card width 196 at inline-end 16, bottom 22, title + max 2 lines body, NO ellipsis ("Pick a vibe or name your stops."). Location becomes the first sheet row "Start · Habima, Tel Aviv" (Now-Ring, Lead 18, "Change" text button). | column 440, band 330, art box height 312, background-position -110px 0, speech width 220. |
| WALK "The map itself" | NO painting, NO sky, NO melt | the MAP is the header, 340px tall (paper map tokens). Trail-sign PLATE (S4) at inline-start 12 / top 12: numeral "4" Frank Ruhl 700 64 + hanging "min · 310 m", then "Left on Nahalat Binyamin" (600 16, max-width 190). Paper tag at inline-end 12 / top 12: Now-Ring + "Stop 2 of 4". Keep the plate's ~210x104 area free of route, pin and street labels. Hard seam (the section bar's 1px line). No wordmark, no accessory. | the same plate on the map pane at start 20 / top 20 (numeral 72). The column band is SKY ONLY, 176px: next stop name as the title (Frank Ruhl 600 34) + "Stop 2 of 4 · ETA 18:36 · 2.8 km left" (16). No accessory anywhere on Walk. |
| WALKS "Footprints" | the empty-walks drawing printed in cream | band 184, sky only + <img src="assets/empty-walks.png"> 220x220 at inline-end -24, top -34, filter brightness(0) invert(1) sepia(.2), opacity .9 day / .7 night (use an <img>, NOT a CSS mask: masks fail on file://). Title "My walks" + plain facts line "12 walks · 48.4 km" (Body 16; NOT in a chip). No boot here. | wide band 964x220, footprints 300x300 at inline-end 60, top -56, title "My walks & friends" 34. |
| ME "Open sky" | no art (= the loved round-6 Me) | band 168: name (Frank Ruhl 600 28) + email (16) at the top slot. No chip, no wordmark. First sheet section = stats row: 3 cells, 1px line dividers, NO card; numerals Frank Ruhl 700 34 with hanging unit ("12", "48.4 km", "31") + Meta 14 muted labels. | wide band 964x184. |
| LOGIN "Quiet wall" | olive leaves + stone + lantern; centred lockup | band 300. Art box height 300, background-size 706px auto (x0.75), background-position 0 0; vertical mask only: #000 0, #000 150px, transparent 250px. Centred lockup at padding-top 96: brand mark 44 + "Traike" Frank Ruhl 700 52, tagline "Walks built around you" Assistant 600 18. "Skip" = plain text link at inline-end 16 / top 14 (700 16, underline, offset 3px); NOT a chip, no Ring. NO guide on Login (the guide belongs to Plan). | full-width band 1180x300. Day art box: inset-inline-end 0, width 941, height 244, background-size 941px auto, background-position 0 -96px; masks on the box: 90deg transparent 0, #000 38%; 180deg #000 0, #000 150px, transparent 236px. Night art box: width 830, height 300, background-size 830px auto, background-position 0 0; masks 90deg transparent 0, #000 38%; 180deg #000 0, #000 200px, transparent 290px. Lockup at start (padding 80px 64px): mark 52 + wordmark 64 + tagline 20. Form = a 400px column under the band, aligned with the lockup: primary "Continue", secondary "Continue with Google". |

## RTL
- FLIP: transform scaleX(-1) on .band-art (keep the px values exactly as written; image and masks mirror together); on the footprints <img>; and on the GUIDE (so his raised hand points at the speech card); speech tail; arrows.
- NEVER flip: the brand lockup (dir="ltr"; logos do not mirror; this replaces round 8's "mirror the mark"), the map, the route geometry, digits. Hanging units sit at the inline-end automatically.

## Signature details (build all seven exactly)
S1 HANGING UNIT: the unit hangs from the numeral's cap line, not the baseline. .num{display:inline-flex;align-items:flex-start;font:700 88px/.84 'Frank Ruhl Libre';letter-spacing:-.03em;font-variant-numeric:lining-nums tabular-nums} .num .u{font:700 18px/1 Assistant;letter-spacing:0;margin-inline-start:6px;margin-top:6px}. Sizes: Hero 88 on phone AND desktop; Walk plate 64/72 (unit margin-top 4); walk-row duration 30 (unit 14, margin-top 2); Me stats 34 (unit 14, margin-top 3).
S2 FOOTSTEP TRAIL: the walked part is footsteps, upcoming is solid. Map passed route: stroke var(--route-past), width 5, dasharray .1 9, round caps. List spine between passed stops: 4px wide, background radial-gradient(circle,var(--route-past) 1.5px,transparent 1.6px) 0 0/4px 8px repeat-y. Spine between upcoming stops: 2px solid --spine.
S3 RING LIFE-CYCLE: upcoming = hollow Ring; now = leather core; passed = rim --route-past, no core, name in --muted; finish = bullseye + pennant (22x22 SVG: pole path "M11 10V1.5" ink 1.75 round; flag path "M11 1.5l6 2.4-6 2.4z" ink fill; ring circle cx11 cy14 r6, 2px ink rim, surface fill; core r2.6 ink). Map finish = the same at 1.25x. NO numbers inside Rings.
S4 TRAIL-SIGN PLATE (from the painted wooden trail sign): background var(--plate) (day #1B2620, night #0F0C0A); color #FFF5E8; radius 6; padding 12px 16px 14px; box-shadow inset 0 0 0 3px var(--plate), inset 0 0 0 4px rgba(255,245,232,.30), 0 2px 0 rgba(0,0,0,.35). Used in EXACTLY two places: (a) the Walk numeral plate; (b) the map's next-stop callout as a SIGNPOST: plate (padding 8px 10px 8px 14px) with the stop name 600 16 + time tag, plus a 2px x 28px post in --plate dropping from the plate's inline-start + 11px down to the top of the pin, placed on the side away from the walker. Nothing else is a plate.
S5 RING-LIT TAB ICONS: custom 22px, 24 viewBox, stroke 1.75, round caps/joins; each icon contains exactly ONE Ring (class r). Home: "M4 11.2 12 4.6l8 6.6V20H4z" + window circle cx12 cy14.6 r2.5 (r). Plan (= brand mark): "M4 20.5c5-1 4.6-7 8.6-8.4s4.6-2.6 5.4-3.4" + circle cx19 cy6.6 r2.6 (r). Walk: head circle cx13.4 cy4.4 r2.2 (r) + "M12.8 8.2 10.6 14l3 2.6.6 4.9M10.6 14l-2.2 6.5M13 9.6l3.2 3 2.2-.8M18.9 8.6l.6 12.4". Walks: circle cx6 cy18 r2.5 + circle cx18 cy6 r2.5 (r) + "M8.3 16.9c6.2-1.6 1.6-8.2 7.4-9.9". Me: circle cx12 cy8.4 r3.6 (r) + "M5 20.2c.8-4.2 3.6-6.3 7-6.3s6.2 2.1 7 6.3". Selected tab = Pine pill (unchanged) + that icon's Ring filled leather (.on .r{fill:var(--leather)}). The desktop rail uses the same icons and rule.
S6 WALK ROWS: min-height 64, padding 8/16. 48px mini-map tile (map-land, radius 4, 1px line, one white street cross; 2.5px Trail route from a Now-Ring start to an ink-core finish). Name Lead 18/600 + meta 14 muted ("4.1 km · 4 stops · Saved"). At inline-end: duration "65" + hanging "min" (S1, 30px). The WHOLE ROW is the tap target (pressed/hover = --surface-2). DELETE the per-row "Walk" buttons.
S7 EMPTY STATES: boot.png 84px (accessory drop-shadow) + one Lead 18/600 line + one secondary button, centred, padding 24/16/20. E.g. "No friends' walks yet" / "Invite a friend"; "No walks yet" / "Plan a walk". The footprints drawing is never reused in empty states.
Do NOT add: a stone/ashlar edge on the sheet, sun discs or radial glows, a pin accessory on Walk, a boot on the Walks band, a guide on Login.

## Defect fixes (must be visibly fixed)
1. Home: no empty orange area under the text. Band 272, melt 52px, text ends 64-88px above the seam; the compass fills the bottom-end.
2. The accessory never touches or crosses the seam (bottom:10px inside the band); the section bar below keeps its end text.
3. The day art is amber, never brown-purple (amber print recipe above).
4. Six visibly different tops; no two screens share a crop or a top bar.
5. Also fix: Login "Skip" is a text link (no chip, no Ring); Walks stats are a plain facts line (no Ring chip); the Plan speech card never truncates; desktop Walk has no accessory over text; the desktop rail shows the user's name row when signed in ("Sign in" only when signed out); desktop Login is the full-width band plus a form, never a phone column in an empty frame; no location chip on Me.

## Self-check (answer every line before returning)
- [ ] Put the six phone screens side by side: are all six tops visibly different (view / lantern + guide / map + plate / footprints / open sky / quiet wall + centred lockup)?
- [ ] Is the wordmark on a band only on Home and Login? Is the location chip only on Home?
- [ ] Day art: grayscale + multiply on the Amber Hour sky; no pink, purple, grey or brown mud anywhere? Night art: native, moon/lantern intact?
- [ ] Is every melt exactly the last 52px? Does every text block end 64-88px above the seam? Is there no empty orange zone under text?
- [ ] Does any accessory, chip or card cross the seam? (Only the guide's arch may.)
- [ ] Crops: px size/position exactly as specified, no cover, no scale above 1.15x, no visible smudge (day file top-right) and no hard art edge?
- [ ] RTL: art and footprints mirrored, guide mirrored toward the speech card, lockup NOT mirrored, digits isolated, ״ ׳ used, zero overflow at 390?
- [ ] S1-S7 all present: hanging units; dotted walked trail; Ring life-cycle with finish pennant; exactly two plates (Walk numeral + signpost callout); Ring-lit tab icons; walk rows with serif durations and no row buttons; boot empty state?
- [ ] Leather count per screen: 1 primary button + small "now" marks only (ring cores, time tag, walker, pin core, lit tab Ring)?
- [ ] Desktop: exactly one primary button visible; map labels never covered; callout never overlaps the walker; Login fills the frame?
- [ ] Bans: no green dots/pills, glows/orbs, purple/blue gradients, nested cards, accent-rail borders, border-only selection, eyebrow labels, emoji, Inter/default Lucide, text <13px.
```
