# Traike — app interface redesign brief (for the design model)

## Product
Traike is an AI walking companion (Israel first, tourists + locals; Hebrew RTL and English LTR, both must be first-class). You tell it where you are and how long you have (or chat with the assistant), it builds a walking route with places on the way, then guides you live (next stop, off-route help, finish). Screens inside the app: Home, Plan (map + request form + the AI assistant chat), live Walk (map + bottom sheet), My walks, Social (friends' walks), Me (account, settings), Login.

THIS IS A REDESIGN OF THE APP INTERFACE (screens people use), NOT the marketing website.

## Goals (owner's words, paraphrased)
- Phone AND desktop, both done properly. Hebrew AND English.
- Minimal style, like busbo's latest rounds (attached as ref-busbo-*): clean, sharp, every element has a job, clear hierarchy. But ADAPTED to Traike's own colours and feel (do NOT copy busbo's yellow; Traike is warm terracotta + forest green + cream).
- Not over-stuffed: obvious what to do next, short explanations, easy to navigate, understood in seconds.
- The assistant/chat area should show the assistant as a presence (a small character/mark, a friendly header) and have a tasteful atmospheric background at the TOP of the screen (hero band: landscape/trail illustration or photo-like wash) — but calm, never loud.

## Rules for app UI (from our GUI wiki — obey)
One screen = one question and ONE primary action. Heading ≤ 6 words, helper ≤ 1 line; anything longer goes behind "more" or a help page. Progressive disclosure: show the 20% needed now. Buttons are verbs. Empty states teach (1 line + 1 button). Numbered steps for rare flows. Same action = same word/icon/place everywhere. Status always visible (loading, saved, where am I). Error text beside the field, plain words. Tap targets ≥ 44px, body text ≥ 16px phone, nothing under 13px, contrast ≥ 4.5:1 in day AND night. Tokens by ROLE (surface, ink, muted, line, primary, danger), swapped per theme in one place.

## Brand (keep, refine allowed)
Terracotta `#c15f3c` (primary action; deeper `#b5512b` wordmark), forest `#1e3d2f` (headings, ink), cream `#fbf8f4`, warm card `#fcf7f0`, line `#efe7dc`, charcoal `#231f1c`, sky-soft `#8fb8c9`, route green `#25604b`, sage `#5f6f5d`. Night = warm dark charcoal with the same terracotta. Fonts available: Secular One (display, Hebrew+Latin) and Heebo (body) — you may propose a better pair with a reason (must support Hebrew). Existing assets: 3D compass, hiking boot, sunset mountain-lake photo wash, trail line illustrations, empty-state illustrations.

## Current UI problems (see cur-* screenshots)
1. Plan screen is a long stack of form cards (lat/lng fields, time, radius, max distance, pace…) — intimidating. Needs: one clear primary path ("where/how long" or ask the assistant), advanced options hidden.
2. Many cards-in-cards, small grey helper text, inconsistent buttons.
3. Phone Plan: map on top then a long scroll; unclear what to do first.
4. Home is sparse and the blurry photo background looks washed out; two cards only.
5. Chat/assistant is just a text box without personality.
6. Hebrew view must be truly mirrored (start side = right), icons that imply direction flip.

## Hard bans (AI-slop)
Green dots/pills as decoration; glow, blobs, orbs; purple/blue gradients, gradient cards/text; left accent-rail borders on cards; border-only selected states; decorative badges; eyebrow labels; wide letter-spacing on real text; Inter, default Lucide; nested cards; emoji; legends; tiny text. Prefer hard-edged, small radii (4–10px), 1px hairlines, solid-fill selection, custom inline SVG icons.

## Stack constraints
React + Tailwind v4 with CSS custom properties; Leaflet/Google map stays (just style around it). Output must be implementable as one token file (`:root` + `:root[data-theme=night]`) plus component styles. Logical CSS props only (inline-start/end).

## What to return
Return ONE self-contained HTML file (in ONE fenced ```html block) that shows the design as a clickable-looking gallery with a toggle for Hebrew/English, day/night, and phone/desktop frames, covering: (A) Home, (B) Plan with the assistant chat (hero band at top, assistant presence, one primary input, advanced options collapsed), (C) live Walk bottom sheet over a map, (D) My walks, (E) Me/settings, (F) Login. Then 6 bullets: tokens (colors both themes, type scale ≤5 sizes, radii, shadows), what you removed, the hero element of each screen, RTL decisions, and what is still weak. No React code. Use inline SVG/CSS only (no external images); you may reference our fonts via Google Fonts.

---
# ROUND 2 — OWNER FEEDBACK ON ROUND 1 (overrides earlier lines where they conflict)
Owner verdict on round 1 (see shot `rejected-r1-phone-plan`): "boring, not high quality — even the CURRENT app looks better, especially the character + chat part, which makes more sense. I expected a more ORANGE/SUNSET atmospheric background, and overall something higher quality and much more fitting for an app."
What went wrong: round 1 was a flat beige/cream wireframe — generic "Ori" cairn icon instead of our real guide, no photography, no 3D, flat wash band with a stray circle colliding with text. It threw away the identity that works.

## KEEP / REUSE (real assets, attached as screenshots and available in the HTML as relative paths `assets/<file>`)
- THE GUIDE: an illustrated, smiling bearded hiker with camera and backpack, cut out at bottom-left of the chat card, leaning into the card (`assets/guide.jpg`, night `assets/guide-night.jpg`; soft cream background with leaf motif — blend/mask it into the card, e.g. radial or linear mask, no hard rectangle). The chat is "Chat with Traike": the guide stands bottom-start, his speech bubble beside him, below it a row of 5 THEME CHIPS with small photo thumbnails (`assets/must-see.jpg`, `food.jpg`, `viewpoints.jpg`, `nature.jpg`, `hidden.jpg`: Must-see places / Food & markets / Viewpoints & scenery / Nature & parks / Hidden gems), then the text box "I want to see Habima Square, the Jaffa port, and a good market" and the primary button. Keep this logic (it makes sense to the owner) but make it far more polished.
- WARM SUNSET ATMOSPHERE: `assets/hub-mountain-lake-sunset.png` (peach/orange/gold mountain-lake sunset), `assets/hub-night.jpg`, `assets/auth-terra-gradient.jpg`, `assets/hero-tent-sunrise.jpg`, `assets/meadow-hiker.jpg`. Use these photos (cropped, with a warm wash for legibility) as the TOP background band on Home, Plan/chat, and Login — rich orange/terracotta/gold, not beige. It must feel premium and alive, but text on it stays perfectly legible and the functional area below stays calm (not over-stuffed).
- 3D ACCESSORIES (glossy, photoreal): `assets/compass.png`, `assets/boot.png`, `assets/pin.png`, and accessory PNGs `assets/backpack.png`, `binoculars.png`, `bottle.png`, `camera.png`, `hat.png`, `signpost.png`, `tent.png`, `thermos.png`, `bench.png`, `footprints.png`, `stick.png` (any .png in `assets/` not listed in the shots exists too). ONE per main screen, tied to meaning, never covering text/controls (compass = new route, boot = my walks, pin = places/walk, etc.).
- Trail-line and empty-state illustrations exist (do not redraw: describe slots).

## WHAT TO DELIVER (same format: ONE html block, then 6 bullets + honest critique)
Same 6 screens (Home, Plan + guide chat, Live Walk, My Walks, Me/Settings, Login), toggles EN/HE, day/night, phone/desktop. Targets:
- QUALITY and personality like a premium consumer travel/outdoor app (think the best of Airbnb-trips / AllTrails Plus / Apple Maps guides): rich photography wash at the top, glossy 3D accent, confident big display type (Secular One), generous but purposeful space, crisp functional sheet below. Orange/terracotta-dominant warmth with forest-green ink; night = deep warm charcoal with sunset-glow photo (hub-night).
- Still minimal and clear: one primary action per screen, short copy, easy navigation, advanced options collapsed. The guide + chat on Plan is the hero of the app: make that screen the best one.
- Keep it NOT cluttered: at most ONE accessory + ONE photo band per screen.
- The bans from round 1 still apply (no slop, no glow orbs, no nested cards, no emoji, no tiny text). External images ARE now allowed only from `assets/`.
- Phone: bottom tab bar, map-first on Plan only when building; desktop: left rail + 2-column Plan (map right in LTR / left in RTL logic mirrored).
- Fix round 1 bugs: nothing overlapping text; primary button never hidden behind the map; Home has no dead empty area.

---
# ROUND 3 — OWNER REJECTED ROUND 2 TOO (overrides everything above where it conflicts)
Owner verdict on round 2 (shots `rejected-r2-phone-plan`, `rejected-r2-desktop-plan`): "not good — what exists today (cur-* shots) is better. It must be PROFESSIONAL, BEAUTIFUL, TAILORED to the product, HIGH QUALITY, PLEASANT TO THE EYE and UNIQUE."
What "unique" means to the owner: mainly the SHAPE and ORGANISATION of the interface, expressed through the typefaces, the backgrounds and the buttons. It must look professional and pretty AND make clear at a glance what the product is here to deliver (an AI guide that builds you a walking route).

Why round 2 failed (diagnosis — do not repeat):
- It looked like a generic template: a cropped photo strip on top, a flat cream sheet below, generic rounded buttons. Any app could wear it.
- The sunset band was a thin faded strip; the sheet under it was plain. The atmosphere stopped after 100px.
- Typography was one decent display face + system sans; no hierarchy of character. Buttons were ordinary flat rectangles/pills.
- The guide was a photo pasted in a box, not integrated into the composition.
- The home screen under the hero was a plain form card + list: nothing said "walking route AI".

What round 3 must do:
1. A DISTINCT SHAPE LANGUAGE owned by Traike (e.g. a trail-/route-derived motif: a winding path line, a topographic contour, a waymarker/trail-blaze shape, an arch like a trail sign) used consistently for sheets, buttons, chips, tab bar and the map pin — not generic 12px rounded cards. Pick ONE and commit; describe it in a short design-language note.
2. A real typographic voice: a characterful display face for headlines (not Inter/Roboto/system), a clean text face, deliberate scale and weight contrast; Hebrew must be set with an equally good Hebrew face, not a fallback.
3. Atmosphere: large, immersive sunset-orange backgrounds that carry through the screen (full-bleed behind the chat top and home, with the content sheet shaped to the motif), day AND a rich dusk-night variant. Use the real photos in gemini/assets/.
4. Buttons with craft: the primary action should feel premium and tactile in terracotta/orange (depth, edge, pressed state), consistent everywhere; secondary actions clearly quieter.
5. The guide character is part of the composition (overlapping the sheet edge, large, with a speech bubble that belongs to the shape language), visible in the chat area on phone AND desktop.
6. Purpose visible at once: home/plan show a route idea (a route line with stops, a time + vibe -> route), not just a form. One glossy 3D accessory per screen max.
7. Not over-stuffed, short explanations, clear primary action per screen. Keep all prior bans (no green dots/pills, glows/orbs, purple/blue gradients, nested cards, accent-rail borders, emoji, tiny text <13px).
8. Deliver all 6 screens, phone + desktop, EN + HE (RTL), day + night, same toggles as before (setDevice / setLang / setTheme / setScreen functions with data-screen ids home, plan, walk, walks, me, login). Aim higher than the current app, not lower.

---
# ROUND 4 — OWNER: ROUND 3 "LOOKS BORING". LOOK AT BUSBO (shots ref-busbo12-*) — THAT is the quality and uniqueness bar.
Owner verdict on round 3 (shots `rejected-r3-*`): "looks boring". Rounds 1-3 were all rejected. The owner points to the sister product busbo (shots `ref-busbo12-desktop`, `ref-busbo12-phone`, `ref-busbo12-night`) as the example of high-quality AND unique.

WHY busbo works (study the shots; reproduce the FORMULA, never copy busbo's yellow/bus/Hebrew-only content):
1. A BESPOKE ILLUSTRATED SCENE as the hero: a crisp flat-vector inline-SVG street scene (3 tonal planes, perspective, a yellow bus, a sun) that tells the product story at a glance. It is NOT a stock photo and not a soft gradient. Traike's equivalent: a hand-built flat-vector SVG LANDSCAPE — layered ridgelines in 3-4 tonal planes, a big orange sun/low sun disc, a winding trail with waymarkers, a tent or lookout, small hiker figure on the path — in the Traike palette (terracotta/orange sun, deep forest-green and charcoal-ink shadow planes, warm cream sky). Tall on desktop, compact (~120-160px) on phone. Dusk-night variant with the same scene recoloured (moon, lit tent).
2. THE KEY DATA IS THE HERO: a GIANT serif numeral with tight leading (busbo: "3" minutes) — for Traike: the walk time / distance ("65" min, "4.1" km) as the biggest element, tabular, in a premium serif (Frank Ruhl Libre / Fraunces-class + a clean UI face; Hebrew set with an equally strong Hebrew serif/sans). Plus one solid-colour pill with a time/chip.
3. THE MAP IS THE STAR where there is a map: warm-paper map, route as a THICK ink line (past route grey, upcoming route dark ink), HOLLOW stop dots, a big custom pin with a callout label, a custom ILLUSTRATED marker for the walker/guide (not a plain dot). Street names must not be covered.
4. HARD-EDGED FUNCTIONAL SHEET under/next to the scene: small radius (4-8px), 1px ink-tinted hairlines, dense orderly rows where every row has a job (timeline with times and stop names), SOLID-fill selected states, segmented controls with a solid ink fill, ONE decisive primary button in the accent colour (busbo yellow -> Traike terracotta-orange) with ink text/edge. Ink is near-black warm charcoal; background warm stone/cream. High contrast, crisp, confident. Nothing soft, pastel, or blobby.
5. Few colours, used decisively: warm stone/cream, charcoal ink, ONE orange accent (sun + primary + selected), forest green only as a small supporting ink (route/ok), never as a big fill.
6. Everything has a purpose: no decorative filler. One idea per screen.

APPLY IT TO TRAIKE (all 6 screens, phone + desktop, EN + HE RTL, day + dusk-night, same function names/toggles as before: setDevice/setLang/setTheme/setScreen, screens home, plan, walk, walks, me, login):
- HOME: tall SVG landscape scene with the sun; giant "65 min" style hero numeral for the suggested walk ("Tonight: 65 min · 4.1 km"); route timeline rows (stop, time, one-word tag); ONE orange primary "Plan my walk". Recent walks as dense hard-edged rows.
- PLAN/CHAT: the real GUIDE CHARACTER (assets/guide.jpg, guide-night.jpg) in a crisp frame at the top beside/over the scene with a hard-edged speech sheet; the 5 PHOTO theme chips (must-see, food, viewpoints, nature, hidden gems — real photos from assets/) as solid-fill selectable tiles; request box; time segmented control; ONE orange "Build walking route". Desktop: the map is the star on the left with the thick ink route, hollow stops, pin + callout, illustrated hiker marker; chat sheet on the inline-start side per RTL rules.
- LIVE WALK: giant "next stop in 4 min"/distance numeral over the scene or map, thick ink route, illustrated hiker marker, timeline of stops with the current one highlighted in a solid bar.
- MY WALKS / SOCIAL: hard-edged list rows with a mini route glyph; ONE 3D accessory max.
- ME / SETTINGS and LOGIN: same sheet language; login uses the scene as its top band with the real guide.
- Keep the real assets (guide, photos, 3D compass/boot/pin PNGs) and the existing ban list (no green dots/pills, glows/orbs, purple/blue gradients, nested cards, accent-rail borders, border-only selection, eyebrow labels, emoji, Inter/default Lucide, tiny text <13px). No demo/state bars inside the product frame. Honest, zero overflow at 390px.
- Round 3's arch-shaped corners/chamfer buttons were NOT the answer; do not preserve them unless they serve the hard-edged busbo formula.

---
# ROUND 5 — OWNER: "BETTER" (round 4 = shots r4-*), BUT THE TOP PART IS NOT LOVED
Owner verdict on round 4: "much better". Keep ALL of it EXCEPT the top area. He disliked the TOP part (shot `r4-phone-plan`): the small flat-vector scene strip with a tiny sun, a tiny hiker and a tent, which is then cut by a black band and overlapped by the guide card + speech bubble. It reads small, flat, cluttered and cheap next to the rest. He explicitly said: take some INSPIRATION from the EXISTING app (shots cur-* and the real assets: guide.jpg / guide-night.jpg, hub-mountain-lake-sunset.png, hero-tent-sunrise.jpg, meadow-hiker.jpg, auth-terra-gradient.jpg) combined with the good style from round 4.

KEEP from round 4 (approved style): hard-edged functional sheet (small radius, hairlines, dense rows), giant serif numeral hero data ("65 min", "4 min"), the map as the star (thick ink route, hollow stops, big pin with callout, illustrated marker), solid-fill selections, segmented time control, ONE decisive orange primary button with a dark lip, orange + charcoal ink + warm stone, the serif logo, photo theme chips, bottom tab bar / desktop side rail, EN/HE RTL, day + dusk-night, same toggle functions (setDevice/setLang/setTheme/setScreen; screens home, plan, walk, walks, me, login).

REDO the TOP of every screen:
1. Use the REAL immersive sunset atmosphere from the existing app: a large, rich orange/amber/terracotta sunset photographic background (hub-mountain-lake-sunset.png for day, hub-night.jpg for dusk; hero-tent-sunrise / meadow-hiker for variety) as a TALL full-bleed band (phone ~240-300px, desktop taller) with a warm scrim so the white serif headline stays crisp. It must feel big, atmospheric, warm and premium — not a thin strip.
2. The GUIDE character is BIG and clean in the chat top: a large cut-out/mask of the real guide (assets/guide.jpg) standing on the band, overlapping the band's bottom edge into the sheet, NOT cropped by a black band, NOT covered by a card. His speech bubble sits beside him as a hard-edged sheet card with a small tail, fully readable, not overlapping him. Remove the black ground band and tiny props entirely.
3. Hard-edged sheet starts below the band with a crisp straight edge (small radius), as in busbo (scene above, sheet below). Where a hero numeral belongs (home, live walk) it sits ON the band in white serif, large, with the key route facts underneath, instead of an illustrated scene.
4. At most ONE small glossy 3D accessory per screen, never colliding with text (compass on home, pin on walk, boot on walks, signpost on login).
5. Optional tasteful touch: a thin hand-drawn trail line or route glyph crossing the band, as part of the atmosphere — only if it stays clean.
6. Keep the Hebrew/RTL perfect and zero overflow at 390px. Same ban list as before (no green dots/pills, glows/orbs, purple/blue gradients, nested cards, accent-rail borders, border-only selection, eyebrow labels, emoji, Inter/default Lucide, text <13px).


# ROUND 6 — OWNER: "BETTER, BUT A BIT 'AI' AND NOT SMOOTH WITH THE REST OF THE PAGE STRUCTURE"
Owner verdict on round 5 (shots `r5-*`): "better, but feels a little AI and a little not smooth with the rest of the page structure. Try another round."

Diagnosis (look at r5-phone-home, r5-desktop-plan, r5-phone-walk and compare with cur-* = the real app, which the owner likes the atmosphere of):
1. It is a STACK OF SEPARATE BLOCKS: black title bar, photo rectangle, hairline-ruled sheet, black selected row, black tab bar. Every block has its own hard edge, so nothing flows. The real app is ONE continuous warm surface: the photo melts into the panel, the panel floats over the map.
2. Too much pure black fill and too many 1px rules (black selected rows, black selected chips, black tab pill, black map pill). That reads "generated dashboard". Use warm ink only for text and the route line; selection = soft orange tint + orange hairline + bold text, or a small orange marker, NOT a black block.
3. The photo band is a hard rectangle with a pasted-on look (headline sits on busy mountains, compass floats, dashed line crosses text). Make it a blended hero: photo fades with a long smooth gradient into the surface colour (no visible bottom edge), headline on a calm part with enough scrim, no floating decoration over text.
4. Content is generic template copy in generic rows ("Tonight's suggested route" etc.). Make rows feel like the product: time on a vertical route spine with stop dots connected by a thin trail line (the route itself is the list), place photo thumbnails (use the real theme photos), walking minutes between stops.
5. Inconsistent spacing/radius. Use ONE 8px grid, ONE radius family (cards 14px, controls 10px, pills full), ONE shadow level, ONE hairline colour. Same horizontal gutter on every screen.

REQUIREMENTS for round 6:
- Layout skeleton must match the real app's structure: DESKTOP = slim icon rail on the left, a ~440px soft panel (rounded, slightly translucent warm cream, soft single shadow) FLOATING over a full-bleed real-looking map; the sunset photo only as the blended header of that panel. PHONE = full-bleed map or full-bleed photo hero on top, a rounded bottom sheet (20px top radius, grab handle) that overlaps it; floating bottom nav inside the same cream surface (no black bar).
- The map is real-looking (cream land, soft green parks, pale blue water, thin white streets with names), not abstract blocks; thick warm-ink route with hollow stops, one big orange pin with a name label.
- Keep: giant serif numeral on home/walk, ONE orange primary button (soft lip, not a hard black underline), serif logo, real guide cut-out clearly visible in the chat (phone + desktop) standing on the panel header with the speech card beside him, photo theme chips, EN/HE RTL, day + night, same toggle functions and screens (home, plan, walk, walks, me, login).
- Segmented controls and chips: selected = solid orange or orange tint with orange text, unselected = cream with hairline. Tab bar selected = orange icon + label with a short orange underline, no black pill.
- Typography: serif display (e.g. Fraunces/Newsreader) only for logo, giant numerals and 1 headline per screen; one humanist sans (e.g. Figtree/Instrument Sans/Heebo for Hebrew) for everything else; min 14px body.
- Keep every earlier ban (no green dots/pills, glows/orbs, purple/blue gradients, nested cards, accent-rail borders, border-only selection, eyebrow labels, emoji, Inter/default Lucide, text <13px), zero overflow at 390px, Hebrew perfect.
- Self-check before answering: would a person who loves the current app see this as the SAME product, only far better? If any block looks pasted on, fix it.


# ROUND 7 — OWNER: "ROUND 5 WAS GREAT, ONLY THE IMAGES WERE NOT GOOD. BUTTONS AND ALL THE REST LIKE ROUND 5."
Owner verdict (after rounds 5 and 6): Round 5 was great EXCEPT the images. The header he loved in round 6 is the ME screen (`r6-phone-me`): a smooth warm sunset gradient that melts into the surface. The round-4 flat vector illustrations are also not good. He wants "something in the middle that fits the app". And: "all the buttons and the rest should be like round 5."

THEREFORE:
1. BASE = THE ROUND 5 FILE (supplied as source below). Keep it exactly: layout skeleton, hard-edged sheet, hairline rows, solid black selected row/chip/tab pill, segmented controls, the orange primary button with dark lip, chips, map, the big guide in his arch with the speech card, giant serif numeral, 3D accessories, tab bar, desktop rail. Do NOT adopt round 6's floating panel, soft rounded sheet, tinted selections or orange-underline tab bar. Buttons/controls/rows/tab bar = identical to round 5.
2. CHANGE ONLY THE IMAGERY AND THE HEADER BAND:
   - Remove the alpine mountain-lake photo (wrong place: Traike is Israeli CITY walking, not alpine) and any flat vector scene.
   - New header = round-6 "Me" style: smooth warm sunset gradient (deep terracotta/amber at the top fading to the surface cream/dusk-charcoal with a long smooth fade, no hard bottom edge) PLUS the app's OWN painted Mediterranean old-city art, supplied as `asset-city-hero-day` / `asset-city-hero-night` (stone wall, iron lantern, bougainvillea, church tower over the sea, hiker trail sign, olive leaves). Use these real files at their native warm colours: place the image on the header (cover, aligned so the lantern + tower + sign remain visible and not cut), blend it with a warm gradient overlay so it sits in the same orange family, with enough scrim under white text. The headline/numeral sits on the calm stone-wall (left) part, never over the tower or sign. Night uses the night file (moon, lit lantern).
   - Reuse the same art on every screen as the band (different crop/height per screen: tall on home/plan/walk, shorter on walks/me/login). `asset-empty-walks` (hand-drawn footprints + flag) may be used for empty states.
   - The guide stays big and uncropped on the plan chat as in round 5.
3. Keep Hebrew/RTL perfect (mirror the art crop so the sign sits on the reading-end side), zero overflow at 390, same ban list, same toggle functions and the 6 screens.


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


# ROUND 9 — OWNER: "OK, BUT MORE UNIQUE AND HIGH QUALITY, AND WHY IS EVERY SCREEN THE SAME AT THE TOP?" + "THE TOP IMAGE NEEDS A COMPLETE REDESIGN." + "GIVE GEMINI MORE FREEDOM IF IT UNDERSTANDS THE PRINCIPLES."

You have more freedom this round. Below are principles and hard limits, not pixel recipes. Decide the compositions yourself.

## What stays (approved, do not touch)
Everything below the header: hard-edged sheet, dense rows, solid Pine selected row, ONE leather primary button with dark lip, giant serif numeral, map as the star, Ring/Trail/Paper identity from round 8, Frank Ruhl Libre + Assistant, cream-paper location chip with Ring, tab bar, desktop rail, tokens from round 8. The Me header (smooth sunset gradient, no art) was loved.

## What you redesign: the whole top of every screen
Owner: the top image/header needs a complete redesign. Round 8 failed because (a) the same city-painting strip with the same tint sat on every screen, (b) the day tint was muddy brown-purple, (c) on phone Home there was empty orange area under the text, (d) the compass touched the header/sheet seam.
Principles:
1. EACH SCREEN GETS ITS OWN TOP, built as one family (same sky language, same Ring/Trail/Paper vocabulary, same melt into the sheet) but a different composition: Home, Plan, Walk, Walks, Me, Login must not be recognisable as the same header with different text.
2. Make the sky beautiful first: a clean, smooth sunset (day) and dusk (night) gradient like the loved Me header. Art is an accent in that sky, never a tinted photo strip. If an asset looks muddy, washed out or blurred after blending, do not use it. Fewer, better elements beat a full-width picture.
3. Use only real assets and vector you draw: assets/city-hero-day.jpg / city-hero-night.jpg (crop, mask or use only the parts that look good; day file is washed out on the right and plain on the left), guide.jpg / guide-night.jpg, compass.png, boot.png, pin.png, empty-walks art, theme thumbnails, the real map. You may draw Trail lines, Rings, simple skyline silhouettes or a sun disc in SVG/CSS if they look crafted, not clip-art. Traike is Israeli city walking: no alpine mountains, no tents.
4. Every header carries meaning for its screen: Home = invitation to the suggested walk (maybe the route trail climbing into the sky); Plan = conversation with the guide; Walk = live, the next turn, may be map-led; Walks = your history; Me = calm sunset only; Login = welcome. You may propose that a header shows the map or a route trail instead of a picture.
5. No empty colour block, no element touching the header/sheet seam by accident, nothing covering text. Text on the sky must keep AA contrast.
6. Dimensions are yours to choose, but the sheet must start no later than round 8 (phone <= 330px band) so the content stays above the fold.
7. RTL: a Hebrew screen is a designed mirror, not a flipped image with broken composition. Check each header in HE.
8. Day and night are both first class; night must not just darken day.

## Deliverable
ONE self-contained HTML file, same toggles setDevice/setLang/setTheme/setScreen, screens home/plan/walk/walks/me/login, phone 390 + desktop 1180, EN + HE, day + night. Asset paths assets/... Output only the HTML.
Inside the HTML, in an HTML comment at the top, give 3 lines per screen: what the top shows and why, so the owner can read the intent.

## Self-check (answer in the comment too)
- [ ] Put the six phone tops side by side: are they six distinct compositions of one family?
- [ ] Is the sky smooth, with no muddy tint, seam or smudge, day and night?
- [ ] Any empty area, collision, or text under 14px or below AA?
- [ ] Is everything below the header unchanged from round 8 apart from header-driven spacing?
- [ ] Bans: green dots/pills, glows/orbs, purple/blue gradients, nested cards, accent-rail borders, border-only selection, eyebrow labels, emoji, Inter/Heebo/Fraunces/default Lucide, text <13px.


# ROUND 10 — ONLY THE HEADER PICTURE. OWNER: "I expected something DRAWN/PAINTED up there. Round 9 was awful." (rejected-r9-phone-day.png). A Claude-made SVG attempt at the Home picture was also rejected (rejected-fable-home-day.png: too digital, too "AI": smooth gradients, perfect symmetry, generic skyline, glow-like sun).

Scope: ONLY the picture at the top of each screen (home, plan, walk, walks, login). Not the rest of the app. Me stays a plain sunset. Deliver ONE HTML page that shows each header picture at phone size (390x300) day and night side by side with a placeholder white text line over it to prove legibility, plus the same at desktop 1180x300. Each picture is inline SVG and/or CSS (no raster available).

Must NOT look AI-generated. Concretely:
- Hand-made feel: gouache / linocut / screen-print poster. Flat opaque shapes with slightly irregular edges (use feTurbulence + feDisplacementMap on shapes for wobbly edges), paper grain, visible misregistration of 1-2px between colour layers, limited palette of 5-7 colours per picture. No soft airbrushed gradients except the sky, no glows, no lens flare, no perfect circles for sun/moon.
- Asymmetric, specific composition like a real travel poster: strong foreground shape, one focal landmark, big calm sky area for text. Real, recognisable Tel Aviv / Jaffa things: Jaffa clock tower and Ottoman stone, Old Jaffa alleys with stone arches and hanging planters, Habima, Bauhaus white-city balconies with rolled shutters, Carmel market awnings and crates, Mediterranean harbour boats, ficus / palm silhouettes, bougainvillea, laundry lines, electric wires and AC units (the real city texture).
- Each screen a different scene; same palette and printing technique so they are one family.
- Palette stays in the app's sunset world: leather #D2602F, deep rust #8A3311, amber #D8903E, cream #F8F3EA, Pine ink #1B2620, plus ONE accent per picture. Night = dusk indigo-charcoal #1A1613/#26180F with 2-3 lit windows in amber.
- Text zone top-start 60% x 55% stays calm; the bottom melts into the cream (day) / #1A1613 (night) sheet colour without a hard edge; RTL: picture flips with scaleX(-1) so the calm sky is on the right in Hebrew; nothing important near the edges.
- plan: leave a ~140x190 free zone at the bottom-start for the guide photo.
- Self-check at the end (HTML comment): does any picture still look like a smooth digital gradient scene? If yes redo it.
Output only the HTML.
