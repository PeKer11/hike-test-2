# Redesign progress (branch feat/app-redesign)

Nothing here is deployed. Plan: PLAN-app-redesign-2026-11.md (kept in the main working tree, untracked).

- Phase 1 95ab05b, Phase 2 57b90ae, Phase 3 cc694bb: done, see the hand-off report (zips in ~/Downloads, 2026-11-15).

## Phase 4: walk bottom sheet + Details sections
- Sheet: opaque, drag handle (drag or tap: peek, half, details), next-stop line, 3 numbers + one progress bar + pace dot, "+N min over plan" only when over, Ask (terra primary) and End walk (outline, second tap within 3 s). Hebrew/English copy.
- Details (the planner aside while walking) re-ordered into sections: The walk, Conditions, Places around, Display, settings, About the map; the build form is hidden (not unmounted); plan card and Start over hidden while walking.
- Verified: 5 new unit tests, full suite (only assistant-chat-undo fails, pre-existing), tsc, eslint, Playwright walk-hud/planner/rtl/offline/hydration (walk-hud "alert card" fails pre-existing), real 390x844 screenshots day+night (peek, half, full, end confirm).
- NOT verified: dragging with a real finger (pointer events only simulated in unit tests), Hebrew screenshots, Leaflet sheet in a real browser beyond e2e.
- Deviations: callout level stays inside Walk settings (not a separate Places control); Details keeps the "Back to walk" pill and the planner aside rather than becoming the same physical sheet; text-xs (12px) in AttractionDistancesPanel etc. left for Phase 5.
