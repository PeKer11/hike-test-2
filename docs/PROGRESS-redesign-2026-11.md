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
