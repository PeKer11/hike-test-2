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
