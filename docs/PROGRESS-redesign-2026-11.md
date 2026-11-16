# Redesign progress (branch feat/app-redesign)

Nothing here is deployed. Plan: PLAN-app-redesign-2026-11.md (kept in the main working tree, untracked).

- Phase 1 95ab05b, Phase 2 57b90ae, Phase 3 cc694bb: done, see the hand-off report (zips in ~/Downloads, 2026-11-15).

## Phase 4: walk bottom sheet + Details sections
- Sheet: opaque, drag handle (drag or tap: peek, half, details), next-stop line, 3 numbers + one progress bar + pace dot, "+N min over plan" only when over, Ask (terra primary) and End walk (outline, second tap within 3 s). Hebrew/English copy.
- Details (the planner aside while walking) re-ordered into sections: The walk, Conditions, Places around, Display, settings, About the map; the build form is hidden (not unmounted); plan card and Start over hidden while walking.
- Verified: 5 new unit tests, full suite (only assistant-chat-undo fails, pre-existing), tsc, eslint, Playwright walk-hud/planner/rtl/offline/hydration (walk-hud "alert card" fails pre-existing), real 390x844 screenshots day+night (peek, half, full, end confirm).
- NOT verified: dragging with a real finger (pointer events only simulated in unit tests), Hebrew screenshots, Leaflet sheet in a real browser beyond e2e.
- Deviations: callout level stays inside Walk settings (not a separate Places control); Details keeps the "Back to walk" pill and the planner aside rather than becoming the same physical sheet; text-xs (12px) in AttractionDistancesPanel etc. left for Phase 5.

## Phase 5: tokens and typography pass
- New tokens --tk-route / --tk-walked / --tk-warn / --tk-sun (day+night) and Tailwind colors; route in deep green with a 2px casing, walked trail warm stone, next stop gets a --tk-sun ring; weak-GPS dot uses --tk-warn.
- Anti-slop pass over components/{walk,map,ui,planner}: no text under 13px (credits chip excepted), no uppercase tracking labels, no slate/emerald classes, no off-palette hex backgrounds; emoji removed from buttons and warnings (Save for later, My location, Recommended, pinned text); Leaflet "Recommended" toggle uses a tinted selected state (border-fix).
- Guard test tests/design-tokens.test.ts enforces the greps.
- Verified: unit suite (only assistant-chat-undo fails), tsc, eslint (0 errors), Playwright walk-hud/planner/rtl/offline/theme (walk-hud alert-card still fails: pre-existing), real 390x844 screenshots day+night.
- NOT verified: Leaflet route casing in a real browser; every 12.2px string inside third-party-ish panels (Trail Briefing summary).
- Deviations: category emoji inside stop lists and callout bubbles are content icons, left as is (replacing them needs an icon set); e2e direction-options threshold relaxed from 50% to 40% of screen height because 13px text made the sheet taller; Button/Card/Toggle only had hex hover colors swapped to tokens.

## Phase 6: app shell, Home, Me, navigation
- /app is one page: AppShell keeps the planner mounted and switches ?view= (home, plan, walk, walks, social, me) with the History API (Suspense around useSearchParams, per the Next docs). Phone: bottom TabBar (Home, Walks, raised +, Social, Me) on hub screens only; Plan has a back button; Live walk has none. Desktop (lg): 72px Rail. Walks and Social show the planner's own side panel full-size (Walks has Walks | Places segments, not sticky).
- Home: greeting, New route (3D compass), Continue walk, last walk with Walk again (3D boot). Me: account, day/night, walk settings (language, privacy, delete live in this panel), what Traike remembers, Refresh the app (confirm while a walk is live), credits.
- Active walk store (traike.activeWalk.v1): a real walk is saved as it goes, cleared on End walk; after a reload Home offers Continue and resumes it. Bridge (PlannerBridge) lets Home/Me read walk-live, settings, friend badge and call walkAgain/resumeWalk.
- Verified: unit tests (store, bridge, tab bar, Me refresh), full Playwright suite (app-shell spec at 390 and 1440: navigation, planner never unmounts across Home and back; hydration for /app and /app?view=plan), real 390x844 screenshots day+night of Home, Walks, Social, Me, Plan, resume card, refresh confirm; desktop 1440 Home and Plan; real reload mid-walk then Continue resumed the walk with stats.
- NOT verified: signed-in Walks/Social panels and Home last-walk card (no test account, nothing created in production); resume on a real phone; the walk-hud "alert card" e2e fails (pre-existing).
- Deviations: SideTabs.tsx is kept (used only when the planner renders without a shell, i.e. unit tests); Walks has Walks | Places segments, history/saved are not split; no weather line on Home (no weather source wired); no auto-resume, only the Continue card; Me has no separate gear-defaults entry (those live in the Plan chat); "friends shared a walk" Home row not built; old e2e specs now open /app?view=plan.

## Phase 7: geometry storage + walk again from anywhere
- MIGRATION NOT APPLIED. File: supabase/migrations/20261116100000_walk_geometry_variants.sql. Ariel must paste it into the Supabase SQL editor himself (saved_walks: geometry, end_lat/lng, is_loop, parent_walk_id, variant_kind + RLS insert check; walk_runs: last_stop_index, join_mode). The code works without it: queries fall back to the old column list and remember that, inserts retry without the new columns, backfill is a no-op.
- New: encoded polyline (precision 5), geometry/end/loop saved with each new walk, pure decideWalkAgain (every situation of table 5.2), join/rotate/skip logic, walk-to-start as a zero-minute stop at the start, WalkAgainSheet (SVG route sketch + one primary button + at most two rows), locateOnce(); wired into My walks, Home and the friends' "Plan" (replacing the 3 km rule); same style here pre-fills the assistant chat; Get there opens a transit link.
- Verified: 23 new unit tests (all 8 situations, join, polyline, migration fallbacks), full suite (only assistant-chat-undo fails), Playwright app-shell/planner/hydration, real 390x844 screenshots day+night of the sheet (English and Hebrew) with sensor-like positions.
- NOT verified: the end-to-end tap in the real app (needs a signed-in account; none created in production) with sensor overrides at 0 m / 800 m / 40 km; backfill of old walks; anything against the real database with the new columns.
- Deviations: sketch is an SVG, not a Leaflet thumbnail; "continue where I stopped" is decided but not offered (runs are only recorded when finished; resume is covered by the device snapshot on Home); reverse is hidden until Phase 8; walk_to_start re-routes through the start rather than prepending a dashed non-counted leg; join passes all remaining stops through the normal build path.
- Note: the dev server served a stale stylesheet after Phase 5 edits (tokens were empty) until restarted; a production build was always fine.

## Phase 8: variants
- Server: src/lib/walks/variants.ts (reverse, start_here/start_at, skip_stop, shorter) always RE-ROUTES through the new waypoints (never a reversed polyline), recomputes time, distance and climb, returns a NEW walk draft with parent_walk_id + variant_kind; the parent is never written. POST /api/walks/variant (signed-in only, rate-limited, parent must be readable under RLS, AI kinds refused). make_variant assistant tool (+ recall_walks now returns the walk id, + prompt line "recall first, never rebuild from scratch"); longer/add_stop/swap_type return the saved stops for the normal search/estimate/build loop.
- UI: My walks gets a Version menu (Reverse, Shorter 30/45/60, From here, Edit as new), variants grouped under their parent ("N versions"), and the walk-again chooser can offer "walk it the other way".
- Fresh discovery: a variant keeps no discovery data; unit test proves a place on the right of the original route is on the left of the reversed one.
- Verified: unit tests for makeVariant (13), the route (5), the tool (6), My walks variants UI (5); full suite (only assistant-chat-undo fails); Playwright suite (only the pre-existing walk-hud alert-card failure); tsc; eslint 0 errors.
- AI eval: written (tests/llm-eval/variant-live.test.ts, 3 Hebrew prompts, fixture walk and a recorder instead of the database, opt-in via RUN_LIVE_VARIANT_EVAL) but NOT RUN: it needs paid model keys; I did not run it.
- NOT verified: the variant menu and grouping in a real browser (needs a signed-in account), the real router on a reversed walk, saving a variant in the real database (the parent link needs the Phase 7 migration; before it, the variant is saved as a plain walk).
- Deviations: "Edit as new" builds the stops as a new draft without a parent link; longer/add_stop/swap_type are not saved as variants by the tool itself (the build loop saves the result as a normal walk); shorter drops by estimated time saved, not the app's stop ranking.
