# Review: round 2, phases 1–3 (2026-11-17)

Reviewer: fresh Opus, read-only on source. Range: `git diff e790974..feat/round2` (`f05dc73` P1, `1f525c1` P2, `11e592a` P3), against `docs/PLAN-round2-2026-11.md` §1, §2, §4.2–4.3, §5 P1–P3 and `docs/PROGRESS-round2-2026-11.md`. Worktree == `feat/round2` == `origin/feat/round2` (`11e592a`). Tag `traike-pre-round2-2026-11-17` exists.

## תקציר

- **פסק דין: לא למזג ולא לפרוס עדיין.** P1 כמעט מוכן (MUST אחד, קטן). P2 צריך עוד סבב לפני בדיקה בטלפון (שלושה MUST). P3 בסדר, יש כמה SHOULD.
- P1: "כן" באמת מוסיף את המקום המדויק בכפתור של המלווה, ב"להאריך את ההליכה", בצ'אט המילות-מפתח ובכפתור של Sol. אבל "כן" שני הולך לשרת ועולה קריאה למודל, בניגוד לקריטריון קבלה 3. בנוסף "+n דק׳" מנופח למי שהולך מהר, וה"ביטול" מבטל יותר מההוספה.
- P2: הכרטיס לא נכנס כשהמשתמש מחובר (כפתור שלישי): בגודל 390×844 הוא גולש על הגיליון ועל שורת הלוגו, ובטלפון קטן או כשהצ'אט פתוח המצב חמור בהרבה. בזמן "collapse" מוצגים שני כרטיסים יחד, וזה אומת בבדיקה. אחרי "חזרה למסלול" קופץ כרטיס שני עם רטט שני, גם זה אומת.
- P3: מסך הבית מושך עד 200 שורות מלאות רק כדי להציג מספר, והמספר לא תואם את מה שמוצג ב"היסטוריה". גרסאות של הליכה מוצגות פעמיים. ב-ModalSheet יש באג פוקוס שיפגע ב-P5.

## Checks run

| Check | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| eslint on the 30 changed `src/tests/e2e` files | 0 errors. On changed lines: one new warning, `react-hooks/purity` at `WalkPlannerApp.tsx:2323` (`Date.now()` inside a callback, a false positive) |
| `npx vitest run` (full) | 3040 passed, 1 failed: `tests/assistant-chat-undo.test.tsx` (pre-existing, not touched) |
| Playwright | not run by me. PROGRESS says the new P2 e2e was never run either |
| Probe A (scratch copy of `walk-collapse` test, outside the repo) | **the off-route card and the direction-options sheet are both on screen** (M2) |
| Probe B (scratch copy of `walk-hud` test, `navigator.vibrate` spy) | `vibrate` called **1×** on the ask card, **2×** after "Back to my route". The card stays up with the title "You're off the route" (M3) |
| Builder screenshots | not committed. Found in another session's scratchpad `…/aa3cc489-…/scratchpad/shots/` (P2 and P3 only; no P1 file on disk). The P2 shots are dated 12:04, but P2 was committed at 14:30, so they predate the committed code |

Probe files: `/private/tmp/claude-501/-Users-arielshorpacker-Documents-obs-vault-try/e88a93f1-8427-478b-86a1-4e784e146adb/scratchpad/probe/` (nothing written to the repo).

---

## MUST

### M1 (P2) The off-route card does not fit: it covers the sheet, the logo row and the chat
`src/components/walk/OffRouteCard.tsx:62-79,116-120`. The card has no max-height and no scroll. It is centred in a box with 104 px top padding (`:71`).

- **Signed out** (3 controls): the card is 403 px tall. That is the PROGRESS measurement (y 107→510), and it matches the class arithmetic.
- **Signed in** (Ariel's real case: "Tell me what you want" adds 56 + 10 px): **469 px**. The map area at 390×844 is 526 px, which leaves 526 − 104 − 12 = **410 px**. The card overflows by about 59 px: about 30 px down over the logo row and the top of the sheet, and about 30 px up into the locate/layers controls. Every screenshot and the e2e are signed out, so none of them can see this.
- **360×640**: the map area is about 322 px, so the card overflows by about 200 px.
- **iOS Safari**: the real viewport is shorter than 844, so the overflow is larger again.
- **"Tell me what you want"** opens the chat *inside the sheet* (`WalkChatBox.tsx:44,61`, about +200 px). `--hud-h` grows, the card's box shrinks, and the card now sits on top of the chat it just opened (`WalkPlannerApp.tsx:3434-3441` keeps the card up on purpose).

Fix:
- add `max-h-full overflow-y-auto` to the card;
- use a compact layout when the box is short (smaller number, less top padding);
- fold the card to the pill when Talk is tapped (the countdown keeps running).

Then re-measure **signed in** at 390×844 and 360×640.

### M2 (P2) Two cards at once during a collapse
`WalkPlannerApp.tsx:3205-3211,3411-3412,4481-4482`. `offRouteMode` is set whatever `optionsOffer` is, and WalkHud gets both `center={offRouteCard}` and `sheet={directionSheet}`. Before P2, `sheet ?? alert` meant the options sheet replaced the off-route alert ("one card, never two").

A collapse only happens when the walker is ≥ 400 m off the route, so `isOffRoute` is always true at that moment. Probe A shows the centred card ("600 m from the route…") on screen together with `direction-options`. The scrim also dims the dashed previews that the options sheet exists to show.

The guard went quiet without anyone noticing: `tests/walk-collapse.test.tsx:303` still asserts `queryAllByRole("alert")` is empty, and the card is now `role="alertdialog"`.

Fix:
- add `&& optionsOffer === null` to the `offRouteCard` condition;
- add `expect(screen.queryByTestId("off-route-card")).toBeNull()` at `:303`.

### M3 (P2) Answering the ask card brings up a second full card and a second buzz
`WalkPlannerApp.tsx:3414` uses `key={offRouteMode}`. `OffRouteCard.tsx:40-43` vibrates and steals focus on every mount.

- "Back to my route" (or the 90 s silence) clears `deviationConfirmation` while `isOffRoute` is still true. The chain falls to `notice`, the key changes, the card remounts, and it vibrates again and re-animates with the title "You're off the route" and the same buttons. Probe B confirms both the second vibrate and the swapped title.
- To the walker this looks like "I tapped and nothing happened", which is the same class of bug P1 is fixing.
- The 4-minute re-ask (`:611-619`) remounts the card again, which buzzes again and pulls focus out of the chat input mid-typing.

Plan §2.2 asks for one vibrate per *episode*. Fix:
- vibrate from a per-episode ref in `WalkPlannerApp`, reset when `isOffRoute` goes false;
- give the card a stable key per episode;
- after an answer in ask mode, keep the same card showing "Finding the way back…" (or hide it) until the walker is back on the route, instead of flipping to the notice.

### M4 (P1) A second "כן" is not a no-op
P1 acceptance 3 says: "a second כן is a no-op". `tests/walk-chat-affirm.test.tsx:47-56` asserts the opposite: the second "yes" makes a fetch ("falls through to the assistant"). PROGRESS does not call this a deviation.

- **Cost**: for the owner it is a Sol turn (up to $0.08); for other signed-in walkers it is a `/api/walk-chat` intent call. That breaks plan §7's "a typed yes no longer costs a turn".
- **Duplicate stop**: Sol may propose the same place again. The next "כן" then runs `runAddPlaceRebuild`, which never de-dupes its `chat-<lat>-<lng>` id (`WalkPlannerApp.tsx:1638-1643`), so the same stop goes in twice.
- **Common case**: an impatient double "כן" while the rebuild takes several seconds.

Fix:
- when the text is an affirm and the newest proposal is already used, or the last app reply was "מוסיפים…", answer locally ("כבר על זה" / "Already on it") with no fetch;
- de-dupe the id in `runAddPlaceRebuild` and `runApplyChangesRebuild`;
- flip the test to expect zero fetches.

---

## SHOULD

### P1

- **S1. A typed yes reaches back past the latest reply.** `src/lib/hooks/useWalkChat.ts:124-125` looks at the last **3** app messages. Example:
  - Sol: "Add Café X?" with a button;
  - walker: "will it rain?"; Sol answers with no buttons;
  - walker: "ok" (meaning the weather);
  - result: Café X is added.

  "ok", "בסדר" and "סבבה" are acknowledgements as often as consents. The same happens while a Sol request is pending: the "thinking" bubble has no actions, so an older proposal runs. Only the **newest** app message should count, and only when nothing is pending.
- **S2. "+n min" compares two different things.** `WalkPlannerApp.tsx:1658` takes `walkStats.timeToFinishMin`, which uses the walker's *measured* speed (`walk-stats.ts:41-53`), and subtracts it from `plan.totalMinutes`, which the server prices at the *planned* pace (`walk-plan/route.ts:688-698`). For a walker who is ahead (exactly who this feature is for), the pace gap lands inside n. The question promised "(4 דק׳)" (detour only), and the notice can then say "+30 דק׳". Either:
  - show `item.detourMin + attraction.avgVisitMinutes`, or
  - compare like with like (`timeToFinishMin` with `kmh: null`).
- **S3. The clock grows by the slow-walker rule.** `buildAddPlaceRebuildRequest` → `minutesToFinishRemainingStops` (`planner-actions.ts:453-457`) prices legs at `max(measured, planned × 1.3) × 1.25`. For someone ahead of pace that is always 1.3 × planned, so `availableMinutes` ends up about 10–15% larger than needed. That also loosens `overBudget` later (`WalkPlannerApp.tsx:796`). For the add-place path, use the planned pace. The test (`tests/planner-actions.test.ts`, "grows the clock") only checks `≥ 110`.
- **S4. "Undo" undoes more than the add, and leaves the pin.** `previousPlan` is the *first* snapshot of the re-plan chain (`WalkPlannerApp.tsx:1299`, comment at `:2800-2802`).
  - After any earlier automatic rebuild (a deviation reroute, an earlier add, a slow-pace shorten), Undo on "נוסף: X" reverts all of them and puts back the old route line.
  - Undo also keeps X pinned and keeps its discovery state `added`.

  Either offer Undo only when this add *started* the chain (`previousPlan === null` before it), or snapshot per add. Unpin X on Undo. The test only checks that the Undo button exists (`walk-fast-pace-add.test.tsx:156`) and never presses it.
- **S5. "Superseded" is treated as "failed".** `addPlaceToLiveWalk` (`:1675-1679`) restores `pinsBefore` on *any* `null`. If a build the walker asked for supersedes the add (a new walk, which resets pins to `[]` at `:1315-1316`), the old walk's pins are written into the new walk. Only revert when the request id is still current and the shown plan lacks the place.
- **S6. Test gaps for the paths asked about.** The new tests are **real**, not over-mocked: a real `SimulatedWalkTracker`, and only `fetch` and the map are stubbed. Missing:
  - an app-level test for the keyword-chat `add-stop` (path D, which is everyone except the owner);
  - a typed "כן" through `WalkPlannerApp` (only the hook is tested);
  - the `gone` and `nothingFit` notices;
  - Undo actually restoring the plan;
  - a unit test for `pickAddPlace` `excludeIds`. It fixes the bug PROGRESS found, and `companion-glue.test.ts:132` has no case for it.

### P2

- **S7. The scrim sits over the Google logo.** `OffRouteCard.tsx:62-70` covers the whole map area down to `--hud-h`. Google's logo sits in that bottom row, so it gets a 20–35% black overlay and a 2 px blur. Plan §0: "Never cover the Google logo". Stop the scrim and blur about 28 px above `--hud-h`. Check it on Google tiles; every screenshot uses OSM/Leaflet.
- **S8. Verification gaps.**
  - The P2 screenshots predate the commit by about 2.5 h. The pill shots show the pill under the "Recommended" chip with its number cut off ("Off route · 80 ."). The committed `top-[max(68px,…)]` probably fixes that, but nothing shows it.
  - The new e2e was never run.
  - Its tolerance was loosened from 24 to 60 px (`e2e/walk-hud.spec.ts:306`).
  - It runs signed out, so it cannot catch M1.
  - It clicks "Details" twice and swallows the close failure.
- **S9. Accessibility.**
  - `aria-live="polite"` on the hint (`OffRouteCard.tsx:99`) re-announces on every GPS fix ("80 m", "70 m", …). Announce only when `kind` changes.
  - Minimising drops focus to `<body>`, restoring does not refocus, and Esc does nothing.
  - The scrim is a second "Minimise" button in the accessibility tree; add `aria-hidden` to it.

### P3

- **S10. Home count: a heavy query and a misleading number.** `HomeView.tsx:94` calls `listMyWalks(…, 200)` on *every* Home mount. That returns up to 200 full rows (`stops`, `params`, and `geometry` once `20261116` is applied: `saved-walks.ts:72-75`) just to show one number. The number also counts drafts and variants, while the tile opens **History** (walked only), so the tile can say 12 and the list show 3. Use a head/count query, and count what History shows.
- **S11. Variants appear twice in segments.** `MyWalksPanel.tsx:118` shows nested variants at the top level whenever a segment is set. The parent card still offers "N versions", which renders them again (`:254-260`). Nest a variant only when its parent is in the same segment.
- **S12. ModalSheet (unused) has a focus bug that P5 will hit.** The effect deps are `[open, onClose]` (`ModalSheet.tsx:38`). An inline `onClose` re-runs the effect on every parent render: focus jumps back to the first control while the walker types a display name, and the cleanup re-focuses the previous element each time. Keep `onClose` in a ref. Also note: there is no body scroll lock, and the drag handle is decorative only. Either fix it and add a test now, or leave it out until P5, its first user.

---

## NIT

1. `useWalkChat.ts:130`: "מוסיפים…" is shown for every action (drop and head-back too). Use a neutral word.
2. `WalkPlannerApp.tsx:442,2687-2705`: the `whileHereNote` state is now never read, but it is still computed on every fix.
3. `addPlaceToLiveWalk` returns silently when `midWalkRebuildState()` is null (`:1665-1666`). The question card is already gone by then, so show a notice.
4. In `addBestStopOrFill`, when the fill does add a stop, nothing is shown (`:1724`). Show "Added: …" for new ids.
5. `pickBestAddItem` calls `getCompanionSnapshot()`, which advances `greenTrackerRef` (`:1837`) outside its normal cadence.
6. A typed "כן" after the *companion card* question (not a chat message) goes to the model and adds nothing. This is outside the plan, but it is a "yes" path. Decide whether the chat should see the open companion question.
7. `tests/walk-hud.test.tsx:426`: `/מ׳/` matches the label "מ׳ מהמסלול", not the turn hint. Assert `/פנו|המשיכו|הסתובבו|לכו/`.
8. The card's sizes differ slightly from the plan: `p-5`, 80 px signpost and 10 px gap, against `p-6`, 88 px and 12 px. The scrim uses `bg-black/*`, not a `tk-ink` token.
9. `HomeView.tsx:135`: `aria-label` on a generic `div` is ignored by assistive tech; it only serves as a test hook. The Home test can't catch a regression in `src/app/app/page.tsx` (the email fix), because it passes `greetingName` directly.
10. `HomeView.tsx:139`: the tile goes to `?view=walks` (no `&tab=history`). This is equivalent through the `parseWalksTab` default, but differs from the acceptance wording.
11. On Walks, the segments are in Hebrew but the cards are still in English: "Walk again", "Version ▾", "Delete", "draft", and dates formatted with `"en"`.
12. The Walks header (`WalkPlannerApp.tsx:3571`) puts `folded-map.svg` at 20% over the hub photo. In `p3-walks-he-light-390` it reads as a ghost graphic, which makes two backgrounds; calm-site-taste says one.
13. The notice's `role="status"` is a new node each time (`key`). Some screen readers skip live regions that are inserted already filled; keep one persistent region.
14. `Segmented` has no arrow-key movement and no `aria-controls` (same as the old tabs).
15. Process deviations:
    - branch `feat/round2`, but the plan says `feat/round2-2026-11`;
    - zips are named `traike-2026-11-17-round2-phaseN.zip`, but the plan says `…-r2-pN.zip`;
    - the P1 screenshots PROGRESS claims are not on disk.

---

## Verified as correct

- **P1 data path**: `pickAddPlace` now returns `id`; the operator is `add-place {placeId}`; the action is `add-place`. The exhaustive `never` checks enforce the switch. Item id and attraction id stay equal through merges (`discovery-collection.ts:102-103`), so the lookup in `case "add-place"` (`:2010-2015`) is sound.
- **Paths**: the companion "Add it", "Extend the hike", "Add a stop" (propose), keyword `add-stop`, and the Sol button all end in a pinned, explicit place with `fillRemainingTime:false`, followed by a sheet notice. Ask mode still opens the chat, as the plan specifies.
- **`handleBuildWalk`**: every early return now returns `null`, and `built` is set only after `showPlan`. Failures reach the sheet through `reportReplanFailed`. A double tap during a rebuild is a no-op, because the tracker is torn down synchronously before the first `await`.
- **"Already on the walk"**: handled by `excludeIds` plus the de-dupe in `buildAddPlaceRebuildRequest` (unit tested).
- **P2 silence**: the 90 s path is unchanged; the diff only adds `setDeviationAskedAt(null)`, and `walk-planner-silence` is green. The English accessible names are unchanged. Hebrew copy is plural and gender-neutral. RTL mirrors through `start`/`end`.
- **P3**:
  - `?tab=` parsing is defensive;
  - `chooseWalksTab` uses `replaceState`, so Back still leaves Walks;
  - the old All/Drafts path stays intact when there is no shell (`segment` undefined);
  - the greeting never uses the email;
  - the token guard now covers `shell`, and every class used resolves to a defined token (`--color-warn` exists);
  - a signed-out Home shows at most 4 blocks.

---

## Needs a real phone (or a signed-in account)

1. **Fast walk, propose mode, Hebrew**:
   - the companion "להוסיף" (Add);
   - "Extend the hike";
   - a non-owner account typing "כן" in the keyword chat;
   - the owner's Sol chat: "כן", then "כן" again (M4);
   - check the "+n" number (S2) and whether Undo leaves the route he expects (S4).
2. **Off-route card, signed in, in the real Safari viewport** (after M1):
   - with the chat open after "ספרו לי";
   - on a small phone (SE or 360×640);
   - one-hand reach of the pill and the ⌄ control;
   - sunlight legibility;
   - on **Android**, count the vibrations through ask → "חזרה למסלול" (M3).
3. **A real 400 m stray**, to check the collapse with only the options sheet showing (M2).
4. **Google tiles** under the scrim: is the logo dimmed or blurred (S7)?
5. **Signed-in Home and Walks**:
   - the count and whether it matches History (S10);
   - the last-walk card;
   - all three segments and their empty states;
   - a walk with variants (S11).
6. A native read of the new Hebrew strings (`walk-copy.ts` `notice`, `offRouteCard`, Home and Walks labels).
