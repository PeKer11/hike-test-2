# Traike round 2 plan (2026-11-17)

Planner: Opus, read-only on code. Builder: Sonnet, one phase per session. A fresh Opus reviews each phase.
Base: `main` == `feat/app-redesign` at `e790974` (live in production).
Inputs read for this plan: `docs/PLAN-app-redesign-2026-11.md` (kept in the main working tree), `docs/PROGRESS-redesign-2026-11.md`, `docs/REVIEW-app-redesign-2026-11.md`, `docs/SOCIAL_PLAN_V2.md`, `docs/PERSONALIZATION_SOCIAL_PLAN.md`, the `calm-site-taste` skill and vault `context/site-taste.md`, every migration in `supabase/migrations/`, and the code paths named below. Every file:line was read at `e790974`.

Baseline checked today: `npx vitest run tests/assistant-chat-undo.test.tsx` still fails at `:55` (pre-existing, review N1). Nothing else was run or changed.

---

## תקציר

1. **הבאג "כן ולא נוסף כלום"**: יש שלוש דרכים שבהן "כן" נשבר. (א) בכרטיס "אתם מקדימים. להוסיף את X?" הכפתור "להוסיף" לא מעביר את X בכלל. הוא מפעיל בנייה כללית של "מילוי זמן", ובנייה כזאת כמעט אף פעם לא מוסיפה עצירה כשההליכה כבר באמצע. (ב) אם עונים "כן" בהקלדה בצ'אט, אף אחד לא מבצע את ההצעה: גם המודל וגם צ'אט המילות-מפתח רק מציגים כפתור. (ג) כשבנייה נכשלת או לא משנה כלום, ההודעה נכתבת למסך "פרטים", שמוסתר בטלפון. התיקון: מוסיפים בדיוק את המקום שהוצע (מוצמד, עם הארכת זמן אם צריך), "כן" מוקלד מפעיל את ההצעה האחרונה בלי לקרוא למודל, ותמיד מופיעה שורת תוצאה על הגיליון ("נוסף: X · +6 דק׳", עם כפתור ביטול).
2. **"סטיתם מהמסלול"**: כרטיס גדול באמצע המפה, עם מספר אחד גדול (המרחק מהמסלול), שלושה כפתורים בגובה 56px ("חזרה למסלול" / "המסלול הכי טוב מכאן" / "ספרו לי מה אתם רוצים") ופס התקדמות דק שמראה שאם שותקים חוזרים למסלול. לחיצה על הרקע מקטינה אותו לגלולה. ההתנהגות לא משתנה.
3. **חברתי אמיתי**: פרופיל רשות עם שם שהמשתמש בוחר ואווטאר מוכן מראש, נראות פרטי/חברים/כולם (ברירת מחדל: פרטי), היסטוריית הליכות למי שרשאי לראות (בלי נקודת התחלה, בלי קו מסלול, בלי שעה), "הולכים עכשיו" לפי תא של כקילומטר עם תפוגה של 20 דקות, בקשת "הולכים ביחד" עם אישור ודחייה ונקודת מפגש ציבורית, חסימה ודיווח, וגיל 18+. זרים "בסביבה" מגיעים רק בשלב נפרד שמחכה לייעוץ משפטי. שום מיקום מדויק לא נשמר. ממקומות של Google נשמר רק place_id.
4. **אפליקציה ברמה מקצועית**: מסך בית עם שתי אריחי בחירה גדולים ("מסלול חדש", "ההליכות שלי") וכרטיס הקשר אחד. בהליכות שלושה מקטעים (היסטוריה / שמורים / מקומות). חברתי, פרופיל ואני בנויים על אותה מעטפת (?view=). ערכת רכיבים קטנה ואחידה. עובדים לפי calm-site-taste.
5. **סדר**: באג, כרטיס סטייה, ערכת מסכים ובית, ואחר כך חברתי בחמישה שלבים. סיכום הטעם בבינה מלאכותית הוא אופציונלי ובסוף. כל הדגלים כבויים בייצור עד שאריאל מאשר. את קבצי ה-SQL אריאל מדביק בעצמו.

---

## 0. Rules for every phase (builder, read first)

- Read before coding: this phase's section, the repo `AGENTS.md` (this Next version differs: read `node_modules/next/dist/docs/` for any routing/searchParams/route-handler API you touch), `CLAUDE.md`, and for UI phases the `calm-site-taste` skill plus vault `context/site-taste.md`.
- Branch `feat/round2-2026-11` from `main` at `e790974`. Before P1: tag `traike-pre-round2-2026-11-17`, zip to `~/Downloads`.
- Surgical edits. In `WalkPlannerApp.tsx` (4,386 lines) only targeted edits: move or add JSX and small handlers. Put new logic in new files under `src/lib/**`.
- Commit **by explicit path** (the tree has untracked `AGENTS.md` and `docs/REVIEW-…`). Push. Zip `~/Downloads/traike-2026-11-<dd>-r2-p<N>.zip` excluding `node_modules .next .git .env.local`. Report the hash and the zip path (CLAUDE.md rule 8).
- **No deploy** without Ariel's explicit OK. **No DB migration applied**: write migration files only. Ariel pastes them (Supabase Dashboard › SQL Editor › New query › paste › Run).
- Code must work **before** its migration is applied. Every new RPC call treats PostgREST `PGRST202` / Postgres `42883` (function missing) and `42P01` (table missing) as "feature unavailable" and hides the UI. The flag is never the only guard.
- Google Maps Platform terms: never store Google Places content except `place_id`. Never show Places content on the Leaflet map. Never send Google place names to an LLM. Never cover the Google logo.
- Verify: `npm test` (only `tests/assistant-chat-undo.test.tsx` may fail), `npx tsc --noEmit`, eslint on changed files, `npm run deps:check`, the phase's Playwright spec (`npm run test:e2e -- <spec>`; the walk-hud "alert card" e2e failure is pre-existing). Then a real browser at 390×844 and 1440×900, day and night, Hebrew and English, with screenshots. "Done" means the screenshot shows it. Run `graphify update .` after code changes.
- Dev server: `env -u OPENAI_API_KEY npx next dev -p 3111`. `.env.local` points at **production** Supabase: create no social rows there, and never use fake-looking names.
- Copy: Hebrew is plural and gender-neutral (house style in `companion-copy.ts`). No owner name in product copy. Minimum text 13px. One headline and one line per block. No emoji in controls.

---

## 1. Bug: "too fast → want to add a stop? → yes → nothing added"

### 1.1 The paths that ask, and what "yes" does on each

Ahead of pace, three different things can ask. Which one appears depends on settings and on what is around the walker. On **every** path, "yes" ends with nothing added, or with nothing visible.

| # | What the walker sees | Source | What "yes" runs | Result |
|---|---|---|---|---|
| A | Companion question **"אתם מקדימים. להוסיף את {place} ({d} דק׳)?"** [להוסיף] [לסיים מוקדם] | `PaceAdvisor` → `paceAdvisory` (`WalkPlannerApp.tsx:809`) → `getCompanionSnapshot` sets `addPlace = pickAddPlace(...)` (`:1735-1738`) → `paceCandidate` (`producers/pace.ts:62-74`) | answer `add` → operator `{op:"extend", addFrom:"collection"}` (`pace.ts:69`) → `resolveOperator` → `{run:"pace-rebuild", reason:"sustained-fast-pace"}` (`operator-map.ts:39-40`) → `handleCompanionAnswer` (`WalkPlannerApp.tsx:1870-1871`) → `runCappedPaceRebuild` (`:1769-1777`) → `buildPaceRebuildRequest` (`planner-actions.ts:86-99`) | **The named place is dropped.** A generic "fill remaining time" rebuild runs instead (1.2), and it almost never adds a stop. |
| B | Card **"You're at a great pace!" [Extend the hike]**, or in "ask" mode **"You're ahead of plan. Want to add another stop?" [Add a stop]** | `paceAdvisory` card (`:3228-3243`) / `paceConfirmation` card (`:3144-3163`) | `addStopViaChat` (`:1571-1574`) → `askForStopRef.current()` → `walkChat.openWith("תוסיף עצירה — תבחר אחת בשבילי ותשאל אותי אם זה מתאים")` (`:3303-3312`) | The chat opens, and the **assistant** proposes a place and asks "מתאים?". Then see C and D. |
| C | (owner, Sol chat) "I suggest X because…, does it fit?" plus a button "להוסיף את X". The walker **types "כן"** | `useWalkChat.send` (`useWalkChat.ts:185-265`) → `/api/walk-assistant` → `runWalkTurn` | A new model turn. History is text only (`useWalkChat.ts:194-198`). Earlier replies are downgraded to fenced "data" (`walk-assistant/route.ts:50-54`). Place ids live only within one turn (`walk-turn.ts:104`), so `propose_add_stop` cannot refer to the earlier place (`:191-196`). The prompt forbids claiming it is done (`walk-turn.ts:22`). | **No action runs.** At best the reply shows another button. Typed "yes" is never turned into the proposal. |
| D | (everyone else: keyword chat) "אפשר לחפש עוד עצירה בהמשך." plus a button "להוסיף עצירה" | `parseIntent` → `longer` → `reply.ts:149-150` | Typed "כן" → `parseIntent` returns `unknown` → `/api/walk-chat` intent → help text. Tapping the button → `action.kind === "add-stop"` → `runPaceTriggeredRebuild("sustained-fast-pace")` (`WalkPlannerApp.tsx:3291-3292`) | Typed: nothing. Tapped: the same generic fill as A. |

A note on B: the comment at `:1568-1569` says non-owners fall back to the plain rebuild. That never happens. `askForStopRef.current` is assigned on every render (`:3303`), so the `else` at `:1573` is dead code, and everyone goes to the chat.

### 1.2 Why the generic fast-pace rebuild adds nothing

`buildPaceRebuildRequest` (fast) → `buildMidWalkRebuildRequest` (`planner-actions.ts:470-526`) sends:
- the remaining clock (`availableMinutes − elapsed`);
- the **planned** pace (`...orig` keeps `walkingPaceMinPerKm`);
- the unvisited stops as `explicitAttractions`;
- `fillRemainingTime: true`.

Mid-walk, the AI builder is skipped (`WalkPlannerApp.tsx:1334`, `!options?.autoResume`), so `/api/walk-plan` decides alone:
- It estimates the named stops with `estimateMinutes`, which sums a **radial** leg from the walker to *each* stop plus each stop's visit minutes (`walk-plan/route.ts:355-367`).
- It discovers filler only if that estimate is `< 0.9 × availableMinutes` (`:114`, `:506-509`).
- Filler then gets only `availableMinutes − explicitMinutes` (`:547-556`).

The plan was built to fill the time at the planned pace. Re-timed at that same pace, the remaining stops still fill about the whole remaining clock. A walker who is ahead only gained the difference between planned and real pace, typically 5–10 minutes. So either the 0.9 gate is not met, or the filler budget is smaller than any candidate's walk plus visit time (visits are 10–30 min). The rebuild returns the same stops.

Nothing compares the old and new stop lists (`:1455-1468` only records *lost* stops). Failures go to `setWalkTrackingMessage(REPLAN_FAILED_MESSAGE)` (`:1366-1369`, `:1419-1428`), which renders only in the Details slot (`:4128-4134`). The pinned-stop warning is also Details-only (`:3837`). On a phone during a walk, the walker sees "Updating your route…" and then the same route.

The data needed for the fix was already there and was thrown away. `pickAddPlace` (`companion-glue.ts:315-336`) finds the exact discovery item, but returns only `{name, detourMin}`. `PaceProducerInput.addPlace` has no id (`pace.ts:18`). The existing tests encode the bug: `tests/companion-producers.test.ts:94` expects `{op:"extend", addFrom:"collection"}`, and `tests/companion-operators.test.ts:44` expects `extend → pace-rebuild`.

A working "add this exact place" path already exists: `addNearbyPlaceToWalk` (`:2771-2795`) pins the place through `buildRecallRebuildRequest`. So does the Sol "Add X" **button**, `runAddPlaceRebuild` (`:1598-1609`). Only the button taps reach them.

### 1.3 Fix design

1. **Carry the place.**
   - `pickAddPlace` returns `{ id, name, detourMin }`, with `id = item.id`.
   - `PaceProducerInput.addPlace` gains `id`.
   - In `companion-types.ts`, replace the `PlanOperator` variant `{op:"extend"; addFrom:"collection"}` with `{op:"add-place"; placeId: string}`.
   - In `pace.ts:69`, the fast answer becomes `{ id: "add", label: "answer.add", operator: { op: "add-place", placeId: input.addPlace.id } }`.
   - `operator-map.ts`: `case "add-place": return { run: "add-place", placeId: op.placeId }`, and add `{ run: "add-place"; placeId: string }` to `OperatorAction`. The exhaustive `never` checks force the planner to handle it.
2. **One function adds a concrete place mid-walk.** New pure builder `buildAddPlaceRebuildRequest(state, place)` in `planner-actions.ts`:

   ```
   buildMidWalkRebuildRequest(
     { ...state, currentAttractions: [...kept, place] (no duplicate id), pinnedIds: [...pins, place.id] },
     { fillRemainingTime: false, extendToFitRemainingStops: true })
   ```

   This keeps every stop, pins the new one and grows the clock if needed, so the walk still fits.

   In `WalkPlannerApp`, add `addPlaceToLiveWalk(attraction, source)`:
   - `discoveryRef.current?.setState(id, "added")`;
   - update the pins (ref + state, exactly as at `:2776-2780`);
   - run `handleBuildWalk(input, options)` and **await its result**;
   - show the notice (step 5).

   `runAddPlaceRebuild` (Sol button) and `runApplyChangesRebuild` keep their behaviour but end with the same result notice.
3. **`handleBuildWalk` resolves to the shown plan or `null`.** Return `data` after `showPlan` on the success branch, and `null` on every revert, error and early return. Existing `void handleBuildWalk(...)` callers are unaffected.
4. **Every "add a stop" button adds a real place** (path B, and keyword-chat `add-stop`):
   - New `addStopFromOffer(reason)`:
     - `stopSuggestionMode === "ask"` → open the chat as today (the walker asked to be asked);
     - otherwise, pick the best candidate with `pickAddPlace` over `discoveryRef.current.items()` (same args as the snapshot) → `addPlaceToLiveWalk(item.attraction)`;
     - if there is no candidate → open the chat (Sol for the owner, keyword chat for others).
   - Keyword `add-stop` → `addBestStopOrFill()`: pick → add; no pick → the existing `runPaceTriggeredRebuild` **plus** the result notice ("nothing fit" when the stop ids did not change).
   - Delete the dead `else` in `addStopViaChat` and fix its comment.
   - `handleCompanionAnswer` gets `case "add-place"`: look up `discoveryRef.current?.collection.items.get(placeId)`. If found, `addPlaceToLiveWalk(item.attraction, "companion")`. If not found, show the notice "המקום כבר לא בהישג יד".
5. **Results are visible on the sheet.** Add `notice` to `WalkHud`:
   - shape `{ id, text, tone: "ok" | "warn", action?: { label, onClick } } | null`;
   - one row above the next-stop line, `role="status"`, 15px, check/alert SVG 18px, a tinted pill (`bg-forest/10` ok, `bg-warn/15` warn), optional terra text action at least 44px tall;
   - auto-clears after 8 s.

   `showWalkNotice()` in `WalkPlannerApp` is used for:
   - "נוסף: {name} · +{n} דק׳" (`n` = new total minus the remaining minutes before; omitted when ≤ 0), with the action "ביטול" → `handleRevertPlan` (`:2708`) when `previousPlan !== null`;
   - "לא נמצא מקום שנכנס בזמן שנשאר" (rebuild returned the same stop ids);
   - the Hebrew/English versions of `REPLAN_FAILED_MESSAGE`, `MANUAL_RESUME_MESSAGE` and `notice.amenityFailed`. These still also go to `walkTrackingMessage` for the Details log.

   Copy lives in `walk-copy.ts` under `notice: { en, he }`.
6. **A typed "yes" confirms the last proposal locally (no LLM).** In `useWalkChat.send`, before the legacy and free-chat branches:
   - normalise the text (trim, strip punctuation and emoji, collapse spaces, lowercase);
   - if it is in an **exact-match** affirm set and one of the last 3 app messages has unused actions, run the newest such message's `apply-changes` action if present, else its single action, via the same code as `runAction`;
   - push the reply "מוסיף…" / "On it…".

   If that message has several actions and no apply-all, reply locally "על איזה מהם? אפשר ללחוץ על הכפתור". A negative or any longer sentence goes to the server as today.

   Affirm set:
   - he: כן, כן בבקשה, כן תודה, בטח, סבבה, יאללה, אוקיי, אוקי, בסדר, מתאים, מתאים לי, נשמע טוב, קדימה, בכיף, תוסיף, תוסיף אותו, תוסיף אותה, להוסיף;
   - en: yes, yes please, yeah, yep, sure, ok, okay, add it, do it, sounds good, go ahead, please do, perfect.

   Because the same message is marked used, a second "כן" does nothing.

### 1.4 Regression tests (must fail on `e790974`, pass after)

- `tests/companion-producers.test.ts`: the fast candidate's first answer is `{op:"add-place", placeId:"osm-node-777"}` for `addPlace.id = "osm-node-777"`. The `:94` expectation is updated, because the old expectation is the bug.
- `tests/companion-operators.test.ts`: `add-place → {run:"add-place", placeId}`. Update `:44`.
- `tests/planner-actions.test.ts`: `buildAddPlaceRebuildRequest` keeps every unvisited stop, appends the place once (an existing id is not duplicated), pins it, sends `fillRemainingTime:false`, and sets `availableMinutes ≥` the chain minutes including the new stop.
- New `tests/walk-chat-affirm.test.ts` (renderHook over `useWalkChat` with `doFetch` spy):
  - after an app message with one `add-place` action, `send("כן")` calls `onAction` once with that action, makes **zero** fetches, and marks the message used;
  - `send("כן")` again does nothing;
  - `send("לא")` fetches;
  - two actions plus apply-all → apply-all runs;
  - two actions and no apply-all → local "which one" reply, no `onAction`.
- New `tests/walk-fast-pace-add.test.tsx`, the end-to-end regression, built on the `walk-hud.test.tsx` harness:
  - stub `/api/nearby` so the discovery scan returns one registered café 60 m to the side ahead (`id "osm-node-777"`, name "Café Ahead"), and make the `/api/walk-plan` stub echo `explicitAttractions` back as `orderedAttractions`;
  - start the simulated walk, press "Fast pace", advance until "You're ahead of time. Add Café Ahead" shows, then tap "Add it";
  - assert that the last walk-plan body has `explicitAttractions` containing `osm-node-777`, `pinnedAttractionIds` containing it, and `fillRemainingTime === false`;
  - assert that the sheet shows "Added: Café Ahead".
  - Second case: press "Extend the hike" (propose mode) with the same café present → the same assertions, and **no** `/api/walk-assistant` call.

  If stubbing the discovery scan proves too heavy, the builder may inject the item through the loader's `doFetch` seam. Say so in the hand-off, and do not delete the test.
- Mutation checks, recorded in the hand-off: map `add-place` back to `pace-rebuild` → the e2e-style test fails; remove the affirm branch → the affirm test fails.

---

## 2. Off-route card: big, centred, calm

### 2.1 Today
Both off-route cards are entries in the single bottom-sheet alert slot (`WalkPlannerApp.tsx:3068-3118` ask mode, `:3119-3143` auto/off), rendered by `WalkAlertCard` at `text-sm`/`text-[13px]` with `py-2` buttons (`WalkAlertCard.tsx:55-93`). In "auto" mode the app asks first too (`tests/walk-hud.test.tsx:362`). Silence: after 90 s `DEVIATION_CONFIRMATION_TIMEOUT_MS` (`DeviationConfirmationNotification.tsx:6`), `runLocalRejoin()` takes the walker back to the original route (`WalkPlannerApp.tsx:2196-2201`). That stays exactly as it is.

### 2.2 Design (phone 390×844; RTL shown)
```
┌──────────────────────────────────────┐
│░░░░░ map, dimmed by a light scrim ░░░│  scrim: bg-tk-ink/20 + 2px blur (night: black/35)
│░░┌────────────────────────────────┐░│
│░░│                         [3D]   │░│  signpost.png, 88px, overlaps the top-end corner
│░░│  80                            │░│  one number: 48px Heebo 300, tabular
│░░│  מ׳ מהמסלול                     │░│  17px
│░░│  סטיתם מהמסלול                  │░│  26/32 Secular One, forest
│░░│  פנו שמאלה, 40 מ׳               │░│  one line 17px (turn hint / "מחפשים דרך חזרה…")
│░░│ ┌────────────────────────────┐ │░│
│░░│ │       חזרה למסלול          │ │░│  56px, terra; 3px countdown bar inside, bottom edge
│░░│ └────────────────────────────┘ │░│
│░░│ ┌────────────────────────────┐ │░│
│░░│ │   המסלול הכי טוב מכאן      │ │░│  56px, forest/10 tint, forest text
│░░│ └────────────────────────────┘ │░│
│░░│ ┌────────────────────────────┐ │░│
│░░│ │   ספרו לי מה אתם רוצים     │ │░│  56px, same tint (signed-in only, as today)
│░░│ └────────────────────────────┘ │░│
│░░│     הכול בסדר, ממשיכים ככה      │░│  quiet text button, 15px, min-h 44
│░░└────────────────────────────────┘░│
├──────────────────────────────────────┤  the walk sheet stays visible and usable below
│  ◉ לתחנה 2 …   3.8   117   ●4.6     │
└──────────────────────────────────────┘
```
- Placement: an overlay inside `WalkHud`'s wrapper, `absolute inset-x-0 top-0 bottom-[var(--hud-h,9rem)] z-[650] flex items-center justify-center px-4 pt-[max(16px,env(safe-area-inset-top))]`. It is centred in the **map area**, so it never covers the sheet or Google's logo row (the logo sits just above the sheet, and the scrim ends there too).
- Card: `w-full max-w-[420px] rounded-[28px] bg-paper p-6`, e3 shadow. Buttons are stacked with a 12px gap, `rounded-full text-[17px] font-semibold min-h-14`. Same structure in day and night (tokens only).
- Countdown (ask mode only): a 3px `bg-on-accent/50` bar on the primary button shrinks from 100% to 0 over the time left (`DEVIATION_CONFIRMATION_TIMEOUT_MS − (now − askedAt)`). There is no visible text; a screen reader gets `aria-describedby` "Returns to your route automatically if you do nothing". Under `prefers-reduced-motion` the bar is hidden.
- Minimise: tapping the scrim, or a 44px "⌄" glyph at the card's top-start, collapses the card to a top-centre pill. The pill is 48px tall, paper, with a terra dot and "מחוץ למסלול · 80 מ׳". Tapping it restores the card. The countdown keeps running. A new off-route episode (new card id) opens full again.
- Entrance: 200 ms fade + scale 0.96→1 (none under reduced motion). One `navigator.vibrate?.(120)` per episode (Android; feature-detected).
- a11y: `role="alertdialog" aria-modal="false"`, labelled by the title, primary focused on show (`preventScroll`).
- Desktop (≥1024): the same card centred in the map section, max 420px. The right panel is untouched.

### 2.3 Behaviour and copy
- Ask mode (`deviationConfirmation`): title "סטיתם מהמסלול" / "You've gone off the planned route".
  - Primary "חזרה למסלול" / "Back to my route" → `clearDeviationConfirmation(); runLocalRejoin()`.
  - "המסלול הכי טוב מכאן" / "Best route from here" → `runDeviationTriggeredRebuild()`.
  - "ספרו לי מה אתם רוצים" / "Tell me what you want" → the same `walkChat.openWith(...)`, card stays up.
  - "הכול בסדר, ממשיכים ככה" / "I know where I'm going" → the same dismiss.
  - Silence → unchanged (`runLocalRejoin` after 90 s, and the heading-continued exception).
- Auto/off notice (`isOffRoute && !offRouteDismissed`): the same card, title "אתם מחוץ למסלול" / "You're off the route", no countdown. Same three actions: "Back to my route" calls `runLocalRejoin()`, and is harmless if a way back is already drawn.
- Busy (`isFindingWayBack`): the body line shows "מחפשים דרך חזרה…" with a 16px spinner, and the buttons stay enabled.
- English strings stay byte-identical (existing tests use them). Hebrew comes from a new `walkCopy.offRouteCard = { en, he }`.
- `turnInstruction` (`rejoin.ts:124`) adds `distanceM` and `bearing` to its return value (additive). The card renders the hint per language, with new he turn strings ("פנו שמאלה, 40 מ׳", "המשיכו ישר…", "הסתובבו…", "לכו צפונה…").
- New state:
  - `deviationAskedAt`: set in `askBeforeRedrawing` (`:2189`), cleared in `clearDeviationConfirmation` (`:736`);
  - `offRouteMeters`: from `deviation.deviationMeters` (`:2424`), rounded to 10 m, set only when it changes by ≥ 10 m.
- The `whileHereNote` ("While you're here…") is **not** on the centred card (it is a distraction when lost). The callout system still announces those places once the card is gone.

### 2.4 Files
New `src/components/walk/OffRouteCard.tsx`. Changed:
- `WalkHud.tsx` (new prop `center?: ReactNode`, rendered as a sibling of `WalkSheet`);
- `WalkPlannerApp.tsx` (the two branches build `offRouteCard` props instead of a `walkAlert`; the if/else chain keeps its priority, so nothing else shows while it is up);
- `walk-copy.ts`, `rejoin.ts`;
- tests `tests/walk-hud.test.tsx`, `tests/walk-planner-silence.test.tsx` (must stay green unchanged), `e2e/walk-hud.spec.ts`.

---

## 3. Social as a real feature

### 3.1 What exists (reused, not rebuilt)

| Thing | State | Where |
|---|---|---|
| `saved_walks`, `friendships` (requester/addressee, pending→accepted), `are_friends(a,b)`, `profiles.friend_code`, RPCs `my_friend_code`, `request_friend` (rate-limited, no existence leak), `list_friends` (label "Friend XXXX"), `friends_walks` | **In production** (TODO.md:358 pre-check 2026-11-01) | `20261024100000_saved_walks_friends.sql`, `20261024110000_friends_rpc.sql`, `src/lib/walks/friends.ts`, `FriendsPanel.tsx` |
| `walk_runs`, `saved_places` (Google = place_id only, a DB check) | In production | `20261024120000`, `20261024130000` |
| `community_optin`, aggregates, `place_recommendations`, `is_internal`, `excluded_poi_keys`, recommended map | Files only, **never run** (TODO.md:316) | `20261012110000`, `20261023*` |
| `20261027*` (quota, turn locks, learning consent) | Pending as of 2026-11-01 (TODO.md:358) | |
| `20261116100000_walk_geometry_variants.sql` | **Not applied** | |
| Flag `NEXT_PUBLIC_SOCIAL` (default OFF), with a comment saying S3 "friends nearby" must not be built | `src/lib/social/flag.ts` | Round 2 adds sub-flags and rewrites that comment (Ariel now asks for it) |
| Forget everything | `MEMORY_TABLES` + friendships special case | `src/app/api/forget-everything/route.ts:6-62` |
| LLM budget guard | `runLlm` / `runMeteredTurn`, per-caller call and dollar caps, global `LLM_DAILY_BUDGET_USD` (default $3) | `src/lib/llm/{llm-client,budget,config}.ts` |
| Google id → name/position, signed-in, Places-gated, ≤ 10 ids | `/api/places/resolve` | |
| Deny-by-default safety zones | `classifyPoint(p).status` | `src/lib/places/safety-zones.ts:335` |

Pre-existing leaks this round fixes:
- `saved_walks` lets an accepted friend `select` every column of a shared walk, including `start_lat/lng` (often home) and, once 20261116 is applied, `geometry`.
- `friends_walks()` returns raw `stops` with Google names and coordinates (R2 in the previous plan).
- `are_friends(a,b)` can be called with **any two** user ids, which reveals other people's friendships.

### 3.2 Scope and privacy defaults

| Feature | Default | Audience options | Needs |
|---|---|---|---|
| Social profile (display name chosen by the user, preset avatar) | **none**: no row means invisible, and no social feature works | | an 18+ self-attestation checkbox (not pre-ticked) |
| Profile visibility (card, "where I like to walk", walk history) | **private** | private / friends / public | profile |
| Show history (when not private) | on | on / off; a per-walk "hide from my profile" flag | profile |
| Walking now (coarse presence) | **off** | off / friends / public (public only in P8) | profile |
| Walk-together requests | follow the presence audience: whoever can see you walking can ask | | presence ≠ off on **both** sides |
| Taste tags on profile (P9) | off | on / off | profile, learning consent |

Location rules:
- No coordinates are stored for presence. Only a ~1 km grid cell (`floor(lat·100), floor(lng·100)` ≈ 1.1 × 0.94 km at 32°N) and the walk's city label.
- Expiry 20 min after the last heartbeat. The row is deleted at walk end, when going ghost, and when the audience is turned off.
- Nothing is published in the first 10 minutes **or** within 800 m of the walk start (home protection), nor outside `classifyPoint(...) === "allowed"` (deny zones, outside the Israel core).
- Never a dot on a map, never direction, speed or ETA.

### 3.3 Who sees what

| Data | Self | Accepted friend | Signed-in viewer with a profile, target **public** | Nearby stranger (P8) | Blocked (either way) / no profile / signed out |
|---|---|---|---|---|---|
| Display name + avatar | yes | yes (also the addressee of a pending request) | yes | yes, while both share "public" and walk within ~2 km | nothing |
| Card: member since (month), walk count, km, top 3 areas, top 3 categories | yes | if visibility ∈ friends/public | if public | if public | nothing |
| Walk history: city, **day** (no time), km, minutes, stops | own Walks screen | if visibility ∈ friends/public and show_history | if public and show_history | as public | nothing |
| Stop names/positions | all | non-Google stops, minus any within 300 m of the start | **OSM-sourced stops only**, minus 300 m of the start | as public | nothing |
| Google stops | all | category + `place_id` (name resolved live through `/api/places/resolve`) | same | same | nothing |
| Start point, route geometry, run start/end times, exact times | yes | **never** | never | never | never |
| Walking now | yes | city + "since" bucket (+ distance bucket when both are walking) | no | city + here/near + "since" bucket | nothing |
| Precise live location | **never stored, never shared** | | | | |
| Walk requests | own | can send and receive if both presence ≠ off | no | P8 only, both public within ~2 km | nothing |
| Whom I blocked; reports | own block list | never | never | never | never |

### 3.4 Data model and migrations (files only; Ariel pastes them in order)

Shared rules:
- Every function is `security definer`, with `set search_path = public, pg_temp`, no dynamic SQL and a fixed return shape.
- `revoke all on function … from anon, public`. This project's default ACL grants EXECUTE to anon on create, see TODO.md:320 and migration `20260824090000`.
- `grant execute … to authenticated` only for client-callable functions.
- Internal helpers are also revoked from `authenticated`.
- Parameters are named `p_*` (plpgsql column ambiguity).
- Trigger functions are revoked from everyone (the `20260828*` pattern).

#### A. `supabase/migrations/20261118100000_social_profiles.sql` (P4)

```sql
-- Round 2 social, part A: profiles, visibility, blocks, reports, safer friend reads.
-- NOT applied. Ariel pastes it into the Supabase SQL editor. Needs 20261024100000 + 20261024110000 (in production).
-- Deploy the P4 code BEFORE pasting this: friends_walks() stops carrying Google positions, and the P4 code resolves them.

alter table public.profiles add column if not exists is_internal boolean not null default false;
alter table public.saved_walks add column if not exists hidden_from_profile boolean not null default false;

create table public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (
    char_length(btrim(display_name)) between 2 and 30
    and display_name !~ '[@<>/\\]'        -- no emails, markup, urls
    and display_name !~ '[0-9]{5,}'),     -- no phone numbers
  avatar text not null default 'backpack' check (avatar in
    ('backpack','bench','binoculars','boot','bottle','camera','footprints','hat','signpost','stick','tent','thermos')),
  visibility text not null default 'private' check (visibility in ('private','friends','public')),
  show_history boolean not null default true,
  show_taste boolean not null default false,
  presence_audience text not null default 'off' check (presence_audience in ('off','friends','public')),
  adult_attested_at timestamptz not null default now(),
  public_consent_at timestamptz,
  presence_consent_at timestamptz,
  suspended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.social_profiles enable row level security;
revoke all on table public.social_profiles from anon, public;
revoke insert, update on table public.social_profiles from authenticated;   -- writes only through save_social_profile()
create policy "Read own social profile" on public.social_profiles for select to authenticated using (auth.uid() = user_id);
create policy "Delete own social profile" on public.social_profiles for delete to authenticated using (auth.uid() = user_id);

create table public.user_blocks (
  blocker uuid not null references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.user_blocks enable row level security;
revoke all on table public.user_blocks from anon, public;
revoke insert, update on table public.user_blocks from authenticated;      -- block only through block_user()
create policy "See whom I blocked" on public.user_blocks for select to authenticated using (auth.uid() = blocker);
create policy "Unblock" on public.user_blocks for delete to authenticated using (auth.uid() = blocker);
-- The blocked person can never read a block row: blocking is silent.

create table public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid references auth.users (id) on delete set null,
  target uuid references auth.users (id) on delete set null,
  context text not null check (context in ('profile','presence','walk_request','walk','name')),
  reason text not null check (reason in ('harassment','spam','fake','unsafe','minor','other')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'open' check (status in ('open','reviewed','actioned')),
  created_at timestamptz not null default now()
);
alter table public.abuse_reports enable row level security;
revoke all on table public.abuse_reports from anon, authenticated, public;  -- service role only; the owner reviews in the dashboard

-- Helpers (internal: not granted to authenticated)
create or replace function public.is_blocked(p_a uuid, p_b uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from public.user_blocks b
                 where (b.blocker = p_a and b.blocked = p_b) or (b.blocker = p_b and b.blocked = p_a));
$$;

-- are_friends v2: block-aware, and only about the caller's own relationships (was: any two ids).
-- Keeps its original parameter names (a, b) so CREATE OR REPLACE works.
create or replace function public.are_friends(a uuid, b uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() in (a, b)
     and not public.is_blocked(a, b)
     and exists (select 1 from public.friendships f
                 where f.status = 'accepted'
                   and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a)));
$$;

create or replace function public.can_view_profile(p_target uuid) returns boolean
  language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() is not null and (
    auth.uid() = p_target
    or exists (
      select 1 from public.social_profiles p
      join public.social_profiles me on me.user_id = auth.uid() and me.suspended_at is null   -- viewers need a profile (18+)
      where p.user_id = p_target and p.suspended_at is null
        and not public.is_blocked(auth.uid(), p_target)
        and (p.visibility = 'public' or (p.visibility = 'friends' and public.are_friends(auth.uid(), p_target)))));
$$;

-- What a stop list may show to someone else. Drops stops within 300 m of the walk start (home protection).
-- Google stops: category + place_id only. p_strict (non-friends): only stops with source 'osm' keep name/position.
create or replace function public.public_stops(p_stops jsonb, p_lat numeric, p_lng numeric, p_strict boolean)
returns jsonb language sql immutable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(
    case
      when coalesce(s->>'placeId', '') <> '' then jsonb_build_object('category', s->>'category', 'placeId', s->>'placeId')
      when p_strict and coalesce(s->>'source', '') <> 'osm' then jsonb_build_object('category', s->>'category')
      else jsonb_build_object('name', left(s->>'name', 80), 'category', s->>'category',
                              'lat', round((s->>'lat')::numeric, 5), 'lng', round((s->>'lng')::numeric, 5))
    end order by e.ord), '[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_stops) = 'array' then p_stops else '[]'::jsonb end)
       with ordinality as e(s, ord)
  where jsonb_typeof(s) = 'object'
    and (s->>'lat') ~ '^-?[0-9]{1,3}(\.[0-9]+)?$' and (s->>'lng') ~ '^-?[0-9]{1,3}(\.[0-9]+)?$'
    and sqrt(power(((s->>'lat')::float8 - p_lat::float8) * 111320, 2)
           + power(((s->>'lng')::float8 - p_lng::float8) * 111320 * cos(radians(p_lat::float8)), 2)) > 300;
$$;

-- Writes
create or replace function public.save_social_profile(
  p_display_name text, p_avatar text, p_visibility text, p_show_history boolean,
  p_show_taste boolean, p_presence_audience text, p_adult boolean)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  uid uuid := auth.uid();
  clean text := btrim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  cur public.social_profiles%rowtype;
begin
  if uid is null then return 'signin'; end if;
  select * into cur from public.social_profiles where user_id = uid;
  if found and cur.suspended_at is not null then return 'suspended'; end if;
  if not found and p_adult is not true then return 'adult_required'; end if;
  if found and cur.updated_at > now() - interval '3 seconds' then return 'rate_limited'; end if;
  if lower(clean) ~ '(traike|admin|support|official|moderator|staff|תמיכה|מנהל|צוות|טרייק)' then return 'name_reserved'; end if;
  begin
    insert into public.social_profiles as s (user_id, display_name, avatar, visibility, show_history, show_taste,
                                             presence_audience, public_consent_at, presence_consent_at)
    values (uid, clean, coalesce(p_avatar, 'backpack'), coalesce(p_visibility, 'private'), coalesce(p_show_history, true),
            coalesce(p_show_taste, false), coalesce(p_presence_audience, 'off'),
            case when p_visibility = 'public' or p_presence_audience = 'public' then now() end,
            case when p_presence_audience in ('friends', 'public') then now() end)
    on conflict (user_id) do update set
      display_name = excluded.display_name, avatar = excluded.avatar, visibility = excluded.visibility,
      show_history = excluded.show_history, show_taste = excluded.show_taste, presence_audience = excluded.presence_audience,
      public_consent_at = coalesce(s.public_consent_at, excluded.public_consent_at),
      presence_consent_at = coalesce(s.presence_consent_at, excluded.presence_consent_at),
      updated_at = now();
  exception when check_violation then return 'invalid';
  end;
  return 'ok';
end; $$;

create or replace function public.block_user(p_target uuid) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid();
begin
  if uid is null or p_target is null or p_target = uid then return false; end if;
  if (select count(*) from public.user_blocks where blocker = uid and created_at > now() - interval '1 day') >= 50 then return false; end if;
  insert into public.user_blocks (blocker, blocked) values (uid, p_target) on conflict do nothing;
  delete from public.friendships
   where (requester_id = uid and addressee_id = p_target) or (requester_id = p_target and addressee_id = uid);
  return true;
exception when foreign_key_violation then return false;
end; $$;

-- 3 distinct reporters (profiles older than a day) within 7 days -> the target's social visibility is suspended until reviewed.
create or replace function public.report_user(p_target uuid, p_context text, p_reason text, p_note text) returns boolean
  language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); n int;
begin
  if uid is null or p_target is null or p_target = uid then return false; end if;
  if (select count(*) from public.abuse_reports where reporter = uid and created_at > now() - interval '1 day') >= 10 then return false; end if;
  insert into public.abuse_reports (reporter, target, context, reason, note)
    values (uid, p_target, p_context, p_reason, nullif(left(btrim(coalesce(p_note, '')), 500), ''));
  select count(distinct r.reporter) into n
    from public.abuse_reports r
    join public.social_profiles sp on sp.user_id = r.reporter and sp.created_at < now() - interval '1 day'
   where r.target = p_target and r.created_at > now() - interval '7 days';
  if n >= 3 then
    update public.social_profiles set suspended_at = now(), visibility = 'private', presence_audience = 'off'
     where user_id = p_target and suspended_at is null;
  end if;
  return true;
exception when check_violation or foreign_key_violation then return false;
end; $$;
```
Also in file A (the builder writes the bodies from these specs):
- **`request_friend(code)` v2**: the existing body (`20261024110000`), plus `if public.is_blocked(uid, target) then return false; end if;` before any write. The same `false` hides the reason.
- **`request_friend_by_id(p_target uuid) returns boolean`**: the same rate limits as `request_friend`; refuse self, blocks, and `not public.can_view_profile(p_target)` (so only public profiles). Accept the request instead if they already asked. `on conflict do nothing`.
- **`social_profile_card(p_target uuid)`** returns `(display_name, avatar, visibility, relation text /*me|friend|other*/, member_since date /*month*/, walk_count int, km_total int, top_areas text[], top_categories text[], taste_tags text[] /*'{}' until E*/, friend_state text /*me|friends|pending_out|pending_in|none*/)`. It returns zero rows unless `can_view_profile(p_target)`. Counts and areas cover `status='completed' and not hidden_from_profile`. Areas and categories are `'{}'` when `not show_history` (except for self). Categories come from `jsonb_array_elements(stops)->>'category'`, limited to the 9 non-`other` enum values, top 3.
- **`social_profile_walks(p_target uuid, p_before timestamptz default null, p_limit int default 20)`** returns `(id, area_label, walked_on date, total_min, distance_m, stops jsonb)`:
  - completed, not hidden walks only;
  - visible when `p_target = auth.uid()` or `(show_history and can_view_profile(p_target))`;
  - `stops = public_stops(w.stops, w.start_lat, w.start_lng, not are_friends(auth.uid(), p_target))`, so the owner's own call shows the public view ("how others see me");
  - **no title** (titles start with a stop name, which may be Google content: `walk-history.ts:54-58`);
  - `limit least(greatest(p_limit,1),50)`, ordered by `coalesce(completed_at, created_at) desc`.
- **`list_friends()` v2**: `drop function if exists public.list_friends();` then create it with the extra columns `display_name text, avatar text`.
  - `label = coalesce(display_name, 'Friend ' || right(code,4))`;
  - name and avatar only when `status='accepted'` or the caller is the addressee;
  - exclude suspended profiles and blocked pairs;
  - re-apply revoke and grant after the drop.
- **`friends_walks()` v2** (same return signature): `stops = public_stops(w.stops, w.start_lat, w.start_lng, false)`, and exclude suspended owners. Blocks are handled through `are_friends`.
- **`list_my_blocks()`** returns `(user_id, display_name, avatar, created_at)` for the caller's own blocks.
- **Tighten** `saved_walks` select:

  ```sql
  drop policy if exists "Read own walks or friends' shared walks" on public.saved_walks;
  create policy "Read own walks" on public.saved_walks for select to authenticated using (auth.uid() = user_id);
  ```

  Friends read walks only through the RPC projections above. The only code that read a friend's walk directly is `getWalkById` in the variant route, and variants of friends' walks are already not offered.
- Grants:
  - authenticated gets `save_social_profile, block_user, report_user, request_friend, request_friend_by_id, social_profile_card, social_profile_walks, list_friends, friends_walks, list_my_blocks, are_friends`;
  - revoked from `anon, public, authenticated`: `is_blocked, can_view_profile, public_stops`.

#### B. `supabase/migrations/20261119100000_walk_presence.sql` (P6)

```sql
create table public.walk_presence (
  user_id uuid primary key references public.social_profiles (user_id) on delete cascade,
  token uuid not null default gen_random_uuid() unique,      -- opaque, new every walk; strangers see only this
  cell_y integer not null check (cell_y between -9000 and 9000),    -- floor(lat * 100)
  cell_x integer not null check (cell_x between -18000 and 18000),  -- floor(lng * 100)
  area_label text check (area_label is null or char_length(area_label) <= 60),
  audience text not null check (audience in ('friends','public')),
  since timestamptz not null,                                 -- rounded down to 15 min
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index walk_presence_cell_idx on public.walk_presence (cell_y, cell_x);
create index walk_presence_expires_idx on public.walk_presence (expires_at);
alter table public.walk_presence enable row level security;
revoke all on table public.walk_presence from anon, authenticated, public;   -- no policies: RPC only

create or replace function public.set_my_presence(p_cell_y integer, p_cell_x integer, p_area text, p_new_walk boolean)
returns boolean language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid(); prof public.social_profiles%rowtype; cur public.walk_presence%rowtype; fresh boolean;
begin
  if uid is null then return false; end if;
  select * into prof from public.social_profiles where user_id = uid;
  if not found or prof.suspended_at is not null or prof.presence_audience = 'off' then
    delete from public.walk_presence where user_id = uid; return false;
  end if;
  delete from public.walk_presence where expires_at < now() - interval '10 minutes';          -- housekeeping
  select * into cur from public.walk_presence where user_id = uid;
  -- a "new walk" may move anywhere, at most once per 10 minutes
  fresh := not found or cur.expires_at <= now() or (coalesce(p_new_walk, false) and cur.updated_at < now() - interval '10 minutes');
  if found and not fresh then
    if cur.updated_at > now() - interval '60 seconds' then return true; end if;                -- one write a minute
    if abs(p_cell_y - cur.cell_y) > 3 or abs(p_cell_x - cur.cell_x) > 3 then return false; end if;  -- no jumps
  end if;
  insert into public.walk_presence as w (user_id, cell_y, cell_x, area_label, audience, since, expires_at, updated_at)
  values (uid, p_cell_y, p_cell_x, nullif(left(btrim(coalesce(p_area, '')), 60), ''), prof.presence_audience,
          to_timestamp(floor(extract(epoch from now()) / 900) * 900), now() + interval '20 minutes', now())
  on conflict (user_id) do update set
    token = case when fresh then gen_random_uuid() else w.token end,
    since = case when fresh then excluded.since else w.since end,
    cell_y = excluded.cell_y, cell_x = excluded.cell_x, area_label = excluded.area_label,
    audience = excluded.audience, expires_at = excluded.expires_at, updated_at = now();
  return true;
exception when check_violation then return false;
end; $$;

create or replace function public.clear_my_presence() returns void
  language sql security definer set search_path = public, pg_temp as $$
  delete from public.walk_presence where user_id = auth.uid();
$$;
```
- **`walking_now()`** returns `(token uuid, friend_id uuid, display_name, avatar, relation text, area_label, since_bucket text, distance_bucket text, profile_visible boolean)`:
  - B version is **friends only**;
  - the caller needs their own profile, not suspended, with `presence_audience <> 'off'` (reciprocity: no lurking);
  - rows: `walk_presence p` with `expires_at > now()`, `p.user_id <> auth.uid()`, `are_friends(auth.uid(), p.user_id)` (which covers blocks), and the owner's profile not suspended;
  - `since_bucket`: `just_started` (< 15 min), `about_30` (< 45 min), `over_45`;
  - `distance_bucket`: `null` unless the caller is walking too, else Chebyshev cell distance 0 → `here`, ≤ 2 → `near`, else `far`;
  - `profile_visible = can_view_profile(p.user_id)`;
  - `order by p.updated_at desc limit 30`.
- Trigger `social_profiles_presence_guard` (`after update of presence_audience, suspended_at`): delete the presence row when the audience is `off` or the profile is suspended; otherwise copy the new audience onto the row.
- Grants: authenticated gets `set_my_presence, clear_my_presence, walking_now`. The trigger function is revoked from everyone.

#### C. `supabase/migrations/20261119110000_walk_requests.sql` (P7)

```sql
create table public.walk_requests (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.social_profiles (user_id) on delete cascade,
  to_user uuid not null references public.social_profiles (user_id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  -- Meeting place: OSM key + name + position (open data), or a Google place_id ONLY (Maps Platform terms).
  meet_kind text not null check (meet_kind in ('osm','google')),
  meet_ref text not null check (char_length(meet_ref) between 5 and 200),
  meet_name text check (meet_name is null or char_length(meet_name) between 1 and 80),
  meet_lat numeric(9,6), meet_lng numeric(9,6),
  check ((meet_kind = 'osm' and meet_ref ~ '^osm-(node|way|relation)-[0-9]{1,15}$'
          and meet_name is not null and meet_lat is not null and meet_lng is not null)
      or (meet_kind = 'google' and meet_ref ~ '^[A-Za-z0-9_-]{10,200}$'
          and meet_name is null and meet_lat is null and meet_lng is null)),
  meet_at timestamptz not null,
  from_note text check (from_note in ('on_my_way','late_10','here','cant_make_it')),
  to_note text check (to_note in ('on_my_way','late_10','here','cant_make_it')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (from_user <> to_user)
);
create index walk_requests_to_idx on public.walk_requests (to_user, created_at desc);
create index walk_requests_from_idx on public.walk_requests (from_user, created_at desc);
alter table public.walk_requests enable row level security;
revoke all on table public.walk_requests from anon, authenticated, public;   -- RPC only
```
- **`send_walk_request(p_to_user uuid, p_meet_kind, p_meet_ref, p_meet_name, p_meet_lat, p_meet_lng, p_meet_in_min int) returns uuid`**. Every refusal returns `null`, so the caller cannot tell the reasons apart. Checks:
  - `p_meet_in_min in (0,10,15,30,45,60)`;
  - both profiles exist, are not suspended, and have `presence_audience <> 'off'`;
  - `are_friends(uid, p_to_user)` (D adds nearby walkers through a separate function);
  - sender ≤ 5 per hour and ≤ 20 per day;
  - no open (pending/accepted, unexpired) request between the pair in either direction;
  - recipient has < 10 pending.

  Then: housekeeping `delete … where created_at < now() - interval '7 days'`; set `meet_at = date_trunc('minute', now()) + p_meet_in_min min` and `expires_at = now() + (p_meet_in_min + 30) min`; `exception when check_violation then return null`.
- **`respond_walk_request(p_id, p_accept boolean) returns boolean`**: `to_user = auth.uid()`, pending, unexpired, not blocked → `accepted` / `declined`, `responded_at = now()`.
- **`cancel_walk_request(p_id) returns boolean`**: either side, pending or accepted, unexpired → `cancelled`.
- **`set_walk_request_note(p_id, p_note text) returns boolean`**: either side of an accepted, unexpired request; the note is in the enum; at most one change per 15 s (`updated_at`).
- **`my_walk_requests()`** returns `(id, direction 'in'|'out', status /*'expired' when open and past expires_at*/, other_id, other_name, other_avatar, meet_kind, meet_ref, meet_name, meet_lat, meet_lng, meet_at, my_note, their_note, created_at)`. Last 24 h, not blocked, `limit 20`.
- Trigger `user_blocks_side_effects` (after insert on `user_blocks`): cancel open requests between the pair.
- Grants: authenticated gets the five RPCs. The trigger function is revoked.

#### D. `supabase/migrations/20261125100000_nearby_walkers.sql` (P8; paste only after counsel + DPIA)
- `walking_now()` replaced: the friends branch `union all` a **nearby** branch.
  - The caller's own presence must be unexpired with `audience='public'`.
  - Rows: `p.audience='public'`, unexpired, not self, not friends, `not is_blocked`, owner not suspended, `abs(dy) ≤ 2 and abs(dx) ≤ 2`.
  - Returns `friend_id = null`, `relation='nearby'`, `distance_bucket` here/near.
  - `limit 20` for this branch.
- `send_walk_request_nearby(p_token uuid, …same meet params) returns uuid`: resolves the target from an unexpired `public` presence token within 2 cells of the caller's own `public` presence; then the same checks and insert as C. Both functions call one internal `_insert_walk_request(...)` helper, which is revoked from authenticated.
- `social_profile_card_by_token(p_token uuid)`: the card for a nearby walker, only if `can_view_profile` (public profile). It includes `user_id` so "add friend" can call `request_friend_by_id`.
- Not having D in the database is the gate. Before it is pasted, no stranger can be listed or contacted, whatever the client does.

#### E. `supabase/migrations/20261126100000_taste_summaries.sql` (P9, optional)
- `taste_summaries(user_id pk → auth.users on delete cascade, summary jsonb check (object, ≤ 2048 bytes), tags text[] check (cardinality ≤ 6 and tags <@ array[...the enum in 3.9...]), based_on_walks smallint, model text, prompt_id text, created_at timestamptz default now())`.
- RLS: own select, insert, update and delete for authenticated; revoked from anon and public.
- `social_profile_card` replaced: `taste_tags = case when sp.show_taste then coalesce(ts.tags,'{}') else '{}' end`.

### 3.5 RLS and grants summary

| Table | anon | authenticated, direct | Through RPC |
|---|---|---|---|
| `social_profiles` | none | select/delete own row | write `save_social_profile`; others' data only via card/walks/walking-now projections |
| `user_blocks` | none | select/delete own (as blocker) | insert `block_user` |
| `abuse_reports` | none | none | insert `report_user`; read by the service role only |
| `saved_walks` | none | **own rows only** (tightened) | friends' and public projections |
| `walk_presence` | none | none | `set_my_presence`, `clear_my_presence`, `walking_now` |
| `walk_requests` | none | none | the five request RPCs |
| `taste_summaries` | none | own rows | card shows tags only |

### 3.6 API surface

The browser calls the social RPCs directly with the user session, the same pattern as `src/lib/walks/friends.ts`. Next routes exist only where server logic is needed:

| Route | Method | Phase | What it does |
|---|---|---|---|
| `/api/social/presence` | PUT `{lat,lng,areaLabel?,newWalk?}` | P6 | Checks the flag, auth and zod. If `classifyPoint` is not `allowed` → `clear_my_presence`, `{shared:false}`. Otherwise computes the cell and calls `set_my_presence`. **lat/lng are never logged or stored.** In-memory limiter 6/min/user. |
| `/api/social/presence` | DELETE | P6 | `clear_my_presence` |
| `/api/social/walking-now` | GET | P6 | Flag, auth, limiter 4/min; `walking_now()`. Returns only the bucket keys and the client renders the copy. |
| `/api/places/resolve` | POST (exists) | P5, P7 | Google `place_id` → name and position for display (≤ 10, Places-gated, nothing stored) |
| `/api/social/taste` | GET (cached) / POST (regenerate) | P9 | Flag, auth, `hasLearningConsent`. Cooldown 7 days unless ≥ 3 new completed walks. `runLlm` (T1) with ctx `{userId, ip}` under the budget guard; `LlmBudgetExceededError` → 429 `resting`. |
| `/api/forget-everything` | (exists) | P4+ | Also deletes `social_profiles` (cascades presence and requests), `user_blocks` where `blocker`, and `taste_summaries` |

Client modules (new):
- `src/lib/social/profiles.ts`, `presence.ts`, `presence-publisher.ts`, `walk-requests.ts`, `avatars.ts`, `copy.ts`;
- `src/lib/hooks/useSocialInbox.ts`.

Flags in `flag.ts`, all default OFF: `socialProfilesEnabled()` (`NEXT_PUBLIC_SOCIAL_PROFILES`), `presenceEnabled()` (`NEXT_PUBLIC_SOCIAL_PRESENCE`), `nearbyEnabled()` (`NEXT_PUBLIC_SOCIAL_NEARBY`), `tasteEnabled()` (`NEXT_PUBLIC_TASTE_SUMMARY`). Replace the "S3 deliberately NOT built" comment with a pointer to this plan.

### 3.7 Presence publisher (pure, unit-tested; `src/lib/social/presence-publisher.ts`)

Input per tick: `{ nowMs, walking, startedAtMs, startPoint, position, accuracyM, pageVisible, hiddenSinceMs, ghost, audience, zoneAllowed }`.

Decision:
- **clear** if not walking, ghost, audience off, `!zoneAllowed`, or hidden for over 5 min;
- **wait** (send nothing) while `now − start < 10 min` or `distance(position, startPoint) < 800 m`, or when accuracy > 100 m;
- **publish** when there was no publish yet (`newWalk:true` on the first one), 5 min have passed since the last one, or the cell changed (at most once per 60 s).

The class wraps it with an injected clock and fetch. `WalkPlannerApp` creates it when a walk starts (only when `presenceEnabled()` and the profile audience ≠ off) and calls `clear` on End walk and on unmount.

Tests cover: home-zone suppression, deny zone, ghost, 5-min heartbeat, cell change, a cell change within 60 s, end of walk, hidden over 5 min, and no fetch when the flag is off.

### 3.8 Walk together (P7, friends; P8 adds nearby)

- **Ask** (Social › walking-now row › "הליכה ביחד", or a profile): `WalkTogetherSheet`.
  - Meeting place chips:
    - (1) the sender's next 2 upcoming stops (when walking);
    - (2) "ליד המיקום שלי": the nearest registered OSM place from the sender's discovery collection;
    - (3) search (the existing start-location search). A Google result is sent as `place_id` only. When the map provider is Leaflet, Google results are excluded.
  - Time chips: עכשיו / 15 / 30 דק׳.
  - One safety line: "נפגשים רק במקום ציבורי".
  - [שליחה].
- **Receive**: `useSocialInbox` polls `my_walk_requests()` every 30 s while the document is visible, signed in, with a profile and the flag on. It publishes counts to `PlannerBridge`, which adds to the Social tab badge next to `friendRequests`.
  - During a walk, an incoming request is a sheet alert: "{name} רוצה ללכת איתכם · {place} · בעוד 15 דק׳" [אישור] [לא עכשיו] ⋯ (block/report).
  - Alert priority: rebuilding > selected callout > off-route > pace confirmation > **walk request** > companion > shortcut > pace advisory.
  - Outside a walk it appears on Home (context card) and in Social › בקשות.
- **After accept**, both sides see a card: "נפגשים ב-{place} · 16:40" [הוספה למסלול] [ביטול] and note chips (בדרך / באיחור של 10 דק׳ / כאן / לא מסתדר).
  - "הוספה למסלול" calls `addPlaceToLiveWalk` from P1. A Google place is resolved through `/api/places/resolve` first, and its name and position are never stored.
  - There is no free text, so nothing needs moderation. No live location is shared, in v1 or ever without a new plan.
- Expiry: open requests show as expired after `meet_at + 30 min`. Rows are purged after 7 days.

### 3.9 Abuse, blocking, reporting, minors, legal

- **Block** (silent) is on every profile, walking-now row, request card and friend row (⋯ menu). It deletes the friendship, cancels open requests, and hides both people from each other everywhere. Unblock from Me › פרטיות › חסומים.
- **Report**: reasons הטרדה / ספאם / חשבון מזויף / לא בטוח / קטין / אחר, plus an optional note ≤ 500 chars visible only to the owner. "Block too" is ticked by default in the same sheet, and the report sheet is the only place anything is pre-ticked: it is a safety choice, not consent. At 3 distinct reporters in 7 days the target is auto-suspended (private, presence off). The owner reviews `abuse_reports` in the Supabase dashboard.
- **Reserved names** are refused (`traike, admin, support, official, moderator, staff, תמיכה, מנהל, צוות, טרייק`), so nobody can impersonate the app.
- **Minors**: every social feature needs the 18+ attestation at profile creation (an unticked checkbox, "אני בגיל 18 ומעלה"). This goes beyond GDPR Art. 8's default of 16. It is self-attested and weak, and counsel decides whether it is enough. A report with reason "minor" shows first in the review queue (sort by reason in the dashboard).
- **Consent** (GDPR Art. 6(1)(a)/7, and the Israeli PPA position paper on separate opt-in per purpose, cited in SOCIAL_PLAN_V2 §2.3):
  - separate, unticked choices for profile visibility above private, walking-now audience, nearby-public (P8, its own consent sheet) and taste summary (P9);
  - each has one line saying what is shared, and withdrawing is one tap;
  - consent times are stored (`public_consent_at`, `presence_consent_at`);
  - "Forget everything" erases all of it except `abuse_reports` (kept for safety, documented in the privacy notice: a counsel item).
- **Israel PPL Amendment 13**: location may be "especially sensitive" (the sources conflict, PERSONALIZATION_SOCIAL_PLAN §4.1), so we treat it as sensitive: coarse cells, 20-min expiry, no history of presence, and a DPIA before P8 goes live.
- **Google terms**: only `place_id` for Google places in `walk_requests`. Google stops in shared history are projected to category + `place_id`. No Google names go to the taste LLM. No Google content on Leaflet.
- **Soldiers / sensitive sites**: no presence outside `classifyPoint` "allowed" (deny zones, and everything outside the Israel core). The presence consent line says not to share on a base.
- **Privacy notice**: there is no privacy page today (review S10). P5 adds `src/app/privacy/page.tsx` as a **draft** covering the social data in 3.3, the presence expiry, the IP-city lookup, on-device storage, reports retention and the contact `APP_CONTACT`. It is marked for counsel review. Nothing goes to production with the flags on before counsel signs it.
- **Taste summary (P9)** input: own completed walks only (≤ 30), stop **categories** for all stops, OSM stop names only, city labels, own standing facts. All of it is fenced as `<data>`. Output, validated by zod, `schemaVersion: 1`:
  - `bullets` ≤ 3, ≤ 90 chars;
  - `tags` ⊆ {nature, views, food, coffee, history, museums, markets, parks, quiet, urban, beach, religious, shopping, family, long_walks, short_walks, loops, night};
  - `areas` ⊆ the input labels (others dropped on the server).

  Other people see only the `tags`, and only with `show_taste`. The prose stays private.

---

## 4. App structure and screens

### 4.1 Information architecture (builds on the shell: `AppShell.tsx`, `?view=`, `TabBar`, `Rail`)
```
/app?view=home       Home (hub)                        tab: בית
/app?view=walks      Walks: &tab=history|saved|places   tab: הליכות   (planner side panel full-size + map preview on desktop)
/app?view=plan       Plan (task screen, no tab bar)    centre (+)
/app?view=walk       Live walk (no tab bar)
/app?view=social     Social hub (overlay like Home/Me) tab: חברים  (+ badge: friend + walk requests)
   &u=<uuid>         a profile (friend / public / me)
   &w=<token>        a nearby walker's card (P8)
   &add=<CODE>       invite link: confirm "add friend"
/app?view=me         Me (overlay)                      tab: אני
```
- Social becomes an AppShell overlay (like `HomeView` and `MeView`), not the planner's side panel. In `AppShell`, `plannerShown` drops `social`. The friend "Plan this walk" body moves from `WalkPlannerApp.tsx` (`sideTab === "friends"` block) into a planner function published on `PlannerBridge` as `actions.planSharedWalk(walk)`. Before building, it resolves `placeId`-only stops through `/api/places/resolve`. `FriendsPanel` stays for the no-shell unit-test path.
- Profile and invite views are params on `social`, so Back (`history.back()`) returns to the list.
- Desktop: the existing 72px Rail. Overlays use `lg:start-[72px]`.

### 4.2 Shared kit (P3)
- `src/components/shell/ScreenHeader.tsx`: display title 28/34 Secular One at the start, up to 2 glyph actions (44px) at the end, top padding `max(24px, env(safe-area-inset-top))`, not sticky.
- `src/components/shell/Segmented.tsx`: `role="tablist"`, 48px, the selected tab is a tinted pill with a soft shadow (border-fix, never a bare border), Hebrew labels.
- `src/components/shell/ChoiceTile.tsx`: a whole-tile button with a large 3D image overlapping the top-end corner, title 22/28 Secular One, one line 15px or one big thin number. Variants `primary` (terra-tinted gradient to paper) and `plain` (paper).
- `src/components/ui/ModalSheet.tsx`: a bottom sheet on phones and a centred 480px dialog on desktop; focus trap, Esc, drag handle, 280 ms `cubic-bezier(.2,.8,.2,1)`.
- `src/components/social/Avatar.tsx`: one of the 12 accessory PNGs (`public/images/traike/accessories/*`) on a tinted circle (forest, terra or sun at 15%), sizes 40/56/96. No new art.
- Skeleton rows: 3 rounded `bg-forest/5` bars, no shimmer under reduced motion.

### 4.3 Screens (phone 390; RTL; tab bar on hubs only)

**Home** (≤ 4 blocks: greeting · continue walk if any · choice grid · one context card)
```
┌──────────────────────────────────────┐
│ [hub-mountain-lake-sunset / hub-night, blurred, cream wash]
│  ערב טוב, דנה                        │ 36/40 Secular One
│ ┌──────────────────────────────────┐ │ only when a walk is live or unfinished
│ │ ● ההליכה ממשיכה · 2/5   [ המשך ] │ │
│ └──────────────────────────────────┘ │
│ ┌──────────────┐ ┌──────────────┐    │ two tiles 172×196, gap 14
│ │         [🧭] │ │         [🥾] │    │ compass.png / boot.png (3d)
│ │ מסלול חדש    │ │ ההליכות שלי  │    │
│ │ כמה זמן יש?  │ │ 12           │    │ one line / one big number
│ └──────────────┘ └──────────────┘    │
│ ┌──────────────────────────────────┐ │ context card, first that applies:
│ │ (●●) דנה ורון הולכים עכשיו     › │ │ incoming walk request > friends walking now
│ └──────────────────────────────────┘ │ > last walk [הולכים שוב] > invite a friend
├──────────────────────────────────────┤
│  בית   הליכות   (+)   חברים    אני     │
└──────────────────────────────────────┘
```
- Greeting name: the social display name if there is one, else the first word of `user_metadata.full_name`, else no name. **Never the email local part** (`src/app/app/page.tsx:31` today).
- "ההליכות שלי" → `?view=walks&tab=history`. "מסלול חדש" → `?view=plan`.
- Desktop: a 960px column; greeting; a 3-column grid with "מסלול חדש" spanning 2 columns (260px tall, bigger compass) next to "ההליכות שלי"; row 2 has the context card (2 columns) and the last walk with its `RouteSketch` (1 column).

**Walks**
```
 [folded-map.svg soft background + wash]
 הליכות                                  ScreenHeader
 [ היסטוריה | שמורים | מקומות ]           Segmented (scrolls away)
 ┌────────────────────────────── [🥾] ┐
 │ [RouteSketch 72] נמל יפו              │ title dir=auto
 │ אתמול · 4.2 ק״מ · 95 דק׳            │ one line
 │ [ הולכים שוב ]   גרסה ▾        ⋯     │ ⋯ = הסתרה מהפרופיל (P5), מחיקה
 └──────────────────────────────────────┘
 empty: tent.png + "עוד אין הליכות" + [ מסלול חדש ]
```
- History = completed walks or walks with runs. Saved = `status='saved'` plus drafts (planned, never walked, with a "טיוטה" chip). Places = `SavedPlacesTab`. This completes the prior plan's deviation ("Walks | Places") and translates the labels (review N4).
- Desktop: the list column (420px) next to the planner map. Selecting a card previews it (existing `showWalkOnMap`).

**Social hub** (`SocialView`)
```
 [meadow-hikers photo + wash]
 חברים                        (my avatar) (+👤)
 ┌────────────────────────────── [🎒] ┐  only without a profile:
 │ פרופיל, ואז רואים מי הולך            │  one line + [ יצירת פרופיל ]
 └──────────────────────────────────────┘
 הולכים עכשיו            [ אני: חברים ▾ ]  audience chip (off / friends / [public P8])
  (av) דנה · יפו · ~30 דק׳        [ הליכה ביחד ]
  (av) רון · ממש קרוב (P8)        [ הליכה ביחד ]
  "אף אחד לא הולך כרגע"                     one line when empty
 בקשות (only if any)  friend + walk requests: [ אישור ] [ לא ]
 החברים שלי  (av)(av)(av)(av) ›              horizontal row → profiles
 מסלולים של חברים  card · [ ללכת את זה ]      existing friends_walks feed
 [ הזמנת חבר ]                               navigator.share(/app?view=social&add=CODE), copy fallback
```
- Desktop: two 460px columns (walking now + requests | friends + feed).
- Polling: `walking-now` every 60 s while the Social view is visible. No polling elsewhere, except the inbox.

**Profile** (`?view=social&u=…`)
```
 [meadow-hiker.jpg hero 200px + wash]   (av 96, overlapping the hero's bottom edge)
 דנה                                     28/34
 [ 34 ] [ 126 ] [ יפו ]                   three big thin numbers: walks · km · favourite area
  הליכות   ק״מ    אזור
 טבע · נוף · קפה                          taste chips (P9, if shown)
 אוהבים ללכת ב: יפו · הירקון · נווה צדק    one line
 [ הליכה ביחד ] (walking now & allowed)   [ הוספת חבר ] (public & not friends)
 הליכות אחרונות
  יפו · אתמול · 4.2 ק״מ · 5 תחנות ›        tap: stop list (OSM names, Google names resolved
                                          live, "+2 מקומות" for hidden ones) + [ ללכת את זה ]
 ⋯ : חסימה · דיווח
```
- "Me" variant: [עריכה] and "איך אחרים רואים אותי" (the public projection).
- Desktop: a 720px column.

**Profile edit** (`ModalSheet`): name field, avatar grid (4×3), visibility `Segmented` (פרטי / חברים / כולם) with one line under it saying what that option shows, "להציג היסטוריה" toggle, walking-now audience (כבוי / חברים; "כולם בסביבה" only with `nearbyEnabled()`), the 18+ checkbox (creation only), [שמירה], and a text button "מחיקת הפרופיל החברתי". Errors are mapped from the RPC codes (`adult_required`, `name_reserved`, `invalid`, `rate_limited`, `suspended`) to one line each.

**Me** (`hero-tent-sunrise.jpg` + wash): cards in this order:
1. חשבון
2. הפרופיל החברתי (avatar, name, visibility chip, [עריכה]; P5)
3. פרטיות (walking-now audience, show history, חסומים list, מחיקת הנתונים החברתיים; P5/P6)
4. תצוגה
5. הגדרות הליכה
6. מה Traike זוכר
7. הטעם שלי (P9)
8. רענון
9. קרדיטים

**Live walk** additions: the off-route card (P2), the notice row (P1), the sharing chip "משתפים · חברים" with one-tap "הסתרה" in the sheet's top row (P6, only while actually publishing), and the request card (P7).

### 4.4 Visual rules (from calm-site-taste, applied per screen)
- One atmospheric background per hub screen (existing assets: `hub-*`, `meadow-hikers*`, `meadow-hiker.jpg`, `hero-tent-sunrise.jpg`, `folded-map.svg`) under a cream wash; night uses `hub-night.jpg` or the dark wash.
- One 3D object per main card, tied to its meaning: compass (new route), boot (walks / walk again), pin (places), backpack (social), signpost (off-route), binoculars (nearby, P8), tent (empty states). Nothing new without the `asset-brief` gate.
- Type: Secular One for display, Heebo for body, numbers 28–48px Heebo 300 tabular. Minimum 13px. No uppercase labels.
- Tokens only (`--tk-*`, existing Tailwind colours). The design-token guard test (`tests/design-tokens.test.ts`) is extended to `src/components/{shell,social}`.
- Motion: taps 160 ms, sheets 280 ms, view cross-fade 200 ms, none under reduced motion.
- Run the prior plan's anti-slop checklist (§7.3) before every hand-off, plus a line count per screen.

---

## 5. Phases (small → large; the production bug first)

### P1. "Yes" adds the stop (S–M)
- Files:
  - `src/lib/walk/companion/{companion-types,operator-map,companion-glue}.ts`, `producers/pace.ts`;
  - `src/lib/walk/planner-actions.ts` (`buildAddPlaceRebuildRequest`);
  - `src/lib/hooks/useWalkChat.ts` (affirm);
  - `src/lib/walk/chat/affirm.ts` (new: the normaliser and set);
  - `src/lib/walk/walk-copy.ts` (`notice`);
  - `src/components/walk/WalkHud.tsx` (`notice` prop);
  - `src/components/planner/WalkPlannerApp.tsx`: `handleBuildWalk` return value; `addPlaceToLiveWalk`, `addStopFromOffer`, `addBestStopOrFill`; `case "add-place"`; result notices; the dead `else` in `addStopViaChat`.
  - tests from 1.4.
- Acceptance:
  1. The companion "Add it" adds exactly the named place, pinned, and the sheet shows "Added: X" with an Undo that restores the previous plan.
  2. In propose mode, "Extend the hike" and "Add a stop" add the best place ahead directly, with no chat call.
  3. A typed כן / yes after a single proposal runs it with zero network calls; a second כן is a no-op.
  4. A rebuild that fails, or returns the same stops, shows a visible notice on the sheet.
  5. All 1.4 tests pass, and their mutations fail.
- Verify in the browser: the simulator walk with "Fast pace" at 390×844, Hebrew and English. Screenshot the question, the "Added" notice and Undo.
- Not verifiable here: a real fast walk on a phone; the owner's Sol chat (needs the owner key; Ariel tests it on the phone).

### P2. Off-route card (S)
- Files as in 2.4.
- Acceptance:
  1. The card is `[data-testid=off-route-card]` outside the sheet, `role="alertdialog"`. At 390×844 its box is horizontally centred (|left − right| ≤ 2 px) and vertically centred in the map area (±24 px), at least 340px wide, and every action is ≥ 56px tall (the dismiss ≥ 44px).
  2. The same accessible names as today ("Back to my route", "Best route from here", "Tell me what you want", "I know where I'm going").
  3. The silence test is unchanged and green: no answer for 90 s → `runLocalRejoin`.
  4. Tapping the scrim minimises it to the pill, and tapping the pill restores it.
  5. Hebrew copy and the Hebrew turn hint render RTL.
  6. Day and night screenshots, phone and desktop, using the simulator's "Stray 80 m".
- Tests: extend `tests/walk-hud.test.tsx` (structure, minimise/restore, sizes by class); keep `walk-planner-silence.test.tsx` and `deviation-*` green; add an e2e geometry assertion in `e2e/walk-hud.spec.ts`.
- Not verifiable here: sunlight legibility, one-hand reach, vibration on a real Android phone (iOS has no vibrate).

### P3. Screen kit, Home choices, Walks segments (M)
- Files:
  - new `ScreenHeader`, `Segmented`, `ChoiceTile`, `ModalSheet`;
  - `HomeView.tsx` (choice grid + context card with only last walk and invite for now);
  - `src/app/app/page.tsx` (greeting name source);
  - `AppShell.tsx` (`tab` param for Walks);
  - `WalkPlannerApp.tsx` (Walks segments, the 3-way split and Hebrew labels at `:3564-3578`);
  - `MyWalksPanel.tsx` (a `segment` filter: history/saved);
  - `MeView.tsx` (order and background);
  - `tests/design-tokens.test.ts` (scope);
  - `e2e/app-shell.spec.ts`.
- Acceptance:
  1. Home shows ≤ 4 blocks; the tiles navigate (`?view=plan`, `?view=walks&tab=history`).
  2. Walks has 3 Hebrew segments that filter correctly (unit test with fixture walks: completed, saved, draft).
  3. No email text on Home.
  4. The app-shell e2e passes at 390 and 1440; hydration e2e passes.
  5. Screenshots of every hub, day and night, phone and desktop.
- Not verifiable here: signed-in data on Walks and Home (no test account in production, the same gap as Phase 6 before). Ariel checks on his phone.

### P4. Social foundation, migration A (M; no new screens)
- Files:
  - `supabase/migrations/20261118100000_social_profiles.sql`;
  - `supabase/checks/social_rls_check.sql` (new; see below);
  - `src/lib/walks/walk-history.ts` (`stopsFromAttractions` adds `source: "osm" | "google" | "other"`);
  - `src/lib/walks/saved-walks.ts` (`SavedStop.source?`);
  - `src/lib/social/{flag,profiles,avatars,copy}.ts`;
  - `src/lib/walks/friends.ts` (`FriendRow.displayName/avatar`, tolerant sanitizer);
  - `src/app/api/forget-everything/route.ts` (+ tables, the `user_blocks` blocker case);
  - `WalkPlannerApp.tsx` (the friend "Plan" resolves `placeId`-only stops via `/api/places/resolve`);
  - tests: `tests/social-migration-a.test.ts` (SQL text), `tests/social-profiles-lib.test.ts`, `tests/forget-everything.test.ts`, `tests/friends.test.ts`.
- SQL text tests assert:
  - every `create … function` has `security definer` and `set search_path = public, pg_temp`;
  - every function has a matching `revoke … from anon, public`;
  - `is_blocked`, `can_view_profile` and `public_stops` are revoked from authenticated;
  - no `execute format`;
  - `are_friends` contains `auth.uid() in (a, b)`;
  - `public_stops` contains the `> 300` filter and the `placeId` strip;
  - the saved_walks select policy is own-only;
  - `list_friends` is dropped then created and then granted;
  - the display name checks and the reserved-name regex are present.
- `supabase/checks/social_rls_check.sql`: a single `begin; … rollback;` script for the SQL editor with placeholders `:user_a`, `:user_b` (Ariel's two account UUIDs). It impersonates each user (`set local role authenticated; select set_config('request.jwt.claims', json_build_object('sub', '<uuid>', 'role', 'authenticated')::text, true);`), creates two profiles, and asserts with `do $$ … raise exception … $$`:
  - B cannot select A's `social_profiles`, `user_blocks` or `saved_walks` rows;
  - `social_profile_card(A)` is empty for B while A is private, and returns a row after A goes public;
  - `social_profile_walks` hides start-adjacent stops and Google names;
  - after `block_user`, `are_friends` is false, the card is empty and `request_friend_by_id` is false;
  - `are_friends(A, C)` called by B is false/null.

  Everything is rolled back, so nothing persists.
- Acceptance:
  1. Tests green; tsc and lint clean.
  2. Before the migration, the app behaves exactly as today: the friend list still shows "Friend XXXX", and no social calls are made with the flags off (spy test).
  3. New walks' stops carry `source`.
  4. The friend "Plan" works with both stop shapes (unit test with a `placeId`-only stop, the resolve route mocked).
- Ariel: deploy P4 code (when he chooses) → read and paste migration A → run the check script with his two UUIDs → report the output.

### P5. Social screens: profiles, history, block/report (L)
- Files:
  - `AppShell.tsx` (the Social overlay; `u`, `add` params);
  - new `src/components/social/{SocialView,ProfileView,ProfileEditSheet,BlockReportSheet,Avatar,FriendRow}.tsx`;
  - `MeView.tsx` (profile + privacy cards, blocked list);
  - `MyWalksPanel.tsx` (⋯ "הסתרה מהפרופיל" → `updateWalk(id, { hidden_from_profile })`, tolerant before A);
  - `HomeView.tsx` (greeting uses the display name);
  - `src/lib/shell/planner-bridge.ts` (`planSharedWalk`);
  - `src/app/privacy/page.tsx` (draft, counsel-flagged);
  - tests.
- Acceptance:
  1. With `NEXT_PUBLIC_SOCIAL_PROFILES=1` and A applied: create a profile (18+ required, reserved names refused); switch private / friends / public and see the matching projection through "איך אחרים רואים אותי".
  2. A friend's profile shows the card, areas, categories and history without start-adjacent stops, Google stops with names resolved live, and no titles.
  3. Block hides both ways immediately; a report is filed; unblock works.
  4. The invite link adds a friend.
  5. Without A, or with the flag off, the Social screen shows today's friends features only, with no errors.
  6. Component tests: no profile → create card; private profile viewed by another → "the profile is private" empty state; `BlockReportSheet` calls `block_user` then `report_user`; `ProfileEditSheet` maps every RPC error code.
  7. Screenshots of Social, Profile and Edit (he/en, day/night, 390/1440).
- Not verifiable here: two real accounts (Ariel, or a staging project).

### P6. Walking now, friends (M–L; migration B)
- Files:
  - migration B;
  - `src/app/api/social/presence/route.ts`, `src/app/api/social/walking-now/route.ts`;
  - `src/lib/api/rate-limit.ts` (two limiters);
  - `src/lib/social/{presence,presence-publisher}.ts`;
  - `WalkPlannerApp.tsx` (publisher lifecycle + sharing chip prop);
  - `WalkHud.tsx` (chip);
  - `SocialView` (walking-now section + audience chip);
  - `HomeView` (context card "N friends walking");
  - `MeView` (audience);
  - tests: publisher (3.7), routes (flag off → 404; not allowed zone → `{shared:false}` and clear; lat/lng never in logs, via a spy on `console`), SQL text tests for B (no select policy on `walk_presence`, revokes, 60 s / 3-cell / 10-min rules present).
- Acceptance:
  1. Two simulated sessions (unit level) prove: nothing is sent in the first 10 min / 800 m; heartbeat every 5 min; clear on End walk and on ghost; chip visible only while publishing.
  2. A friend sees "דנה · יפו · ~30 דק׳" within 60 s of the first publish, and stops seeing it ≤ 20 min after the other phone dies.
- Not verifiable here: two phones walking (Ariel with two accounts); iOS background throttling (expiry covers it, but this must be measured).

### P7. Walk together, friends (L; migration C)
- Files:
  - migration C;
  - `src/lib/social/walk-requests.ts`, `src/lib/hooks/useSocialInbox.ts`;
  - `src/components/social/{WalkTogetherSheet,RequestCard,MeetCard}.tsx`;
  - `WalkPlannerApp.tsx` (request alert + meet card + "הוספה למסלול" via `addPlaceToLiveWalk`);
  - `planner-bridge.ts` (counts);
  - `TabBar`/`Rail` badge sum;
  - tests: SQL text (limits, the OSM/Google check, expiry, block trigger), lib sanitizers, `WalkTogetherSheet` (Google pick sends `place_id` only, no name; Leaflet provider hides Google results), inbox polling (visible only; stops when hidden; no calls with the flag off), alert priority unit test.
- Acceptance:
  1. Request → the other account sees it within 30 s → accept → both see the meet card → "הוספה למסלול" pins the place with an "Added" notice.
  2. Decline, cancel, expire and block all behave as specified.
  3. Never any free text.
- Not verifiable here: a real two-phone meeting; Places resolve billing with real keys.

### P8. Nearby walkers, strangers (M; migration D; gated)
- Gate before the production flag: counsel review of the consent copy and the privacy notice, a DPIA (location, strangers, Israel PPL A13 + GDPR Art. 35), and Ariel's explicit OK. Build and test behind `NEXT_PUBLIC_SOCIAL_NEARBY` locally or in Preview only.
- Files:
  - migration D;
  - `presence-publisher` (audience public);
  - `SocialView` (nearby rows, binoculars accessory);
  - a consent sheet: 3 lines ("אחרים שהולכים לידכם יראו שם ואזור, לא מיקום", "רק כשגם הם משתפים", "אפשר להסתיר בלחיצה"), an unticked checkbox, [הפעלה];
  - `WalkTogetherSheet` (by token);
  - `ProfileView` (by token);
  - tests (SQL text: the public branch needs the caller's own public presence within 2 cells; friends excluded from the nearby branch; `friend_id` null).
- Acceptance: with two accounts sharing "public" within ~2 km, each sees the other as "ממש קרוב / קרוב" and can send a request by token. With either side on friends-only, or > 2 cells apart, nothing shows.

### P9. AI taste summary (optional, last; S–M; migration E)
- Files:
  - migration E;
  - `src/lib/llm/tasks/taste-summary.ts` + prompt;
  - `src/app/api/social/taste/route.ts`;
  - `MeView` card "הטעם שלי" ([יצירה] → bullets + tags; "להציג תגיות בפרופיל" → `show_taste`);
  - `ProfileView` chips;
  - eval cases (6, of which 3 Hebrew and 2 injections through OSM place names) in the existing eval runner;
  - tests (cooldown; consent off → 403 and zero LLM calls; schema rejects unknown tags and foreign areas; budget exceeded → 429).
- Acceptance: one call at most per user per 7 days (or after 3 new walks), cached; the prose is never shown to others; no Google names in the prompt (test on the built prompt).

---

## 6. What needs a phone or a second account

| Item | Why it can't be proven here | Who / how |
|---|---|---|
| Fast-pace add on a real walk | real GPS pace, Sol owner chat with paid keys | Ariel: walk briskly in propose mode, once in Hebrew |
| Off-route card in the street | sunlight, finger reach, vibration | Ariel's phone, simulator first, then a real stray |
| RLS for migrations A–D | needs real JWTs | `supabase/checks/social_rls_check.sql` with Ariel's two UUIDs (rolled back), then two accounts in the app |
| Walking now | two devices, background throttling, 20-min expiry | two phones or phone + laptop, two accounts |
| Walk-together | real-time accept/decline across devices | two accounts |
| Nearby strangers | two accounts physically within ~2 km | after the P8 gate |
| Google resolve in shared history and meeting places | real Places key and billing | Ariel, signed in |
| Hebrew copy | native review | Ariel |
| Legal (consent copy, privacy draft, DPIA, minors) | not an engineering call | counsel |

---

## 7. Token and cost impact

- **P1** reduces model use. A typed "yes" no longer costs an owner Sol turn (capped at `WALK_TURN_CEILING_USD` $0.08 per turn) or a keyword-chat intent call (`/api/walk-chat`). Adding a concrete place is deterministic: one `/api/walk-plan` rebuild (the same ORS cost as the rebuild it replaces), no LLM.
- **P2 and P3**: zero.
- **P4–P8**: zero LLM. Supabase load is small:
  - presence ≤ 1 write a minute (typically 1 per 5 min) per sharing walker;
  - `walking-now` every 60 s only while Social is open;
  - the inbox every 30 s while the app is visible, signed in and with a profile.
- **Google Places Details**: only for Google stops a viewer opens and for Google meeting places, ≤ 10 ids per request, behind the existing per-user Places gate (`placesDailyCap`).
- **P9 (opt-in)**: at most 1 T1 call per user per 7 days, about 1.5–2.5k input and ≤ 400 output tokens. At the pinned default `gemini-3.1-flash-lite` ($0.25 / $1.50 per 1M, per PERSONALIZATION_SOCIAL_PLAN §5.2, dated 2026-10-12, not re-verified) that is about $0.001 per summary. A Sol-class $2/$10 model would be about $0.01. Every call goes through `runLlm` with caller context, so the per-caller caps (free: 60 calls, $0.25 per day) and `LLM_DAILY_BUDGET_USD` (default $3) apply.

---

## 8. Risks

- **R1** `WalkPlannerApp.tsx` (4,386 lines) is touched by P1, P2, P6 and P7. Mitigation: logic goes in `src/lib/**`, the component gets targeted edits only, and the existing walk-hud, silence and planner suites must stay green each phase.
- **R2** The `handleBuildWalk` return value: an early return missed means a wrong notice. A test covers success, revert, error, and the "same stops" case.
- **R3** Applying migration A before the P4 code ships breaks the friend "Plan" for Google stops (no positions any more). The migration header says code first, and the P4 code works with both shapes.
- **R4** Tightening the `saved_walks` select drops direct friend reads. Only the variant route used them, and friend variants are not offered. Grep `from("saved_walks")` again before the PR.
- **R5** Stranger discovery (P8) is the highest-risk feature: stalking, coercive control, minors who lie about their age. It is kept behind the missing migration D plus the flag plus counsel, and limited to coarse cells, expiry, reciprocity, rotating tokens, block, report and auto-suspend. Residual risk: a display name can be followed across walks within ~2 km while both walk. This is documented in the DPIA.
- **R6** Report brigading (3 accounts suspend someone). It only hides social visibility, and the owner reviews and restores. Reporters must have profiles older than a day.
- **R7** `are_friends` v2 now returns false for third-party pairs. Any caller relying on the old behaviour would break. Grep showed only the `saved_walks` policy and the RPCs use it.
- **R8** Presence on iOS stops when the tab is backgrounded. The 20-min expiry means a dead phone can look "walking" for up to 20 minutes, which is acceptable.
- **R9** The deny-by-default `classifyPoint` means no presence outside the Israel core (tourists abroad). This is intentional for v1.
- **R10** `supabase/checks/` is a new folder of manual scripts. Never wire it into CI against production.
- **R11** The legal gate: social reaches real users only after the legal / public-site gate (memory: launch sequencing). All flags are OFF in the production env until Ariel says otherwise.
- **R12** The pre-existing failure `assistant-chat-undo` hides new failures in that file. Its fix (review N1) is not in scope and must not be "fixed in passing".

---

## 9. Decisions I made on Ariel's behalf

1. "Yes" on an ahead-of-pace offer adds **that exact place**, pinned, and extends the clock if it would not fit. Nothing is re-planned around it.
2. In "propose" mode, "Extend the hike" / "Add a stop" adds the best place ahead **without** opening the chat. The chat opens only in "ask" mode, or when no place is found.
3. A typed yes (כן, סבבה, יאללה, yes, ok…) confirms the last single proposal on the device, with no model call. Anything longer goes to the assistant as today.
4. Every add shows a result line on the walk sheet, with Undo. Failures say so on the sheet too, not only in Details.
5. The off-route card is centred over the map (never over the sheet or the Google logo), and can be minimised to a pill. Its countdown bar shows the silent return to the route. "While you're here" leaves this card. There is one short vibration on Android.
6. The dismiss "I know where I'm going" stays as a quiet text button under the three actions (in Hebrew "הכול בסדר, ממשיכים ככה"). It is not a fourth big button.
7. The social profile is opt-in: no profile means invisible. It needs a user-chosen name (no email, phone, or reserved words) and one of 12 preset avatars made from existing accessory art. No photo uploads.
8. Visibility defaults to **private**. When it is not private, history shows by default, with a per-walk "hide from my profile".
9. Shared history never includes the start point, the route line, times of day or titles. Stops within 300 m of the start are hidden. Public viewers see names only for OSM stops. Google stops are shown by category + `place_id`, with the name looked up live.
10. Walking now: a ~1 km cell plus the city name. Nothing in the first 10 minutes or 800 m. 20-minute expiry. Friends only until P8. You see others only if you share too.
11. Presence consent is a setting (off / friends / later public) with a visible "sharing" chip and one-tap hide during the walk. There is **no per-walk prompt**. Counsel may require one.
12. Walk-together uses fixed template notes only (no free text, no chat), a public meeting place, and **no live location sharing** at all.
13. Strangers nearby is its own phase behind its own migration, flag and legal sign-off. It is built so that it cannot be switched on by the client alone.
14. 18+ self-attestation is required for every social feature.
15. Three distinct reports in 7 days auto-suspend social visibility until the owner reviews. Reporting blocks by default.
16. Social becomes its own screen (like Home and Me) instead of the planner's side panel. Profiles and invites are URL params.
17. Home shows two big choices (New route, My walks) and one context card. Walks gets History / Saved / Places, in Hebrew.
18. The greeting never uses the email address.
19. Existing friendships, friend codes and the friends' walks feed are reused, not replaced. `are_friends` is hardened in place.
20. Friends lose direct table access to each other's walks. They read them through projections that strip home-adjacent and Google data.
21. No push notifications. In-app polling only (30 s inbox, 60 s walking-now while Social is open).
22. The AI taste summary is opt-in, at most weekly, uses categories only for Google stops, and stays private except its fixed tags. It is the last phase and optional.
23. No new art. Every background and 3D object comes from `public/images/**`.
24. All new flags default OFF in production. Ariel turns them on himself, after he has pasted each migration.

## 10. For counsel (not questions for Ariel)
- Is the consent model enough: a per-feature setting plus an in-walk indicator, with no per-walk prompt? Is it enough for the P8 stranger feature?
- Is the 18+ self-attestation sufficient, under Israeli guardianship law and GDPR Art. 8?
- Retention of `abuse_reports` after "forget everything" and after account deletion.
- Amendment 13 classification of coarse presence, and whether a DPO or database registration duty applies at scale.
- The privacy notice draft (`src/app/privacy/page.tsx`) and the GDPR Art. 3(2) applicability for tourists.
- Whether showing OSM-sourced stop names on public profiles needs attribution beyond the existing app credits.
