# Traike: design direction for round 8 (Opus, 2026-11-19)

Sources reviewed: BRIEF.md R1-R7; gemini/r5 and gemini/r6 (home, plan, me, desktop plan); a live render of 07-app-redesign.html (round 7) in phone and desktop, EN and HE, day and night; shots/cur-*; shots/ref-busbo12-*; and the real assets (city-hero-day/night, guide, compass, boot, pin, theme photos).
Before writing this, I tested the header and type proposals in throwaway renders. The numbers below come from those renders, not from guesses.

---

## 1. Diagnosis: why it still feels generic, "AI", and unrelated

The short answer: round 5 and round 7 are put together from borrowed pieces that have no shared rule. Each element is fine alone. None of them comes from Traike.

**The location chip (the owner's screenshot).** Measured CSS: `background: rgba(22,18,15,.78)`, `border: 1px solid rgba(255,255,255,.36)`, `radius 4px`, Heebo 600 13.5px, plus an 8x8 `#d96236` square.
- The dark smoked-glass box is a camera/HUD idiom. Nothing else in the app is dark glass. The sheet is cream paper and the speech card is cream paper, so the chip comes from another product.
- The orange square comes from busbo. There, the yellow square is the school (the route's destination) and repeats the yellow bus. In Traike the square means three things: the logo tile, the map's finish marker, and the walker marker. None of these is "you are here". So it reads as a random status LED.
- Heebo's Latin letters are Roboto, so the chip text is set in the Android system face, next to a Fraunces wordmark. Two typographic voices share one 34px strip.
- At 13.5px over a busy painting, the label also looks like small print.

**Marker grammar: there is none.** One screen uses six different symbols for "a point":
- orange teardrop pin
- orange square with a hiker (walker, on Plan)
- orange square with an arrow (walker, on Walk)
- plain orange square (finish)
- orange circle (finish on the Walk mini-map)
- the green 3D pin (Walk band)

The hollow ring used for the stops, the one approved since round 4, is the only symbol that is actually right. It is the real Traike motif, and it is also the face of the owner's own 3D pin (cream ring, leather core).

**Colour: orange is everywhere, so it means nothing.** On round-5 Plan the orange is on the logo tile, the chip square, the selected 90m segment and the primary button. Desktop adds two more primary buttons ("Plan my walk" in the rail and "Start live walk"), for three orange call-to-action buttons on one screen. Selection colour is inconsistent too: selected vibe chips are black, the selected time segment is orange, the selected tab is black. The ink is a neutral `#1e1b18`, but all the real assets pair orange with forest green: the boot is leather with a green sole, the pin has a green body, and the compass has a green bezel. The UI dropped that pairing, so the dark parts and the orange parts look like they come from different kits.

**Typography: three faces with three personalities.**
- Fraunces 800 is a soft, wonky 70s display serif. Its "4" on the Walk screen is quirky.
- Frank Ruhl Libre 900 appears only as the Hebrew fallback, so the Hebrew headings are a different face from the English ones.
- Heebo (Roboto) is used for all UI text.

On top of that, 13.5px "meta" text is used for chip labels, speech-card body, secondary buttons and the band subline. That much small text is what makes it look like a generated dashboard. The heavy `text-shadow: 0 2px 14px` on every white word is the classic crutch for text on a photo; it leaves muddy halos and admits the text is sitting in the wrong place.

**Icons.** Lucide's home, compass, navigation, route and user icons with 2px strokes: the banned default set in all but name. The 40px "mini route glyph" boxes in the walk rows are clip art.

**Header art (round 7).**
- The painting sits under two full-strength scrims: rust `rgba(116,38,12,.84)` from the left, plus a melt layer. The art turns a muddy dusty-pink.
- The magenta bougainvillea clashes with the rust.
- The day file is near-white at `#fbf3e8`. Its left 40% is fog over plain stone and its right sky is pale, so after the scrim you get a dark-rust left and a whitish blotch at bottom-right. The fade runs diagonally, which reads as a stain.
- `background-size: cover` upscales a 941x340 file.
- The day file has a blurred AI-generated smudge in its top-right corner (around x 780-941, y 0-90). Round 7 put the chip right on top of it.
- The night file is navy, and its blue meets the warm-charcoal sheet with no transition.
- Also on the band: the floating orange "18:15" sticker with its own black border, and a 48px compass glued to the numeral like an emoji.

**Static details doing the job of states.** Drop shadows and text shadows stand in for depth, while real states (pressed, focus, current stop) are missing or inconsistent. Only the primary button has a pressed state.

---

## 2. One identity: "Trail mark on limestone"

**The idea.** Traike's whole visual language is built from the objects already in the app: the owner's 3D pin, boot and compass, and the painted old city. There are two primitives and one material.

- **Primitive 1, the Ring.** A stop. It is a cream ring with an ink rim. When it is "now" (you, the current stop, the start) it gets a leather-orange core, exactly like the face of `pin.png`. Every point in the app is a Ring: the location chip, the list stops, the map stops, the logo, the map pin's face.
- **Primitive 2, the Trail.** A line with a round cap, in Pine Ink. It is the map route, the spine in the stop list, the logo stroke and the icon strokes. Thickness depends on size; the cap and the colour never change.
- **Material: limestone paper.** Anything that sits on the art or the map (location chip, speech card, map tags) is a cut piece of the sheet: same fill, same 6px corner, same hairline, and a 2px Pine "lip" underneath it. It is paper resting on a picture, not glass floating over it.

**Colour roles (strict).**
- **Leather** `#D2602F` means "go / you / now", and only that: the one primary button, Ring cores, the current stop's time tag, the walker marker and the map pin's core.
- **Pine Ink** `#1B2620` means "chosen / structure": text, outlines, the route, and every selected state (vibe chips, time segment, tab, current row). It reads as black but shares the hue of the boot sole, the pin body and the compass bezel. That is why the orange and the dark finally look like one object.
- Forest green never appears as a fill or a dot. It exists only inside the ink.

### 2.1 Tokens (paste as-is)

```css
:root{ /* Sunset Day */
  --surface:#F8F3EA;      /* limestone sheet */
  --surface-2:#F0E8DA;    /* section bars, hover, map tiles in rows */
  --line:#DDD2C0;         /* 1px hairline (row rules only) */
  --ink:#1B2620;          /* Pine Ink: text, 1.5px outlines, route, selected fills */
  --muted:#5E584D;        /* meta text (6.4:1 on surface) */
  --leather:#D2602F;      /* go / you / now */
  --on-leather:#111915;   /* text on leather (4.6:1); NEVER white on leather */
  --lip:#1B2620;          /* primary button bottom edge */
  --paper-lip:0 2px 0 rgba(27,38,32,.88);
  --hair-on-art:rgba(27,38,32,.16);
  --route:#1B2620; --route-past:#B4AA9A; --spine:#CBBFAD;
  --on-art:#FFF5E8;       /* text on the band */
  --sky:linear-gradient(180deg,#8A3311 0%,#A2420F 24%,#B24B12 46%,#B85016 60%,
        #D2793A 71%,#EAAE7B 81%,#F5D9BC 91%,var(--surface) 100%);
  --map-land:#F2ECE1; --map-block:#E6DDCD; --map-park:#DCE3D2; --map-water:#C9DADF;
  --map-road:#FFFFFF; --map-label:#6A6357;
}
:root[data-theme="night"]{ /* Dusk Night */
  --surface:#1A1613; --surface-2:#231E19; --paper:#29221C; --line:#3A322A;
  --ink:#F2EADC; --muted:#B5AA99;
  --leather:#E06A38; --on-leather:#111915; --lip:#6E2A0F;  /* lip goes deep-leather so the slab still reads */
  --paper-lip:0 2px 0 rgba(0,0,0,.7); --hair-on-art:rgba(242,234,220,.14);
  --sel-fill:#EDE3D3; --sel-text:#1A1613;   /* selected = inverted ink, like busbo night */
  --route:#F2EADC; --route-past:#5F574D; --spine:#4A4038; --on-art:#FFF1DE;
  --sky:linear-gradient(180deg,#120E0C 0%,#1A130F 30%,#26180F 55%,#2A1C13 66%,#231A14 82%,var(--surface) 100%);
  --map-land:#1F1B17; --map-block:#29231E; --map-park:#232A22; --map-water:#1B272C;
  --map-road:#2E2822; --map-label:#A69B8B;
}
/* day: --paper = --surface ; --sel-fill = --ink ; --sel-text = --surface */
```

Contrast checked: white text `#FFF5E8` on `#B85016` is 4.6:1, so white 16px text must stay in the top 62% of the band. Ink on leather is 4.6:1. Muted on surface is 6.4:1. Night muted on surface is 7.8:1.

### 2.2 Type system

Both faces are on Google Fonts and draw Hebrew natively, so English and Hebrew get the same face and weight with no fallback swap. Load:
`https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@600;700&family=Assistant:wght@400;600;700&display=swap`

- **Display: Frank Ruhl Libre.** This is the classic Israeli serif (newspapers, books, street plaques), so it is rooted in the place. It replaces both Fraunces and the Frank Ruhl 900 fallback.
  - 700 for the hero numeral and the wordmark.
  - 600 for the one headline per screen and the speech-card title.
- **UI: Assistant** (humanist; Source-Sans-style Latin, Hebrew by Ben Nathan). It replaces Heebo (which is Roboto). Weights: 400 body, 600 rows/labels/chips, 700 buttons.
- **Scale (5 sizes; the second number is desktop):**
  - Hero 72 / 88, line-height 0.86, letter-spacing -0.03em
  - Title 28 / 34, line-height 1.12
  - Lead 18 (row names, buttons, numeral unit, speech title)
  - Body 16
  - Meta 14 (times, helper text, tab labels)
  - Nothing smaller than 14 except the map attribution (13).
- **Hebrew rules:**
  - Letter-spacing 0. Never use negative tracking on Hebrew.
  - Body line-height 1.5.
  - Use ״ and ׳ (`ק״מ`, `דק׳`, `מ׳`), not quote marks.
  - Wrap numbers and times in `<bdi>`.
- All times use `font-variant-numeric: tabular-nums` and sit in a fixed 52px column, so alignment holds even where the face lacks the tabular-figure feature.
- No `text-shadow` anywhere.

### 2.3 Shape and stroke rules

- **Corners.** 6px on every control: buttons, chips, paper tags, inputs, segmented control, tab pill, speech card, map callouts and controls. 4px on things nested inside them (photo thumbnails, the time tag). 0 on full-bleed rows and the sheet. Fully round only for the Ring and the top of the guide's arch. No other radii.
- **Strokes.**
  - 1px `--line`: row rules only.
  - 1.5px `--ink`: control outlines and the tab-bar top rule.
  - 1.5px on a 22px canvas (stroke-width 1.75 in a 24-unit viewBox), round caps and joins: icons.
  - Route: 6px on phone, 7px on desktop.
  - Ring rim: 2px in lists, 2.5px on the map.
- **Elevation.** Only three effects exist: `--paper-lip` (paper on art or map), the primary button's 4px lip, and `drop-shadow(0 6px 10px rgba(60,24,6,.35))` on the single 3D accessory. Nothing else gets a shadow.
- **Motion.**
  - Primary button press: translateY(2px) with the lip going from 4px to 2px, 80ms.
  - Selection fill change: 120ms ease-out.
  - Walker marker moves 600ms along the route.
  - The art never moves: no parallax, no slow zoom.
  - Respect `prefers-reduced-motion`.

### 2.4 Component spec

Every component below is built from Ring, Trail, Paper and the two colour roles.

| Component | Spec |
|---|---|
| **Ring** (the core motif) | 14px circle, 2px `--ink` rim, `--surface` fill. **Now** variant adds a 6px `--leather` core. **Past** variant is a 10px solid `--route-past` dot with no rim. Map size: 16px with a 2.5px rim; the finish stop is 20px with an 8px `--ink` core (bullseye). |
| **Location chip** (redesigned) | Paper tag with a leading Now-Ring and the label "Habima · Tel Aviv" (specific place first). Details below. |
| **Paper tag** (any info floating over art or map) | Same build as the location chip. The leading item is a Ring (for a place) or a 20px icon (for info, e.g. the map's "4 stops · 4.1 km" with the Walks icon). **At most one paper tag on the band.** No dots, no squares. |
| **Time tag** (data) | `--leather` fill, `--on-leather` text, Assistant 700 14 tabular, height 26, padding-inline 7px, radius 4, no border, no lip. Used **only** for the current or next stop's time (in the selected row and the map callout). Never on the band. |
| **Primary button** (round 5, kept) | Height 52, full width, radius 6, `--leather` fill, `--on-leather` Assistant 700 18. Border 1.5px `--ink` on three sides plus a 4px `--lip` bottom (night: a 1.5px `#0E0B09` border and a `#6E2A0F` lip). Custom 2px arrow, flipped in RTL. **One per screen, desktop included.** Remove the rail's "Plan my walk". "Start live walk" appears only when it is that screen's primary. |
| **Secondary button** | Height 44, radius 6, `--surface` fill, 1.5px `--ink` outline, Assistant 700 16. No lip. |
| **Segmented control** | Outer 1.5px `--ink`, radius 6, cells 44px tall with 1px `--line` dividers, Assistant 600 16 tabular. **Selected = `--sel-fill` with `--sel-text`** (Pine in day). The only deliberate change from round 5: orange is kept for the action. |
| **Vibe chips** (round 5) | Height 44, radius 6, 1.5px `--ink` outline, padding-inline 6px 12px, 30px photo with radius 4, Assistant 600 16 (was 13.5/700). Selected = `--sel-fill`. |
| **Stop row** (round 5 density) | Grid of 52px time, 22px Ring, 1fr name (Lead 18/600), auto tag (Meta 14 muted); min-height 52; 1px `--line` rule. A 2px `--spine` line runs through the Ring column between rows, so the list *is* the route. **Selected/current row = solid `--sel-fill`** (Pine), text `--sel-text`, time shown as a time tag, Ring rim in `--surface` with a leather core. |
| **Walk row** | 48px mini-map tile (`--map-land`, radius 4, 1px `--line`) with the real route drawn in a 2.5px Trail, a start Now-Ring and a finish bullseye. Replaces the clip-art glyph box. Outline "Walk" secondary button on the end side. |
| **Tab bar** (round 5) | 1.5px `--ink` top rule, 4px padding, 3px gap. Each tab is 52px tall with a 22px custom icon and a Meta 14/600 label. Selected = `--sel-fill` pill, radius 6. Icons, all in the Trail stroke: Home = house outline; Plan = the brand mark (curve plus Ring); Walk = the hiker-with-stick from the painted trail sign; Walks = two Rings joined by a curve; Me = head ring plus shoulder arc. |
| **Desktop rail** | Brand mark plus wordmark in `--ink`. Nav rows are 44px with selected = `--sel-fill` pill, radius 6. No CTA. "Sign in" is a text row at the bottom. |
| **Speech card** | Paper (radius 6, `--hair-on-art`, `--paper-lip`), padding 12/14. Title in Frank Ruhl 600 18; body in Assistant 400 16 `--muted`, 2 lines max. Tail: a 12px rotated square with the same hairline, pointing at the guide, mirrored in RTL. Night fill is `--paper`. |
| **Guide arch** (round 5, kept) | 136x184, radius `68px 68px 6px 6px`, `object-position: 50% 0`, no feather mask, no border. It stands on the band and overlaps the seam into the sheet by 18px. Use guide.jpg in day and guide-night.jpg at night. |
| **Brand mark** | 26px. A Trail curve from bottom-start rising to a Ring at the top-end, Ring with a leather core. Shown in `--on-art` on the band and `--ink` on the sheet. Wordmark "Traike" in Frank Ruhl 700, 24px, letter-spacing -0.01em, Latin in both languages. Mirror the mark in RTL. **The orange logo tile is retired.** |
| **Map** | See the map rules below this table. |
| **3D accessory** | Max one per screen. 60px. Sits **on the seam at the band's inline-end**, overlapping the sheet by 20px, under the art's faded base, never touching text. Compass on Home, pin.png on Walk (it is the map pin), boot on Walks. None on Plan or Login (the guide is the hero there), none on Me. The section bar under it has no end-side text. |

**Map rules (busbo-grade, Traike marks):**
- Paper map in the `--map-*` tokens. Streets are white 10px (6px for minor streets) with a 1px `#E2D8C8` casing.
- Street labels: Assistant 600 14 `--map-label` with a 3px land-coloured halo. Never covered.
- Route: `--route` 6px (7px on desktop) with a 2px `--surface` casing, round joins. The passed part is `--route-past`.
- Stops are Rings. The finish is a bullseye.
- **Next stop:** an SVG drawing of `pin.png` (30x38 Pine teardrop, 8px `--surface` ring, 4.5px `--leather` core). Its callout sits on the side away from the walker: `--ink` fill, `--surface` text, Assistant 600 16, radius 6, with the time in a time tag.
- **Walker (you):** a 34px `--leather` disc with a 2.5px `--surface` ring and a 1.5px `--ink` outer hairline, holding an 18px `--surface` hiker glyph (the trail-sign hiker).
- Zoom controls are 40x40 paper tags. Attribution is Meta 13 muted.
- **No squares anywhere.**

**The location chip in detail:**

```
inline-flex; align-items:center; gap:8px; height:36px; padding-inline:10px 12px;
border-radius:6px; background:var(--paper); border:1px solid var(--hair-on-art);
box-shadow:var(--paper-lip); font:600 16px/1 Assistant; color:var(--ink);
max-width:62%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
```

The leading marker is the **Now-Ring** (14px, 2px `--ink` rim, `--paper` fill, 6px `--leather` core). Night: fill `#29221C`, text and Ring rim `#F2EADC`, lip `rgba(0,0,0,.7)`. It is tappable (it changes the start), and the lip says so.

Why it will feel related, rule by rule:
- It is made of the **same paper** as the sheet below it and the speech card next to it: same fill, 6px corner, hairline and lip.
- It uses the **same face** as every row (Assistant 600).
- Its marker is **the same Ring** that starts the route list ("18:15 · Habima Garden") and the route on the map, and the same Ring the logo ends in.

So the chip reads as "you are here = stop one of your walk". The square, the smoked glass and the Roboto letters are all gone.

---

## 3. Header and imagery: "the painting is printed onto the sunset"

The owner loved the round-6 Me header: one smooth burnt-orange sky that melts into the sheet. The fix is to keep that sky as the **base** and let the painting **print into it**, rather than laying the painting on top and darkening it.

**Layer stack** (the band has `position:relative; overflow:visible`; the art box has its own `overflow:hidden`):

1. **Sky** = `var(--sky)` filling the whole band. Day stops: `#8A3311` 0%, `#A2420F` 24%, `#B24B12` 46%, `#B85016` 60%, `#D2793A` 71%, `#EAAE7B` 81%, `#F5D9BC` 91%, `--surface` 100%. That is a single vertical gradient with **no side scrim**. I tested a side scrim and it creates a visible seam.
2. **Art box** `.band-art`:
   - `position:absolute; inset-inline:0; top:0; height:var(--art-h)`
   - `background:var(--hero-art) no-repeat; background-size:auto 100%` (fit the height; **never `cover`**). `--art-h` must never exceed 340px, the file's native height.
   - Anchor it with `background-position: right top` (physical) so the tower, sea and hiker sign are always in frame.
   - **Day:** `mix-blend-mode:multiply`. This single choice fixes both problems in the source file:
     - The near-white fog on the left and the pale right sky turn into the sunset itself, so there is no washed-out zone.
     - The plain stone simply vanishes into the gradient.
     - The tower, city, sign and leaves keep their drawn detail as warm rust tones, and the bougainvillea becomes coral instead of clashing magenta.
   - **Night:** `mix-blend-mode:normal; filter:saturate(.9)`. The moon, the lit windows and the stone stay as painted; the blue is confined to the art side by the mask.
3. **Masks** on the art box, intersected (`mask-composite:intersect; -webkit-mask-composite:source-in`):
   - Horizontal: `linear-gradient(90deg, transparent 0 22%, #000 58%)`. The start 22-40% is always pure sky, and that is where the text lives.
   - Vertical, day: `linear-gradient(180deg, transparent 0, #000 30%, #000 56%, transparent 100%)`. The top fade removes the file's blurred top-right smudge (around source x 780-941, y 0-90), which multiply would otherwise turn into a dark smear.
   - Vertical, night: `linear-gradient(180deg, #000 0, #000 56%, transparent 100%)`. There is no smudge, and the moon must stay fully visible.
4. **Content** (z-index above the art).

**Where text sits:**
- Always on the inline-start half.
- White (`--on-art`) text must end above 62% of the band height; that is the 4.5:1 line.
- Below 62% is the melt, and it holds nothing but the guide arch, the speech card and the accessory.
- No text over the tower or the sign, and no text shadows.

**Sizes:**

| Screen | Phone band / `--art-h` | Desktop column band / `--art-h` | Content |
|---|---|---|---|
| Home | 300 / 264 | 300 / 264 | numeral + 1 facts line |
| Plan, Login | 330 / 250 | 330 / 250 | headline + guide + speech card |
| Walk | 280 / 246 | 290 / 256 | numeral "4 min · 310 m" + 1 direction line |
| Walks | 200 / 200 | wide bands: 240 / 240 | title |
| Me | 200, **sky only, no art** (exactly the round-6 Me header: Me is about you, not the place) | 240 | name + email line |

Gutter: 16px on phone, 20px in the desktop column.

**Accessory and guide on the seam.**
- The accessory goes at inline-end, `bottom:-20px`.
- The guide goes at inline-start, overlapping the seam by 18px.
- The speech card's bottom sits 26px above the seam, so it covers only the art's faded base and never the tower.

**RTL.**
- Put `transform:scaleX(-1)` on `.band-art` only. Keep the `background-position:right` and the physical-direction masks as written; the flip mirrors the image and its masks together. The sign and tower move to the left (reading-end), and the calm sky stays on the right where the text starts. Do **not** also reverse the gradient directions.
- Also flip: the brand mark, arrows, the hiker glyph, the speech tail, and the segmented order.
- Do **not** flip: the map, the route geometry, or any digits.

**What I verified by rendering** (screenshots in the session scratchpad):
- Multiply on day gives a deep sunset sky with the city and sign readable; it looks like round-6 Me plus the place.
- The night version looks right with the moon and tower clear.
- The cream paper chip with its Ring reads as part of the sheet.
- Frank Ruhl Libre with Assistant holds up in both scripts.
- The side-scrim variant was rejected (it leaves a visible horizontal edge).

---

## 4. Ready-to-paste section for BRIEF.md

```markdown
# ROUND 8 — OWNER: "ROUND 5 WAS GREAT EXCEPT THE IMAGES; THE ME HEADER OF ROUND 6 WAS GREAT. IT MUST BE UNIQUE AND HIGH QUALITY IN ITS OWN WAY." SPECIFIC COMPLAINT: the location chip (dark glass box + small orange square + "Tel Aviv · Habima") feels unrelated — the dot, the colours, the font.

BASE = the round 7 file (round 5 structure). Keep: layout skeleton, hard-edged sheet, dense hairline rows, solid selected row, the orange primary button with dark lip, giant serif numeral, big guide in his arch with the speech card, map as the star, max ONE 3D accessory, tab bar, desktop rail, toggles setDevice/setLang/setTheme/setScreen, screens home/plan/walk/walks/me/login.
Round 8 fixes COHERENCE. Every element must come from ONE system called "Trail mark on limestone": two primitives + one material + two colour roles. If an element is not built from these, delete it.

## The system
- RING = a stop. 14px circle, 2px ink rim, surface fill. NOW-RING adds a 6px leather core (= the face of assets/pin.png). It is the ONLY point symbol in the app: location chip, list stops, map stops, logo, map-pin face. No squares, no plain dots anywhere.
- TRAIL = a round-capped line in Pine Ink: the map route, the 2px spine through the stop list, the logo, icon strokes.
- PAPER = anything on top of the art or the map is a cut piece of the sheet: surface fill, radius 6, 1px hairline, 2px ink lip beneath (box-shadow 0 2px 0). Never dark glass.
- LEATHER #D2602F = "go / you / now" ONLY: the one primary button, ring cores, the current-stop time tag, walker marker, map-pin core. Text on leather = #111915, never white.
- PINE INK #1B2620 = text, outlines, route, and EVERY selected state (vibe chips, time segment, tab pill, current row). It reads black but matches the boot sole / pin body / compass bezel.

## Tokens (use exactly)
Day: surface #F8F3EA, surface-2 #F0E8DA, line #DDD2C0, ink #1B2620, muted #5E584D, leather #D2602F, on-leather #111915, lip #1B2620, route-past #B4AA9A, spine #CBBFAD, on-art #FFF5E8, map land #F2ECE1 / block #E6DDCD / park #DCE3D2 / water #C9DADF / road #FFF / label #6A6357.
Sky (day): linear-gradient(180deg,#8A3311 0%,#A2420F 24%,#B24B12 46%,#B85016 60%,#D2793A 71%,#EAAE7B 81%,#F5D9BC 91%,var(--surface) 100%).
Night: surface #1A1613, surface-2 #231E19, paper #29221C, line #3A322A, ink #F2EADC, muted #B5AA99, leather #E06A38, on-leather #111915, button lip #6E2A0F (border #0E0B09), selected fill #EDE3D3 with text #1A1613, route #F2EADC, route-past #5F574D, spine #4A4038, on-art #FFF1DE, map land #1F1B17 / block #29231E / park #232A22 / water #1B272C / road #2E2822 / label #A69B8B.
Sky (night): linear-gradient(180deg,#120E0C 0%,#1A130F 30%,#26180F 55%,#2A1C13 66%,#231A14 82%,var(--surface) 100%).

## Type (replace Fraunces and Heebo everywhere)
Load: https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@600;700&family=Assistant:wght@400;600;700&display=swap
- Frank Ruhl Libre (Hebrew + Latin, same face both languages): 700 = hero numeral + wordmark; 600 = the one headline per screen + speech title.
- Assistant (Hebrew + Latin): 400 body, 600 rows/labels/chips, 700 buttons.
- Sizes (phone/desktop): Hero 72/88 (lh .86, -0.03em) · Title 28/34 · Lead 18 (row names, buttons, unit) · Body 16 · Meta 14 (times, helper, tab labels). Nothing under 14 (map attribution 13).
- Hebrew: letter-spacing 0, body lh 1.5, use ״ ׳ (ק״מ, דק׳, מ׳), wrap digits in <bdi>. Times tabular in a fixed 52px column. NO text-shadow anywhere.

## Shape
Radius 6 on every control (buttons, chips, paper tags, inputs, segmented, tab pill, speech card, map callouts); 4 on nested items (thumbnails, time tag); 0 on rows/sheet; full-round only for the Ring and the arch top. Strokes: 1px line = row rules; 1.5px ink = control outlines; icons 22px custom SVG, stroke-width 1.75 on a 24 viewBox, round caps/joins; route 6px phone / 7px desktop with 2px surface casing. Only shadows: paper lip, primary-button lip, one drop-shadow on the 3D accessory.

## Components
- LOCATION CHIP: paper tag, height 36, padding-inline 10px 12px, gap 8, Assistant 600 16 ink, leading NOW-RING, label specific-first "Habima · Tel Aviv" / "הבימה · תל אביב", max-width 62% with ellipsis. Night: fill #29221C, text + ring rim #F2EADC. It is the only chip on the band.
- PAPER TAG (map summary "4 stops · 4.1 km", zoom buttons): same build; leading item = Ring (place) or the 20px Walks icon (info).
- TIME TAG: leather fill, on-leather Assistant 700 14 tabular, h 26, radius 4, no border. Only for the current/next stop's time (selected row, map callout). Never on the band; delete the floating "18:15" / "ETA" stickers.
- PRIMARY BUTTON (round 5): h 52, radius 6, leather, on-leather Assistant 700 18, 1.5px ink border + 4px ink bottom lip (night lip #6E2A0F), pressed = translateY(2px) + 2px lip. ONE per screen on desktop too: remove the rail's "Plan my walk"; "Start live walk" only where it is the primary.
- SECONDARY: h 44, radius 6, surface, 1.5px ink outline, Assistant 700 16, no lip.
- SEGMENTED: 1.5px ink outer, radius 6, 44px cells, 1px line dividers, 600 16 tabular; selected = Pine fill + surface text (night: #EDE3D3 + #1A1613). Orange stays reserved for the action.
- VIBE CHIPS: h 44, radius 6, 1.5px ink, 30px photo radius 4, Assistant 600 16; selected = Pine fill.
- STOP ROWS: 52px time | 22px Ring | name Lead 18/600 | tag Meta 14 muted; min-h 52; a 2px spine (#CBBFAD) joins the Rings across rows. Current row = solid Pine, surface text, time tag, ring rim surface + leather core. Past stop = 10px solid route-past dot.
- WALK ROWS: 48px mini-map tile (map-land, radius 4, 1px line) with the real route in a 2.5px Trail, start Now-Ring, finish bullseye. Delete the clip-art glyph boxes.
- TAB BAR (round 5): 1.5px ink top rule, 52px tabs, selected = Pine pill radius 6. Custom icons: Home house; Plan = brand mark; Walk = the hiker-with-stick from the painted trail sign; Walks = two rings + curve; Me = head ring + shoulder arc. No Lucide.
- BRAND: 26px mark = trail curve rising to a Now-Ring (cream/on-art on the band, ink on the sheet) + "Traike" Frank Ruhl 700 24. The orange logo tile is retired.
- SPEECH CARD: paper, radius 6, padding 12/14, title Frank Ruhl 600 18, body Assistant 400 16 muted, max 2 lines, 12px tail toward the guide.
- GUIDE ARCH (round 5): 136x184, radius 68 68 6 6, object-position 50% 0, no mask/border, overlaps the seam by 18px.
- MAP: paper map tokens, streets 10/6px white with 1px #E2D8C8 casing, labels Assistant 600 14 with 3px land halo, never covered. Route ink 6/7px + 2px surface casing, passed part route-past. Stops = Rings; finish = 20px ring with 8px ink core. Next stop = SVG of pin.png (30x38 Pine teardrop, 8px surface ring, 4.5px leather core) + ink callout (surface text 600 16, radius 6, time tag) placed on the side away from the walker. Walker = 34px leather disc, 2.5px surface ring, 1.5px ink hairline, 18px surface hiker glyph.
- 3D ACCESSORY: max one, 60px, on the seam at the band's inline-end (bottom -20px), never on text. Home compass, Walk pin.png, Walks boot. None on Plan/Login/Me.

## Header band ("the painting is printed onto the sunset")
1. Band background = the sky gradient only (no side scrim; it leaves a seam).
2. Art box .band-art: absolute, top 0, full width, height = --art-h; background: assets/city-hero-day.jpg (night: city-hero-night.jpg) no-repeat; background-size: auto 100% (NEVER cover, never taller than 340px); background-position: right top.
   Day: mix-blend-mode: multiply (the pale sky + plain stone become sunset; tower/sign/leaves keep their detail).
   Night: mix-blend-mode: normal; filter: saturate(.9).
3. Masks on the art box, intersected (mask-composite: intersect; -webkit-mask-composite: source-in):
   horizontal linear-gradient(90deg, transparent 0 22%, #000 58%);
   vertical day linear-gradient(180deg, transparent 0, #000 30%, #000 56%, transparent 100%) (hides the file's blurred top-right smudge);
   vertical night linear-gradient(180deg, #000 0, #000 56%, transparent 100%) (keep the moon whole).
4. Text lives on the inline-start half and must end above 62% of the band height (white on #B85016 = 4.6:1). Below 62% is the melt: only the guide, speech card and accessory go there.
5. Sizes (phone band / art-h): Home 300/264 · Plan & Login 330/250 · Walk 280/246 · Walks 200/200 · Me 200, SKY ONLY, no art (= the loved round-6 Me header). Desktop column: Home 300/264, Plan 330/250, Walk 290/256; wide desktop bands 240/240. Gutter 16 phone, 20 desktop column.
6. RTL: transform: scaleX(-1) on .band-art only. Keep background-position right and the physical mask directions; the flip mirrors image and masks together (sign + tower to the left, calm sky + text on the right). Also flip brand mark, arrows, hiker glyph, speech tail, segmented order. Do NOT flip the map, route geometry or digits.
7. Band content per screen: top bar = brand (start) + location chip (end). Home: numeral "65 min" + one facts line ("4.1 km · Golden-hour walk to Jaffa Port"). Walk: numeral "4 min · 310 m" + one direction line; the chip becomes "Stop 2 of 4 · ETA 19:20". Plan/Login: headline + guide + speech card. Walks: title. Me: name + email line.

## Self-check (answer every line before returning)
- [ ] Is every point symbol on every screen a Ring (or the pin, whose face is a Ring)? Zero squares, zero plain dots?
- [ ] Is leather used only for: one primary button, ring cores, current-stop time tag, walker, pin core? Count the orange things per screen: 1 big + small "now" marks only.
- [ ] Is every selected state the same Pine fill (chips, segment, tab, row, rail)?
- [ ] Is every element on art/map paper (cream, radius 6, hairline, lip)? No dark glass anywhere?
- [ ] Only Frank Ruhl Libre and Assistant loaded and used; Hebrew in the same faces; nothing under 14px; no text-shadow?
- [ ] Only radii 6 / 4 / 0 / round? Only the three allowed shadows?
- [ ] Day band: multiply art, no washed-out right side, no muddy pink, no visible smudge or seam; white text above the 62% line; art never upscaled past 340px tall?
- [ ] Night band: moon whole, blue only on the art side, melts into #1A1613 with no edge?
- [ ] Hebrew: art mirrored, text on the right on calm sky, ״ ׳ used, digits isolated, zero overflow at 390?
- [ ] Desktop: exactly one primary button visible; map labels never covered; callout never overlaps the walker?
- [ ] Bans: no green dots/pills, glows/orbs, purple/blue gradients, nested cards, accent-rail borders, border-only selection, eyebrow labels, emoji, Inter/Heebo/Fraunces/default Lucide, text <13px.
- [ ] Would someone who loves round 5 call this "the same app, finally made by one hand"?
```
