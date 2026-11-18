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
