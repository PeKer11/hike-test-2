# Round 2 progress (branch feat/round2)

## P1. "Yes" adds the stop (2026-11-17)
- The companion answer now carries the place: `PlanOperator` `add-place {placeId}`, `OperatorAction` `add-place`, `pickAddPlace` returns `id`.
- New `buildAddPlaceRebuildRequest` (keeps stops, appends once, pins, no discovery, clock grows). `handleBuildWalk` resolves to the shown plan or `null`.
- `addPlaceToLiveWalk`, `addStopFromOffer` (propose mode adds the best place; ask mode or no candidate opens the chat), `addBestStopOrFill` (keyword chat). Dead `else` in `addStopViaChat` removed.
- Sheet notice (`WalkHud` `notice`): "Added: X · +n min" with Undo, "nothing fits", "no longer in reach", replan failed, manual-resume. Copy in `walkCopy.notice`.
- Typed yes (`src/lib/walk/chat/affirm.ts`, `useWalkChat.send`): exact-match set, runs apply-all or the single action, zero fetches, second yes is not an action.
- Found while testing: `pickAddPlace` could return a stop already on the walk (plan stops live in the discovery collection as `new`), so "Add it" added nothing. It now takes `excludeIds` (remaining stops).
- Tests: companion-producers/operators updated, planner-actions (+4), walk-chat-affirm (new), walk-fast-pace-add (new, 3 cases incl. failure notice).
- Mutations checked: add-place mapped back to pace-rebuild fails operators test and the companion e2e-style test; affirm branch disabled fails 4 of 6 affirm tests.
- Screenshots (390x844, built app, simulator Fast pace): he/dark question and Added+Undo, en/light Added+Undo.
- Not verified: real fast walk on a phone; owner Sol chat; "Extend the hike" path in a browser with a real discovery scan (jsdom covers it).
