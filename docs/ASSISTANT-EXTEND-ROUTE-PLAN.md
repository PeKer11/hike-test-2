# Assistant "extend the route": root causes and fix plan

Date: 2026-11-19 · Branch: `feat/walk-detail` · Status: investigation only, no source changed.

**Bug (owner, in Hebrew):** the walker has a route on the map and writes something like "בוא נאריך את המסלול, יש לי עוד שעה". Traike answers that it extended it, but the map keeps showing the old route.

**Baseline:** `npx vitest run` gives 3225 passed and 1 failed. The failure is `tests/assistant-chat-undo.test.tsx`, which is known and unrelated (see section 7).

---

## 1. How the request flows today

1. `AssistantChat.send()` (`src/components/assistant/AssistantChat.tsx:463`) POSTs `{chatId, message, origin, timeZone, defaults, queued?, walking?}`. **No field describes the walk on the map.** In planner mode `queued` holds only the wishlist (`WalkPlannerApp.tsx:3959`). Mid-walk it holds the remaining stops as names and coordinates (`:3954-3958`).
2. `POST /api/assistant` (`src/app/api/assistant/route.ts`) loads the stored chat state (`candidates`, `chosen`, `params`, `limitsSettled`) and the last 16 text messages. It then runs `runAssistantTurn`.
3. `runAssistantTurn` (`src/lib/assistant/turn.ts:123-144`) shows the model three things: "Places already found (ids)", the limits, and the start. **It never says which candidates make up the current walk.** `state.chosen` is written at `tools.ts:1271` and never read back. The walk's minutes and km came back only in a tool result, and tool results are not stored.
4. **Only `build_walk` can change the map.** It returns `action: {type:"build", …}` (`tools.ts:1263-1276`). `set_walk_params`, `estimate_walk` and `make_variant` change nothing on screen.
5. When the turn has no `action`, the model's free text is returned as is (`turn.ts:172-173`, wrap-up `:239-261`). Nothing compares the reply with what happened.
6. When a build does happen, the client receives `data.action` and calls `onBuild(...)` and ignores the result (`AssistantChat.tsx:496-518`). `WalkPlannerApp.onBuild` (`:3973-4012`) then runs one of two paths:
   - **Planner path.** It calls `handleBuildWalk(...)`, then `/api/walk-plan`, then `showPlan()`. That sets `walkPlan`, the waypoints and the route.
   - **Mid-walk path.** It calls `buildOptionRebuildRequest(midWalk, stops)` (`:3984-3998`), then `handleBuildWalk(autoResume)`.
7. The map draws `walkPreview` first when one is set: `waypoints={walkPreview?.waypoints ?? waypoints}`, `routeGeometry={walkPreview ? [] : …}`, `previewRoutes=[walkPreview.geometry]` (`WalkPlannerApp.tsx:4668-4672, 4711-4712`).

## 2. Root causes (confirmed)

| # | Root cause | Evidence |
|---|---|---|
| **RC1** | **When a saved walk is open on the map, no build can be seen.** The map draws `walkPreview` instead of the plan, and neither `handleBuildWalk` nor `showPlan` clears it. The only places that clear it are Clear All (`:1105`), Close/Walk on the pill (`:4722, 4726`) and starting a walk (`:1316`). This is a regression from **889145f (2026-11-18)**. That commit changed the clearing effect from `sideTab !== "walks" \|\| walkMode` to `walkMode` only (`:1314-1317`). The preview now stays visible on the plan screen, which is where the chat is. Since 228c9f0/5f161d0, tapping a walk card or "Show on map" opens exactly that state (`:3918-3923`). | Code plus `git show 889145f` |
| **RC2** | **The reply is not tied to the action.** The model can say "הארכתי" while `action` is undefined. Ways a turn ends with no build: the model waits for a confirmation; a weather or safety question is open; `build_walk` is refused (`limits not asked yet` `tools.ts:1232`, `does not fit` / `breaks rules` `:1241-1244`, `too long` `:1237`); a lookup fails; or the turn hits the 90 s wrap-up. | Repro: a scratch test ran `runAssistantTurn` with a mocked model that sets `time_minutes:150` and then says "הארכתי את המסלול בשעה". It returned that reply unchanged with `action: undefined`. |
| **RC3** | **The model is never told which walk is "the route".** `chosen` is never shown to it (`turn.ts:123-128`). The request carries no current walk (step 1). A reload or "New chat" resets `chatId` (`AssistantChat.tsx:317`) to an empty state. A walk opened from Walks or Walk again is unknown to the chat. So "extend" leaves the model to guess. It may rebuild from scratch, use `recall_walks`/`make_variant longer` (which returns stop names without candidate ids, `tools.ts:1139-1151`), or give up. | Code. Repro: the prompt contains no current-walk or `chosen` marker. |
| **RC4** | **"Another hour" is relative, but the tools only take absolute time.** `set_walk_params.time_minutes` means "limits the walker EXPLICITLY stated" (`tools.ts:222-224`, schema `tool-schemas.ts:75-92`). The model does not know the walk's current minutes, so it may set 60. That *shrinks* the limit, and `build_walk` then refuses with "does not fit" (feeds RC2). **Mid-walk the client also throws the assistant's time away.** `buildOptionRebuildRequest` always uses `max(15, original − elapsed)` (`planner-actions.ts:515-519, 568-580`) and never reads `build.availableMinutes`. | Repro: original 120 min, 100 min elapsed, walker says "another hour". The rebuild still gets **20 min**. |
| **RC5** | **The instructions conflict.** The `build_walk` description says "Call only after the walker confirmed the stops" (`tools.ts:403`), while the prompt says to build in the same turn (`prompt.ts:4,7`). The mid-walk note says "never add a stop they did not ask for" (`route.ts:191`). For "extend" mid-walk the model therefore rebuilds the *same* stops, with the client's *old* remaining time (RC4), and the line on the map looks unchanged. | Code |
| **RC6** | **The client never tells the chat when a build fails.** `onBuild` returns `void`. When `/api/walk-plan` fails, the planner shows an error or (mid-walk) `revertToSnapshot` puts the old route back (`WalkPlannerApp.tsx:1549-1555, 1599-1612`). The chat bubble still says the walk was extended. | Code |

## 3. Which path hit the owner (hypotheses)

- **H1, most likely.** He opened a saved walk from Walks or the walk detail page (the map shows a "<title> · Close ✕" pill), then asked the chat. The chat built a route, but the preview hid it (RC1). It fits the timing: the preview change landed on 11-18.
- **H2.** Planner mode with no preview: the turn ended without a build (RC2 + RC4 + RC5).
- **H3.** During a live walk: the same stops were rebuilt with the old remaining time, so the line looks the same (RC4 + RC5).
- **To confirm:** ask the owner whether the "Close ✕" pill was on the map and whether he was walking. Read-only, in the Supabase SQL editor: open his last `assistant_messages` row and check whether `assistant_chats.state->'chosen'` changed in that turn.

## 4. Fix list (in priority order; each step stands alone)

### F1, P0: a new plan always replaces the preview (fixes RC1; 1 line)
- `src/components/planner/WalkPlannerApp.tsx`, `showPlan()` (`:1144`): add `setWalkPreview(null);` as the first line. Every build, snapshot restore and option pick goes through this function. Leave the `:1314-1317` effect as it is: the preview should still survive the jump from Walks to the map until something new is drawn.

### F2, P0: the server never lets a reply claim a change that did not happen (RC2 guard)
- `src/lib/assistant/turn.ts`:
  - Add the constants `CLAIM_CHANGE = /(הארכתי|עדכנתי|הוספתי|בניתי|שיניתי|הוארך|עודכן|נבנה|\bI(?:'ve| have)? (?:extended|updated|added|built|rebuilt|changed|lengthened)\b|\b(?:is|has been) (?:extended|updated|rebuilt)\b)/i` and `ROUTE_WORD = /(מסלול|הליכה|מפה|\broute\b|\bwalk\b|\bmap\b)/i`.
  - Inside `finish()` (`:112`): when `!action && CLAIM_CHANGE.test(reply) && ROUTE_WORD.test(reply)`, append the server line in the walker's language. Hebrew: `⚠ המפה לא השתנתה: לא נבנה מסלול חדש בהודעה הזו.` English: `⚠ The map has not changed: no new route was built in this message.` Also set a closure variable `honestChoice = [hebrew ? "בנו את המסלול" : "Build the walk"]`.
  - Return `choices: choices ?? honestChoice` from all three return points (`:173`, `:235`, `:255-261`).
- `src/lib/assistant/prompt.ts`: add one rule: "The map changes only when build_walk returns built: true in this turn. Never say the walk was built, extended or changed otherwise; if you stop to ask, say what you will build once they answer. If the background has no 'walk on the map', there is nothing to extend: say so in one sentence and offer to plan one."
- `src/lib/assistant/tools.ts:403` (`build_walk` description): replace "Call only after the walker confirmed the stops." with "This is the only way the map changes. Call it in the same turn once the stops fit; wait only while a safety or weather question is open."

### F3, P1: send the walk on the map to the assistant (fixes RC3)
- `src/lib/assistant/state.ts`:
  - Add the type `CurrentWalk = { source: "plan" | "saved" | "walking"; start: Coordinates; stops: { name: string; coordinates: Coordinates; category?: string }[]; totalMin?: number; remainingMin?: number }`.
  - Add two per-turn `AssistantState` fields: `current?: { ids: string[]; source: CurrentWalk["source"]; totalMin?: number; remainingMin?: number }` and `timeSetThisTurn?: boolean`. Comment both as "never stored", which holds because `asState` (`stored-state.ts:40-50`) copies only whitelisted fields.
- **New** `src/lib/assistant/current-walk.ts`:
  - `parseCurrentWalk(v)` validates the client payload: at most 12 stops, names through `cleanUntrustedText(…,120)`, coordinates through `parseOrigin`, minutes 0..1440, and a source from the enum.
  - `seedCurrentWalk(state, walk)` gives each stop a candidate. It reuses a candidate within 40 m (`haversineDistance`). Otherwise it mints `c${highest existing N + 1}` with `placeId: "walk:<lat5>,<lng5>"` and maps the category to a known kind or `"other"`. No Places call is made. Mint from the highest N, not from `candidates.length`: expired candidates make the length-based scheme in `addCandidates` collide. The function then sets `state.chosen = ids` and `state.current = {ids, source, totalMin, remainingMin}`.
  - `currentWalkNote(state)` returns one line: "The walk on the map now (<source>): stops in order <id name; …>; about <totalMin> min (<remainingMin> min of it left). 'Extend', 'longer' or 'I have another hour' mean THIS walk: keep these ids in this order, set_walk_params add_minutes, find_nearby around the last id for the added time, then estimate_walk and build_walk with these ids first plus the new ones (ordered=true) in the same turn."
- `src/app/api/assistant/route.ts`:
  - Add `current?: unknown` to `AssistantRequest`. After the origin step (`:205`), call `parseCurrentWalk` and then `seedCurrentWalk`.
  - When `source === "saved"` and the walker is not walking, set `state.origin = current.start`. The client's `onSetOrigin` sync (`AssistantChat.tsx:482-483`) then follows.
  - Add `currentWalkNote` to `memoryNote`. It is fenced as untrusted, which matters because stop names come from the client.
  - Rewrite the mid-walk sentence (`:191`) so it refers to "the walk on the map" ids instead of the queued names. Keep "never propose places they already passed". Replace "never add a stop they did not ask for" with "add stops only when they ask for more (extend, longer, more time, another stop)".
- `src/components/assistant/AssistantChat.tsx`: add the prop `getCurrentWalk?: () => CurrentWalk | null`. In `send()` (`:463`), add `...(cur ? { current: cur } : {})`.
- `src/components/planner/WalkPlannerApp.tsx`:
  - Pass `getCurrentWalk` to `<AssistantChat>` (`:3947`). It reads refs at send time:
    1. If `walkPreview?.walk` is set: `{source:"saved", start: walk.start, stops: walk.stops, totalMin: walk.totalMin}`.
    2. Else, if `walkPhaseRef.current === "walking"`: `{source:"walking", start: input.origin, stops: <orderedAttractions not in visitedAttractionIds>, totalMin: plan.totalMinutes, remainingMin: max(0, round(min(input.availableMinutes, plan.totalMinutes) − elapsed))}`, where `elapsed = (Date.now() − walkStartTimeRef.current)/60000`.
    3. Else, if `walkPlanRef.current` is set: `{source:"plan", start: walkInputRef.current.origin, stops: orderedAttractions, totalMin: plan.totalMinutes}`.
    4. Else `null`.
  - Mid-walk, `queuedPlaces` (`:3952-3958`) should then hold only the wishlist extras. The remaining stops now arrive as `current`, so the model does not spend 8 Places calls looking them up again.

### F4, P1: relative time (fixes the RC4 server half)
- `tool-schemas.ts` `set_walk_params`: add `add_minutes: z.number().min(1).max(600).optional()`.
- `tools.ts`, the `set_walk_params` definition (`:222-244`): add the property `add_minutes` ("extra minutes on top of the walk on the map; 'another hour' = 60; the server adds them").
- `tools.ts`, the `set_walk_params` handler (`:843`), before `if (t)`:
  - Compute `base = state.current?.remainingMin ?? state.current?.totalMin`.
  - If `add` is given and there is no base, return `{error:"no walk on the map to extend: ask how long the whole walk should be"}`.
  - Otherwise set `state.params.timeMinutes = Math.round(base + add)`. `add_minutes` wins over `time_minutes`.
  - Set `state.timeSetThisTurn = true` whenever `t` or `add` is applied. Echo `{time_minutes, from: base}` in the output.
- `tools.ts` `build_walk` action (`:1275`): add `...(state.timeSetThisTurn ? { timeStated: true } : {})`. Add `timeStated?: boolean` to `BuildAction` (`state.ts:136`) with the comment "mid-walk: minutes from now".

### F5, P1: a mid-walk rebuild honours the assistant's time (fixes the RC4 client half)
- `src/lib/walk/planner-actions.ts`: change the signature to `buildOptionRebuildRequest(state, stops, opts?: { minutesFromNow?: number })`. When `opts.minutesFromNow` is set, return `{...req, input: {...req.input, availableMinutes: Math.max(MIN_REBUILD_MINUTES, opts.minutesFromNow)}}`.
- `AssistantChat.tsx:498-517`: add `timeExplicit: data.action.timeStated === true` to `AssistantBuild` (type at `:48`).
- `WalkPlannerApp.tsx:3986`: call `buildOptionRebuildRequest(midWalk, [...stops, ...extraWishlist], build.timeExplicit ? { minutesFromNow: build.availableMinutes } : undefined)`.

### F6, P2: the chat says so when the map did not change (fixes RC6)
- `AssistantChat`: change the type to `onBuild: (b) => Promise<boolean> | void`. At `:498`, use `void Promise.resolve(onBuild({...})).then((shown) => { if (shown === false) setMessages((m) => [...m, {role:"assistant", content: he ? "⚠ המפה לא עודכנה: לא הצלחתי לבנות את המסלול החדש. לנסות שוב?" : "⚠ The map was not updated: the new route could not be built. Try again?"}]) })`. Do not await inside `send`, so `pending` clears as it does today. Detect Hebrew with `/[֐-׿]/`.
- `WalkPlannerApp` `onBuild`: in both branches, return `handleBuildWalk(...).then((p) => p !== null)`.
- Known limit: a build superseded by a newer one also resolves `null`. The note "was not updated" is still true for this route.

### F7, optional: fix the unrelated test
- `tests/assistant-chat-undo.test.tsx:40-43`: capture `signal` only when `url === "/api/assistant"`. The cause is that `undoSend` fires `/api/assistant/cancel` (`AssistantChat.tsx:430`) without a signal, which overwrites the captured one with `undefined`. The product behaviour is correct.

## 5. Tests to add (★ = fails today)

1. ★ `tests/assistant-turn.test.ts`: "a reply that claims an extension without build_walk gets the server line and a Build choice". Mock: `set_walk_params` first, then content "הארכתי את המסלול בשעה". Expect `action` undefined, the reply to match `/המפה לא השתנתה/`, and `choices` to equal `["בנו את המסלול"]`. Add a twin where `build_walk` really ran: no line.
2. ★ `tests/planner-actions.test.ts`: `buildOptionRebuildRequest(state120min_elapsed100, stops, {minutesFromNow: 80}).input.availableMinutes === 80`. Without opts it stays `20`.
3. ★ `tests/assistant-turn.test.ts` (runTool): `set_walk_params {add_minutes:60}` with `current.totalMin 95` gives `timeMinutes 155` and `timeSetThisTurn`. With `remainingMin 20` it gives 80. With no current walk it returns the "no walk on the map" error.
4. ★ New `tests/assistant-current-walk.test.ts`:
   - `parseCurrentWalk` drops bad coordinates, caps 12 stops and cleans names.
   - `seedCurrentWalk` reuses a candidate within 40 m, mints non-colliding ids, and sets `chosen`/`current`.
   - `runAssistantTurn` with a seeded state puts "walk on the map" and the ids in the fenced context, not in the system message.
5. ★ `tests/assistant-chat-walking.test.tsx`:
   - The body carries `current` from `getCurrentWalk`.
   - `timeStated: true` reaches `onBuild` as `timeExplicit: true`.
   - When `onBuild` resolves `false`, the "המפה לא עודכנה"/"was not updated" note appears.
6. ★ New `tests/walk-planner-preview-build.test.tsx`: the RC1 regression.
   - Mock `@/lib/hooks` with `useIsSignedIn: () => true`. Mock `@/lib/supabase/client` with the chain from `assistant-chat-undo.test.tsx:4-9`, plus `insert/update/single/maybeSingle/auth`.
   - Mock `@/components/walks/MyWalksPanel` with a button that calls `onOpenOnMap(savedWalk)`.
   - Mock `@/components/assistant/AssistantChat` with a button that calls `onBuild(build)`.
   - Mock `DynamicMap`, extended from `walk-planner-app.test.tsx:41-72` to expose `previewRoutes.length` and `routeGeometry.length`.
   - Render with `view="walks"`, open the walk, then press build and wait for the `/api/walk-plan` stub. **Expect 0 preview routes and the built route drawn.** Today the preview stays.
7. Optional, paid, owner-run only: `tests/llm-eval/extend-live.test.ts`, modelled on `variant-live.test.ts`. Gate it on `RUN_LIVE_EXTEND_EVAL`. Feed "בוא נאריך את המסלול, יש לי עוד שעה" with a seeded current walk, and assert `set_walk_params(add_minutes≈60)` and then `build_walk` with all current ids plus at least one new id.

## 6. Edge cases the builder must keep right

- **No walk on the map** (`current` null, no preview, no plan): "extend" gets one sentence saying there is nothing to extend and an offer to plan. No claim (F2 prompt and guard).
- **Walk in progress:**
  - Base = the walk's remaining minutes.
  - Visited stops are never sent (filtered by `visitedAttractionIds`) and are excluded again in `handleBuildWalk` (`:1480-1483`).
  - The origin is the live position. `current.start` must not override it when `walking`.
  - The end anchor is kept (`planner-actions.ts:548`).
  - The "back to previous route" undo still works, because the mid-walk path uses `autoResume` snapshots.
- **Planner mode with no time limit set:** the base is `plan.totalMinutes` (the walk's real length). Never use `availableMinutes`, which can be the 480 "no limit" value.
- **Saved walk previewed:** the extension starts at the walk's start (`source:"saved"`). Building saves a *new* walk; the saved one is unchanged. F1 then replaces the preview on the map.
- **Build refused or a lookup failed** ("does not fit", rules broken, Places limit reached, ORS down, turn timeout): `action` is undefined, so the F2 line and the "Build the walk" choice appear. The reply never claims success.
- **`/api/walk-plan` fails or the network is offline after a build:** the F6 note appears. Mid-walk, the old route is restored and the note is true.
- **"Extend, and drop X" in the same message:** do not hard-require every current id in `build_walk`. The prompt says "keep", and the model may drop what the walker named.
- **Weather or safety question open:** no build this turn. The reply asks, the guard stays silent (no past-tense claim), and the next answer builds.
- **Image attached:** unchanged. Rules relaxed from an image are still refused (`turn.ts:185`).

## 7. Notes

- `tests/assistant-chat-undo.test.tsx` is **not related**. It is a test-mock bug (F7). Undo itself works: the server returns 499 and saves nothing.
- In planner mode an assistant build clears `previousPlan` (`:1455-1457`), so an extension cannot be undone there. This is existing behaviour and out of scope; mention it to the owner.
- The in-walk companion (`walk-turn.ts`, `/api/walk-assistant`) has no time tool and already says "never say it is already done". Its quick commands (`walk/chat/intent.ts:54`) do not match "עוד שעה" or "נאריך", so such sentences fall through to "Send to Traike", which is the path fixed here.

## 8. Verification checklist (builder)

1. `npx vitest run`: everything green except the undo test (or that one too, if F7 is done). The new ★ tests fail before the fix and pass after.
2. `npx tsc --noEmit` and `npm run lint` are clean.
3. Local manual check (`npm run dev`, signed in, desktop and phone width):
   - Walks → tap a walk → map with "Close ✕" → chat: "בוא נאריך את המסלול, יש לי עוד שעה". **Expect:** the preview pill disappears, the new longer route is drawn, the old stops are kept, the reply quotes the new minutes, and My walks has a new walk while the original is unchanged.
   - Plan a walk in the chat → "extend, another hour". **Expect:** same stops plus new ones, total ≈ old + 60.
   - Simulate a walk → after a few stops, "יש לי עוד שעה, תאריך". **Expect:** the route is redrawn from the current position, the remaining stops plus new ones, and the HUD time budget grows by about 60.
   - Turn off the network (DevTools offline) after sending. **Expect:** no "extended" claim without the ⚠ line or note.
   - New chat with no walk → "extend the route". **Expect:** "there's no walk yet" plus an offer.
4. No paid API calls in unit tests. The live eval (5.7) runs only when the owner opts in.
5. Do **not** deploy (launch gate). Per the owner's Traike rule: commit and push the branch, then zip the repo to `~/Downloads`.
