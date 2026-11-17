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

## P2. Off-route card (2026-11-17)
- New `src/components/walk/OffRouteCard.tsx`: `role="alertdialog"` centred over the map area (a sibling of the sheet via the new `WalkHud` `center` prop), one big number (distance, rounded to 10 m), title, one hint line, three 56px actions, quiet dismiss, countdown bar on the primary button in ask mode (hidden under reduced motion), scrim tap or corner glyph folds it into a pill, one vibrate per episode, signpost accessory.
- Both off-route branches (ask and auto/off) now draw this card with the same actions; `walkAlert` is kept as a marker so the callout gate and the companion still see "a card is up". Behaviour unchanged: silence returns to the route after 90 s.
- `turnInstruction` additionally returns `distanceM` and `bearing`; Hebrew card copy and Hebrew turn hints in `walkCopy.offRouteCard`. English strings unchanged.
- "While you're here" is no longer on this card (plan 2.3). `tests/walk-collapse.test.tsx` updated for that and for the `alertdialog` role; it detected the card by `[role="alert"]`.
- Tests: three new cases in `tests/walk-hud.test.tsx` (structure and sizes, minimise/restore, Hebrew); `walk-planner-silence` unchanged and green; new e2e geometry test in `e2e/walk-hud.spec.ts` (not run, see below).
- Screenshots (390x844 built app, simulator Stray 80 m): en/light, en/dark, he/dark, 1440x900 en/light, and the pill.
- Deviation: the card is centred in the map area below the map's own controls (top padding about 104 px), not in the exact middle, so the layers and locate buttons do not sit on the card. Card box measured at x 16, width 358, y 107 to 510 of a 526 px map area. The pill sits below the controls too.
- Not verified: the Playwright e2e specs were not run (the walk-hud e2e has the known pre-existing failure and a full e2e build was not run); sunlight legibility, one-hand reach, vibration on a real Android phone.

## P3. Screen kit, Home choices, Walks segments (2026-11-17)
- New kit: `src/components/shell/{ScreenHeader,Segmented,ChoiceTile}.tsx`, `src/components/ui/ModalSheet.tsx` (bottom sheet on phones, centred 480 px dialog on desktop, focus trap, Esc, 280 ms). ModalSheet is built but not used by any screen yet (its first user is the P5 profile edit sheet); no test of its own.
- Home: greeting, continue-walk card (only when relevant), two big tiles (New route to `?view=plan`, My walks to `?view=walks&tab=history`, with the walk count as one big number when signed in), one context card (last walk with "Walk again", else "Invite a friend" for signed-in users). Desktop: 3-column grid, New route spans two. Greeting now uses the first word of `user_metadata.full_name` or no name; the email local part is gone (`src/app/app/page.tsx`).
- Walks: `?view=walks&tab=history|saved|places` (`parseWalksTab`, passed AppShell, PlannerFrame, WalkPlannerApp). Three Hebrew/English segments replace the old Walks/Places tabs; `MyWalksPanel` takes `segment` (history = completed or walked, saved = bookmarked or never-walked drafts) and `filterBySegment` is unit-tested with fixture walks. Empty state with a "New route" button. Screen title uses ScreenHeader over a soft folded-map background.
- Me: hero-tent-sunrise background and ScreenHeader; the card order already matched the plan's order for the items that exist today.
- `tests/design-tokens.test.ts` now also scans `src/components/shell`.
- Tests: `tests/home-view.test.tsx` (tiles navigate, greeting never an email, at most four blocks, Hebrew), `tests/walks-segments.test.ts`. Playwright `app-shell` and `hydration` pass; the 390 and 1440 screenshots of Home, Walks and Me were taken (en light/dark, he light/dark at 390, en at 1440).
- Deviations: the plan's "draft" chip and the per-card menu items (hide from profile) are P5; Walks keeps the existing card design. "Invite a friend" navigates to Social instead of sharing a link (the share link is P5). The background of Home is the existing hub art, not changed.
- Not verified: signed-in Home and Walks (count number, last-walk card, the segmented list, empty state) because no test account exists and the e2e build runs signed out; Ariel checks on his phone. ModalSheet is untested.
