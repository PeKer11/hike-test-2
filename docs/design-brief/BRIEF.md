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
