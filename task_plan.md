# Area-aware walk starts — 2026-10-28

Objective: keep the current start when it is inside the requested town; otherwise default to the named town and announce the start with a non-blocking “okay?”. Continue planning in the same turn. Never start GPS navigation automatically or weaken route/safety rules.

## Phases
- completed: reproduce the town-membership/start-choice problem with deterministic tool tests (5 failing, 2 passing before implementation).
- completed: reuse the town boundary lookup without the routing-radius clamp for membership, add area-aware start selection and update assistant guidance.
- completed: verify tool/turn behavior, including two real-model evals; run the full test suite, TypeScript, lint and dependency checks; refresh the code graph. Browser inspection confirmed the original chat and unsent draft, which were preserved.
- completed: update the second brain and prepare the verified source for GitHub and the Downloads backup (`traike-2026-10-28-area-start.zip`). Final delivery commands verify commit, push and archive contents.

## Decisions
- The user's requested behavior is the approved design; no additional product decision is needed.
- Keep explicit address/venue start changes working as before.
- A missing town outline is unknown, never evidence the walker is outside the town.
- No deployment or database changes are needed.

## Validation limits
- 2,854 active tests pass; 4 opt-in tests skipped in the ordinary run. Both additional live area-start model evals pass with map fixtures and no production DB writes.
- TypeScript and lint on all eight changed source/test files pass with zero warnings.
- Bare repository lint scans the existing `.next-mobile` generated bundles and fails. Dependency check reports the pre-existing `walk-history.ts -> WalkCompanionPanel.tsx` import, confirmed in HEAD. Neither is introduced by this change.
- Start membership uses the full municipal outline; existing route-search boundary behavior is preserved. Missing outlines remain unknown and do not cause a false outside-town claim.
