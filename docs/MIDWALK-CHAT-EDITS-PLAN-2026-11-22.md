# Changing the route in the middle of a walk, by chat or by buttons: plan

Date: 2026-11-22. Branch `feat/design-r13-port`, read at `b09cd20`.
Method: read-only code trace, plus a scratch run of the keyword parser (`parseIntent`) and the stop-name sanitizer
against the real stop name. No `src/` or test file was changed. Nothing here was checked on a phone.
Line numbers are from `b09cd20`. `WalkPlannerApp.tsx` has about 13 uncommitted lines from another session in the
working tree, so its working-tree numbers can be a few lines off.

Builds on `docs/PACE-AND-MIDWALK-REROUTE-REVIEW-2026-11-22.md` (P1-P21, mostly fixed). Fixed items from that review
are not repeated here.

---

## Summary

**The field bug.** In the middle of a walk Ariel asked the walk chat to rebuild the route. It offered a button to add
Gan HaShoura and a button to go back to the start. It then said it "did not manage to remove Glanis with the button,
so you'll need to skip it manually". The cause is a server guard. When the walker is more than 15 minutes ahead of
time, it throws away any "remove a stop" proposal unless the walker's last message contains one of about 13 exact
keywords. Most normal ways to say "remove" in Hebrew, and several in English, are not on that list ("להוריד",
"תורידו", "תסיר", "בלי", "במקום", "without", "get rid of"). The model got an error, had nothing to fall back on, and
passed the work to the walker. The "manual" skip it pointed to only exists for the next stop, is English-only, and
does not re-route.

**The wider area.** The walk chat can add a place, remove a stop (when the guard allows), and go straight back to the
start. It cannot:
- reorder stops
- change where the walk ends
- finish back at the start while keeping the stops
- make the walk longer or shorter by a number of minutes
- get the walker back onto the route

Its one "back to the start" button throws away every remaining stop, including a place it just offered to add. Only
one button per reply can be tapped, so "add the garden **and** finish at the start" cannot be done at all. Three more
bugs sit right behind the guard:
- the chat can skip the wrong stop if one is reached while the reply is on its way
- removing the last stop left adds random new stops
- the "more time" sum counts legs to stops already visited

**The fix, in one sentence.** One edit shape (add / remove / order / end / minutes) is built by one pure function and
run by one handler as one rebuild. The chat gets a few small tools that fill that shape, the stop list gets a real
Remove button, and every tap ends with one honest line saying what changed. No server route change is needed: "end
at the start" and "end at X" already exist in `/api/walk-plan` as `maxEndDistanceFromOriginMeters` + `endAnchor`
(+ `returnTo`).

### בקצרה, בעברית

- **למה לא הצליח להסיר את גלאניס:** בשרת יש "שומר": כשההולך מקדים את הזמן ביותר מרבע שעה, הוא מוחק כל הצעה להוריד
  עצירה, אלא אם בהודעה האחרונה הופיעה אחת מכ-13 מילים מדויקות. "להוריד", "תורידו", "תסיר", "בלי", "במקום" לא ברשימה.
  המודל קיבל שגיאה ואמר "תדלג ידנית". דילוג ידני קיים רק לעצירה הבאה, רק באנגלית, ולא מחשב מסלול חדש.
- **מה עוד חסר בצ׳אט באמצע הליכה:** לשנות סדר, לשנות איפה מסיימים, "לסיים בהתחלה" בלי לוותר על העצירות, להאריך
  או לקצר בדקות, לחזור למסלול. כפתור "חזרה להתחלה" מוחק את כל העצירות. אפשר ללחוץ רק על כפתור אחד בכל תשובה.
- **התיקון:** צורה אחת לשינוי (להוסיף, להוריד, סדר, סוף, דקות), פונקציה אחת שבונה אותה ובנייה אחת של המסלול לכל
  לחיצה. אחרי כל לחיצה מופיעה שורה אחת וכנה: מה השתנה, או למה לא. לא צריך לשנות את השרת של בניית המסלול.

---

## 1. Root cause: why "remove Glanis" failed

### 1.1 Which chat it was

The reply came from the **free walk chat**: `WalkChatBox` → `useWalkChat` → `POST /api/walk-assistant` →
`runWalkTurn` (owner accounts only, `src/app/api/walk-assistant/route.ts:81-82`). The reply matches that chat's system
prompt exactly:
- "a button" is a `propose_*` tool.
- "only 372 m" is the `dist_m` that `find_places` returns (`src/lib/assistant/walk-turn.ts:204-211`).
- "Does that suit you?" is the prompt's "end by asking whether it fits" (`walk-turn.ts:27`).

### 1.2 The chain

1. The model calls `propose_skip_stop({ stop_number })`. The tool takes a number from the numbered list of remaining
   stops (`walk-turn.ts:65-72`, schema `src/lib/assistant/tool-schemas.ts:126`).
2. The guard at `walk-turn.ts:227-236`:
   ```ts
   const aheadNoAsk =
     typeof input.timing?.spareMin === "number" &&
     input.timing.spareMin > AHEAD_NO_SKIP_MIN &&          // 15, line 18
     parseIntent(lastUser, []).intent !== "skip" &&
     parseIntent(lastUser, []).intent !== "shorter";
   if (aheadNoAsk) output = { error: "the walker is ahead of time and did not ask to cut; offer adding a stop or a longer loop instead" };
   ```
   No action is pushed, so no button is shown.
3. `parseIntent` (`src/lib/walk/chat/intent.ts`) is the on-device keyword parser. Used as a "did they ask?" test it
   misses most real phrasing:
   - `SKIP_WORDS` (`intent.ts:41-43`) are exact tokens.
   - A Hebrew word that is not a verb stem may take only one prefix letter `[בלהומכ]` and no suffix
     (`wordRegex`, `intent.ts:78-87`). Only `דלג/קצר/חזור/וותר` are verb stems (`intent.ts:76`). So "תוריד" matches,
     but "תורידו", "תורידי" and "להוריד" do not.
   - `WEAK_SKIP_WORDS` ("drop", "לא רוצה") count only when they name a stop (`intent.ts:157-161`). The guard passes an
     **empty stop list**, so they can never count there.
   - Only the latest typed message is checked. "Remove Glanis" in one message followed by "yes, rebuild it" is a "no".
4. The walker was ahead. Ariel's walks in this round were planned at 2 km/h and walked at about 4.5. The client's
   `spareMin = available − elapsed − timeToFinish` (`WalkPlannerApp.tsx:3979-3982`) is then far above 15. The earlier
   review measured about +50 min for that case.
5. The model reported the error in its own words. Nothing in `WALK_SYSTEM` (`walk-turn.ts:23-30`) says never to hand
   a change back to the walker. The paceLine even says "never propose cutting a stop unless the walker asks"
   (`walk-turn.ts:111`). The only manual skip is `AttractionDistancesPanel`'s "Skip" (`AttractionDistancesPanel.tsx:127-145`):
   - It shows on the **next stop only**.
   - It is English only.
   - It calls `skipAttraction` (`WalkPlannerApp.tsx:3574-3589`), which marks the stop **visited** and does **not**
     re-route. The line on the map and the time to finish still include it.

   If Glanis was not the next stop, the walker could not skip it at all.

The add went through because `propose_add_stop` has no guard (`walk-turn.ts:221-226`).

### 1.3 Scratch run of the guard's view (`parseIntent(text, [])`, and with the real stops)

| Walker types | With stops | What the guard sees | Ahead > 15 min: button? |
|---|---|---|---|
| תוריד את גלאניס | skip | skip | yes |
| תורידו / תורידי את גלאניס | unknown | unknown | **no** |
| להוריד את גלאניס | unknown | unknown | **no** |
| תסיר / להסיר את גלאניס | unknown | unknown | **no** |
| בלי גלאניס | unknown | unknown | **no** |
| לא רוצה את גלאניס | skip | unknown | **no** |
| תחליף את גלאניס בגן | unknown | unknown | **no** |
| במקום גלאניס תוסיף גן | longer | longer | **no** |
| תבנה מחדש את המסלול בלי גלאניס ותחזיר אותי להתחלה | head-back | head-back | **no** |
| תדלג / לדלג על גלאניס, לבטל, לוותר | skip | skip | yes |
| תבטל את גלאניס | unknown | unknown | **no** |
| remove Glanis | skip | skip | yes |
| drop Glanis | skip | unknown | **no** |
| get rid of Glanis / no Glanis please / replace Glanis with a park / rebuild the route without Glanis | unknown | unknown | **no** |

### 1.4 Causes ruled out

- **Name matching (long mixed name).** The tool works by number, not name. The sanitizer keeps
  `"גלאניס מאפים - Glanis"` unchanged (checked with `cleanUntrustedText`, `src/lib/llm/sanitize.ts:28-35`).
- **Stop already visited or "next".** The list sent is every unvisited stop, the next one included
  (`WalkPlannerApp.tsx:2204-2210`, `3963`). A visited Glanis would not be in the list. The model would then get
  "no such stop", and could not have meant "with the button".
- **Tool budget.** 8 calls per turn (`walk-turn.ts:16`). A turn like this one uses about 4-6.

The guard is the only path that fits the reply. There are no server logs to prove it; task T1 adds a log line that
records tool errors without any text.

### 1.5 Bugs right behind the guard (they appear as soon as T1 lands)

- **B-a: the chat can skip the wrong stop.** The server's `stopIndex` is an index into the stops sent with the
  message. The client maps it onto a **fresh** context taken when the reply arrives:
  `fresh.stops[a.stopIndex]` (`src/lib/hooks/useWalkChat.ts:263, 268-270`). If a stop is reached during the 5-30 s turn,
  every index moves by one, and the button says "Skip" for the wrong stop.
- **B-b: removing the last stop left adds random stops.** `midWalkRebuildState` passes `orderedAttractions`, visited
  stops included (`WalkPlannerApp.tsx:1930`). The "never drop the last stop" check in `buildDropStopsRebuildRequest`
  counts those visited stops (`src/lib/walk/planner-actions.ts:188`), so it passes. `handleBuildWalk` then strips the
  visited ones (`WalkPlannerApp.tsx:1650-1652`), sends an empty list, and `/api/walk-plan` runs fresh discovery
  (`src/app/api/walk-plan/route.ts:518` else-branch). Removing the last unvisited stop gives the walker new stops they
  never asked for.
- **B-c: "more time" and "add a place" price legs to stops already visited.** `minutesToFinishRemainingStops` walks
  `state.currentAttractions` in order from the current position (`planner-actions.ts:499-526`). Visited stops are in
  that list (same cause as B-b), so the time added is too large.
- **B-d: no outcome line for a removal.** `runDropStopsRebuild` (`WalkPlannerApp.tsx:2305-2311`) builds and says
  nothing. `runApplyChangesRebuild` reports only the adds (`2137-2141`).
- **B-e: only one tap per reply.** `runAction` uses up the whole message (`useWalkChat.ts:96-103`). "Add" and
  "Head back" in one reply cannot both be done. "Apply all" covers adds and drops only (`useWalkChat.ts:276-285`).
- **B-f: "Head back" deletes the plan.** The free chat's head-back button ("חזרה להתחלה", `useWalkChat.ts:271-272`)
  runs `runThemedOption("short")` (`WalkPlannerApp.tsx:4010`), a stop-less route home. In the field reply it sat
  next to "add Gan HaShoura". Tapping it would have thrown the garden away with every other stop.

---

## 2. Every mid-walk edit, by surface

Surfaces:
- **Free chat**: `/api/walk-assistant`, owner accounts.
- **Keyword chat**: everyone else, and the owner's fallback. `parseIntent` on the device, then `/api/walk-chat` for a
  signed-in walker.
- **Buttons**: the sheet, the stop list, the companion cards and the map.
- **Sol**: the planner chat under Details, which can change a live walk.

The "end to end" column is about what happens once a rebuild runs. Every path that goes through
`handleBuildWalk(…, { autoResume: true })` shares the same machinery, and it works:
- make-before-break swap (`WalkPlannerApp.tsx:1597-1617`)
- time and distance banked across legs (P7)
- grey walked trail kept (`1637`)
- map redrawn (`showPlan`)
- loop closes at the real start (`returnTo`, `1750`)
- visited and dropped stops kept out of discovery (`1760`)
- one "Back to previous route" for the whole chain (`previousPlan`)
- an 8-second Undo on the notice, only for the first change in a chain (`undoable = previousPlan === null`)

| # | Operation | Free chat | Keyword chat | Buttons | Sol | Notes |
|---|---|---|---|---|---|---|
| 1 | Add a place | **Works** (`propose_add_stop` → `runAddPlaceRebuild`, pinned, clock grows, "Added" line + undo) | **Works** ("add a stop" → best place, else fill) | **Works** (companion "Add X", "Extend the hike"). Map popup "Add to walk" is **off while walking** (`onAddToWalk={walkPhase === "walking" ? undefined : …}`, `5239`) | Works (stops in `build_walk`) | |
| 2 | Remove / skip a named stop | **Broken** when ahead > 15 min (§1). When it runs: B-a, B-d | **Partial**: only ~13 exact words (§1.3); others go to `/api/walk-chat` when signed in, else a help line | **Partial**: next stop only, English, marks visited, **no re-route** | Works (left out of `build_walk`) | |
| 3 | Remove the last remaining stop | Broken (B-b adds new stops) | Works (offers Head back, `reply.ts:145`) | Works (marks visited) | Not handled specially | |
| 4 | Replace X with Y | **Broken when ahead** (needs skip + add); no "swap" label | Missing ("instead of" reads as "longer") | Missing | Works | |
| 5 | Reorder | **Missing** (no tool) | Missing | Missing (planning-mode list only) | **Partial**: order kept for that build; the next automatic rebuild re-optimizes it | |
| 6 | Change where the walk ends | **Missing** | Missing | Missing | **Partial**: `end_at` ordering for that build only; `endAnchor` not changed, so the next rebuild forgets it | |
| 7 | Finish back at the start, keeping the stops | **Missing**; the only tool is Head back (B-f) | Missing ("back to the start" = Head back) | Missing | **Works** (`endExplicit` 0 + `returnTo`, P18 fix) | Sol's `getCurrentWalk.start` is the leg's origin, not the real start (`4517`) |
| 8 | Go straight back to the start now | **Works**, label unclear (B-f) | Works ("חזרה להתחלה") | Works (direction options, companion "Finish early") | n/a | |
| 9 | Lengthen (more minutes, more stops) | **Partial**: only by adding one found place; the prompt tells the model to offer "a longer loop" (`walk-turn.ts:111`) with no tool to do it | Works ("longer") | Works (pace card / companion "Lengthen", P1/P2) | Works (`add_minutes`) | |
| 10 | Shorten | **Partial**: only via skip (blocked when ahead, which is when it is asked least) | Works ("shorter" → pick which stop) | Works (pace card, companion) | Works | |
| 11 | Back onto my route | **Missing** (owners never reach the keyword chat's rejoin) | Works (P17) | Works (off-route card) | n/a | |
| 12 | Set pace | Missing (prose only) | **Partial**: re-base only (review: "P2, chat path, not fixed") | Works (mismatch card) | Works | |
| 13 | Several changes at once | **Partial**: Apply-all for adds + drops only; end, order and head-back can't be combined (B-e) | n/a | n/a | Works (one build) | |
| 14 | Undo the last change | Missing in chat | Missing in chat | **Partial**: notice Undo only on the first change of a chain; the sheet's "Back to previous route" reverts the **whole** chain | Undo button in Sol (`assistant-chat-undo`) | |
| 15 | Bring back a removed stop | Partial (re-find and add) | Missing | Works for stops the **planner** cut (`DroppedStopsPanel`); a stop the walker removed is not listed there (by design) | Works | |
| 16 | Route rules mid-walk (stroller, avoid a street) | **Missing**: the field reply chose a "stroller-friendly" garden, but routing is not stroller-aware | Missing | Missing | Works (`routeRules`) | |

---

## 3. Design

### 3.1 Rules for every edit

1. **One shape.** Every mid-walk change, from any surface, is a `RouteEdit`:
   ```ts
   // src/lib/walk/planner-actions.ts
   export type RouteEnd =
     | { kind: "start" }                         // finish back at the real start, keep the stops
     | { kind: "stop"; stopId: string }          // finish at one of the stops
     | { kind: "place"; place: Attraction }      // finish at a new place (it is also added)
     | { kind: "free" };                         // no end point
   export interface RouteEdit {
     adds?: Attraction[];        // pinned for the rest of the walk
     dropIds?: string[];         // removed; kept out of discovery
     orderIds?: string[];        // these first, in this order; the rest keep their order after them
     end?: RouteEnd;
     minutesDelta?: number;      // signed: +N longer (discovery may add stops), −N shorter
   }
   ```
2. **One builder, one handler, one rebuild per tap.** `buildRouteEditRequest` is pure and tested on its own.
   `runRouteEdit` in `WalkPlannerApp` runs it. The existing `runDropStopsRebuild`, `runAddPlaceRebuild` and
   `runApplyChangesRebuild` become thin wrappers over it, so they gain the outcome line and the fixes for free.
3. **The model proposes and the app executes.** Every change is still a tap.
4. **No hard block on something the walker asked for.** Every tool error says how to fix the call.
5. **One outcome line after every tap**, in EN and HE. It says what changed, and names anything that was asked for and
   did not happen.

### 3.2 How the end point works (no server change)

`/api/walk-plan` already supports both kinds of end:
- `maxEndDistanceFromOriginMeters === 0` means "close the loop at `returnTo`" (`route.ts:418, 631-632, 744`;
  `tsp-planner.ts:472-473`).
- A positive limit means "the last stop is within N m of `endAnchor`". `enforceEndDistance` reorders the stops to meet
  it (`tsp-planner.ts:328-373`).

Every mid-walk rebuild already carries both fields, because `buildMidWalkRebuildRequest` spreads `...orig` and keeps
`endAnchor` (`planner-actions.ts:590-596`). The client sends `returnTo: input.endAnchor` (`WalkPlannerApp.tsx:1750`).
`commitSwap` stores the new input (`1607`), and the active-walk store saves the input across a reload
(`active-walk-store.ts:12`). So an end set once **persists** through every later rebuild and reload:

| `end` | Input change |
|---|---|
| `start` | `maxEndDistanceFromOriginMeters = 0`, `endAnchor = walkStartPointRef.current` (the real start) |
| `stop` X | `endAnchor = X.coordinates`, `maxEndDistanceFromOriginMeters = END_AT_STOP_M` (100), X pinned |
| `place` P | P added and pinned, then as `stop` |
| `free` | `maxEndDistanceFromOriginMeters = undefined`, `endAnchor = real start` |

**Order** persists the same way. Add `keepStopOrder?: boolean` to `WalkCompanionInput`
(`src/lib/types/walk-companion.ts`). `handleBuildWalk` sends
`fixedOrder: options.fixedOrder ?? input.keepStopOrder`. `fixedOrder` skips `enforceEndDistance`
(`tsp-planner.ts:553`), so when both an order and an end stop are set, the builder itself moves the end stop last.

### 3.3 `buildRouteEditRequest` (new, `planner-actions.ts`)

```ts
export const END_AT_STOP_M = 100;
export const MAX_EDIT_MINUTES = { min: -120, max: 240 } as const;
export type RouteEditRequest<TInput> =
  | { ok: true; input: TInput; options: BuildWalkOptions }
  | { ok: false; reason: "last-stop" };
export function buildRouteEditRequest<TInput extends RebuildInput & { maxEndDistanceFromOriginMeters?: number; keepStopOrder?: boolean }>(
  state: PaceRebuildState<TInput>,   // currentAttractions already without visited stops (T3)
  edit: RouteEdit,
  realStart: Coordinates,
  heading?: number,
): RouteEditRequest<TInput>
```

Steps:
1. `kept` = current stops minus `dropIds`. `list` = `kept` + `adds` (no duplicate ids). `pins` = pins minus drops,
   plus add ids.
2. If `list` is empty and `end` is not `place`, return `{ ok: false, reason: "last-stop" }`. This fixes B-b for every
   path.
3. Apply `end` as in §3.2. Pin the end stop.
4. If `orderIds` is set, or `orig.keepStopOrder` is already true: list = the ordered ids, then the rest in their current
   order, with the end stop (if any) moved last. Then `keepStopOrder = true` and `fixedOrder = true`.
5. Minutes:
   - Only adds (no `minutesDelta`): `extendToFitRemainingStops: true`, `priceAtPlannedPace: true`. This is today's
     add-place behavior.
   - `minutesDelta > 0`: `availableMinutes = base + delta`, `fillRemainingTime: true`, `heading` passed (P4).
   - `minutesDelta < 0`: `availableMinutes = max(MIN_REBUILD_MINUTES, base + delta)`, no fill. The planner drops
     unpinned stops that no longer fit.
   - Otherwise: re-time only (today's drop behavior).

   `minutesDelta` is clamped to `MAX_EDIT_MINUTES`.

### 3.4 Server: the free walk chat (`walk-turn.ts`, `tool-schemas.ts`, `walk-assistant/route.ts`)

**Delete the hard guard** (`walk-turn.ts:229-236`, and `AHEAD_NO_SKIP_MIN`). Keep the soft rule in `paceLine`. Every
skip is a button the walker has to tap, so the guard protected nothing and blocked what the walker had asked for.

**Tool schemas** (`WALK_TOOL_ARGS`, all `.strict()`):
```ts
propose_skip_stop: z.object({ stop_number: z.number().int().min(1).max(50) }),                       // unchanged
propose_end:       z.object({ where: z.enum(["start", "stop", "place", "anywhere"]),
                              stop_number: z.number().int().min(1).max(50).optional(),
                              place_id: z.string().min(1).max(20).optional() }),
propose_order:     z.object({ stop_numbers: z.array(z.number().int().min(1).max(50)).min(1).max(12) }),
propose_time:      z.object({ minutes: z.number().int().min(-120).max(240) }),                         // 0 rejected in code
propose_rejoin:    z.object({}),
propose_planner:   z.object({}),
propose_head_back: z.object({}),                                                                       // unchanged, new description
```

**Tool descriptions** (the text the model sees):
- `propose_skip_stop`: "Show a tap button that removes one remaining stop from the walk (skip, remove, drop, 'without
  X', 'instead of X'), by its number in the list. The route is rebuilt without it. Call it whenever the walker asks to
  remove a stop."
- `propose_end`: "Show a tap button that changes where the walk finishes and keeps the stops. where='start' finishes
  back at the start after the stops. 'stop' with stop_number finishes at that stop. 'place' with place_id finishes at a
  place from find_places, which is added. 'anywhere' removes the end point."
- `propose_order`: "Show a tap button that visits these stops first, in this order (numbers from the list). The
  others follow in their current order."
- `propose_time`: "Show a tap button that makes the rest of the walk about `minutes` longer (positive: adds stops
  ahead) or shorter (negative: the app drops what no longer fits, never a stop the walker chose)."
- `propose_rejoin`: "Show a tap button that guides the walker back onto the planned route (not to the start)."
- `propose_planner`: "Show a tap button that sends the walker's request to the full planner. Use it for what these
  buttons cannot do: stroller or wheelchair routing, avoiding a street, a completely new walk."
- `propose_head_back`: "Show a tap button that goes straight back to the start NOW and drops every remaining stop. To
  keep the stops and finish at the start, use propose_end with where='start'."

**`WalkAction` additions:**
```ts
| { kind: "end"; where: "start" | "anywhere" }
| { kind: "end"; where: "stop"; stopIndex: number }
| { kind: "end"; where: "place"; name: string; coordinates: Coordinates }
| { kind: "order"; stopIndexes: number[] }
| { kind: "time"; minutes: number }
| { kind: "rejoin" }
| { kind: "planner" }
```

**Errors that say how to fix the call** (tool output):

| Case | Tool output |
|---|---|
| Stop number out of range | `no such stop: use a number from 1 to ${n} from the list` |
| `place_id` not found | `unknown place_id: call find_places first and use an id it returned` |
| Order with repeats or out of range | `stop_numbers must be different numbers from 1 to ${n}` |
| `minutes` is 0 | `minutes must not be 0: positive is longer, negative is shorter` |
| `where=stop` with no `stop_number` | `where=stop needs stop_number` |
| `where=place` with no `place_id` | `where=place needs place_id` |

A second `propose_end` in the same turn replaces the first.

**`WALK_SYSTEM` edits**:
- Replace line 25 with: "You can offer tap buttons for every change to the route: propose_add_stop (a place you
  found), propose_skip_stop (remove one remaining stop, by number), propose_end (where the walk finishes),
  propose_order (visit order), propose_time (longer or shorter), propose_rejoin (back onto the route),
  propose_head_back (straight to the start, dropping the stops) and propose_planner (anything else). The walker must
  tap. Never say a change is already done; say what the button will do."
- Line 26 becomes: "If they ask for several changes (add, remove, swap, reorder, change the end), call a propose_ tool
  for EVERY one of them in the same turn; the app combines them into one button. To swap X for Y, call
  propose_skip_stop for X and propose_add_stop for Y."
- New line: "Never tell the walker to make a change themselves, and never say the app cannot do it, when one of these
  buttons can. If a propose_ tool returns an error, fix the call as the error says and try once more. If it still
  fails, say in one short sentence what you could not set up and offer propose_planner."

**Context**:
- The client sends `end: { kind: "start" | "place" | "free"; name?: string; withinKm?: number }`.
- `route.ts` checks it: `kind` from the enum, `name` cut to 80 characters and fenced like the stops.
- `runWalkTurn` adds one line to the fenced background, for example "The walk ends: back at the start." or "The walk
  ends at stop 3." or "The walk can end anywhere within 2 km of the start."

**Limits**: `MAX_TOOL_CALLS` 8 → 12. `find_places` stays capped by the Places gate (`perTurnCap: 4`,
`walk-assistant/route.ts:90`), so this adds no paid calls.

**Log**: one `console.info("[walk-assistant] tool", name, ok ? "ok" : code)` per call. It has a short code and no text,
names or positions. That is enough to see the next field failure.

### 3.5 Client: `useWalkChat.ts`

- **B-a fix.** Map `stopIndex` against the stops sent with the message (`ctx.stops[a.stopIndex]`), then check that the
  id is still in `fresh.stops`. If it is gone, show no button and add one line: EN "{name} is already behind you." /
  HE "{name} כבר מאחוריך." (singular, the way the walk chat speaks in its own lines).
- **Last stop.** A drop of the only stop left becomes a Head back button with the existing
  `headBackText` (`reply.ts:73/101`), the same rule the keyword chat follows.
- **One combined button.** `apply-changes` grows to the full edit:
  ```ts
  | { kind: "apply-changes"; adds; dropStopIds; orderStopIds?: string[]; end?: ChatEnd; minutesDelta?: number; label: string }
  ```
  The name stays the same, so the typed-"yes" logic (`useWalkChat.ts:136`) keeps working.
  - With 2 or more edits, or any end/order/time edit, the combined button comes first.
  - Single add and drop buttons stay, as today.
  - Head back, rejoin and planner are never merged in. They are their own buttons.
- **Labels** (built from parts; past 60 characters it falls back to "Apply all {n} changes" / "לבצע את כל {n}
  השינויים"):

| Part | EN | HE |
|---|---|---|
| combined | `Apply: +Gan HaShoura · −Glanis · end at the start` | `לבצע: +גן השורה · −גלאניס · סיום בהתחלה` |
| end start | Finish back at the start | לסיים בנקודת ההתחלה |
| end stop/place | Finish at {name} | לסיים ב{name} (use `ב-` when the name does not start with a Hebrew letter) |
| end free | Finish anywhere | לסיים בכל מקום |
| order | Use this order: {a} → {b} | לעבור לסדר: {a} ← {b} |
| time + | Make it ~{n} min longer | להאריך בכ-{n} דק׳ |
| time − | Make it ~{n} min shorter | לקצר בכ-{n} דק׳ |
| head back (relabel) | Straight back to the start | ישר חזרה להתחלה |
| rejoin, planner | existing `reply.ts` strings | existing |

### 3.6 Client: `WalkPlannerApp.tsx`

- **`midWalkRebuildState`** (`1912-1936`): `currentAttractions: excludeVisited(orderedAttractions, visitedIds)`. This
  fixes B-b and B-c for every builder. `handleBuildWalk` already drops visited stops, so nothing else changes.
- **`runRouteEdit(edit)`**:
  1. If `midWalkRebuildInFlightRef.current`, show `stillUpdating` and return **before** touching pins or refs (the
     `addPlaceToLiveWalk` pattern, `2043-2046`).
  2. Get `state`; if there is none, show `gone`.
  3. Build the request with `buildRouteEditRequest(state, edit, walkStartPointRef.current ?? orig.endAnchor ?? orig.origin, heading)`.
  4. `!ok`: show the last-stop notice and do not build.
  5. Add the drop ids to `droppedStopIdsRef`, and take a "before" record: stop ids ahead, names, end, `totalMinutes`.
  6. `handleBuildWalk(input, options).then(plan => { keepPinned(addIds + endStopId, plan); announceRouteEdit(before, plan, edit, undoable) })`.
- **`announceRouteEdit`** compares before with after and shows **one** line. Anything asked for that did not happen
  is named:
  - EN `Route updated: +Gan HaShoura, −Glanis, ends at the start · about 42 min left`
  - HE `המסלול עודכן: נוסף גן השורה, הוסר גלאניס, מסתיים בנקודת ההתחלה · נשארו כ-42 דק׳`
  - Removal only: EN `Removed: Glanis · about 38 min left` / HE `הוסר: גלאניס · נשארו כ-38 דק׳`
  - An add that did not fit: EN `Couldn't fit Gan HaShoura in the time left.` / HE `גן השורה לא נכנס בזמן שנשאר.`
    (Tone `warn`. Everything else that changed is still listed.)
  - Shorter that changed nothing: the existing `noShorterRoute`. Longer that added nothing: `nothingFit`.
  - Last stop: EN `Glanis is your last stop. Head straight back instead?` / HE `גלאניס היא העצירה האחרונה. לחזור ישר
    להתחלה במקום?`, with a Head back action on the notice.
  - Failed or timed out: the existing `replanFailed` / `cancelled` (`reportReplanFailed` already runs; announce stays
    quiet on `null`).
- **Wrappers**: `runDropStopsRebuild(ids, capMin)` keeps `capMin` (the companion's sunset cap) and passes it through.
  `runAddPlaceRebuild` and `runApplyChangesRebuild` call `runRouteEdit`. `onAction` (`3988-4012`) gains:
  - `apply-changes` with end/order/time → `runRouteEdit`
  - `rejoin` (exists)
  - `planner` → the existing `ask-planner` branch with the walker's last typed text
- **Stop list** (`AttractionDistancesPanel`, rendered at `4776-4783`):
  - Add `lang`.
  - Rename the next-stop "Skip" to **Done** / **ביקרתי**. Same `skipAttraction` behavior: marks visited, no rebuild.
  - Add **Remove** / **להסיר** on every unvisited stop except the last one. It calls `runRouteEdit({ dropIds: [id] })`.
  - Pinned stops keep the existing confirm, in HE as well (`להסיר בכל זאת?`).
- **Map popup**: `onAddToWalk={walkPhase === "walking" ? (p) => void addPlaceToLiveWalk(p) : addMapPlaceToWalk}`
  (`5239`).
- **Chat context**: `getContext` (`3955-3986`) adds `end`, read from `walkInputRef.current`:
  - `maxEnd === 0` → `start`
  - `endAnchor` within 100 m of a stop and `maxEnd ≤ END_AT_STOP_M` → `place` + that stop's name
  - otherwise → `free` + `withinKm`

### 3.7 Keyword chat (`intent.ts`, for non-owners and the fallback)

- `SKIP_WORDS` gains:
  - "תורידו", "תורידי", "להוריד", "הורידו", "תסיר", "תסירו", "להסיר", "הסירו", "תעיף", "תעיפו", "להעיף", "תבטל",
    "תבטלו"
  - "get rid of", "take off", "no more"
- `WEAK_SKIP_WORDS` gains "בלי", "במקום", "without" and "instead of". These need a stop name to match, so "בלי עליות"
  stays a non-skip.
- New intent **`end-start`**: an end word ("בסוף", "לסיים ב", "שיסתיים", "finish at", "end at", "loop", "סיבוב") plus
  a start word, and no "now"/"עכשיו"/"ישר"/"straight". The reply is "I can keep your stops and finish back at the
  start." / "אפשר להשאיר את העצירות ולסיים בנקודת ההתחלה." with one end-start button.
- `skip` with an unmatched name keeps `whichStop`.

### 3.8 Sol mid-walk (small, same mechanism)

- `getCurrentWalk.start` → `walkStartPointRef.current ?? input.origin` (`4517`). After the first rebuild,
  `input.origin` is where the walker stood.
- `onBuild` mid-walk (`4467-4489`): when `build.fixedOrder`, also set `keepStopOrder: true` on the input. Sol's order,
  and its `end_at` stop placed last, then survive the next automatic rebuild.

### 3.9 Per-change Undo (last, optional)

Today the notice's Undo appears only on the first change of a chain. It and the sheet button both return to the
**first** snapshot. To undo just the last change:
- Keep `lastEditSnapshotRef`, set in `commitSwap` for every build.
- Have the notice's Undo call `revertToSnapshot(lastEditSnapshotRef.current)`. If that was not the first snapshot,
  restore `previousPlan` to the first one afterwards.
- Show the Undo on every chat or button edit.

---

## 4. Ordered tasks

Each task is one commit with its own tests. Run the full suite and `tsc` after each one. `WalkPlannerApp.tsx` is shared
with other sessions, so keep its diffs small and rebase often.

**T1. Server: let the walker remove a stop (fixes the field bug).**
- Delete the guard and `AHEAD_NO_SKIP_MIN`.
- Make the errors say how to fix the call (§3.4).
- Add the "never tell the walker to do it themselves" prompt line and the tool log line.

Tests in `tests/walk-turn-pace.test.ts`:
- Flip "ahead by 25 and no skip intent" to: the skip is **kept**.
- Add: ahead by 25 with the exact phrase "תבנה מחדש את המסלול בלי גלאניס ותחזיר אותי להתחלה" gives
  `skip-stop` index 0.
- Add: `stop_number: 9` with 2 stops returns `use a number from 1 to 2`.
- Add: the system prompt contains "Never tell the walker to make a change themselves".

**T2. Client: the chat skips the stop it named (B-a), and a lone last stop becomes Head back.**

Tests in `tests/use-walk-chat.test.tsx`, with a `getContext` that returns [A, B] at send and [B] at reply, and the
server proposing `skip-stop` index 1:
- No button for A, no button for the wrong stop, and a "B" button only when index 1 was B at send.
- A skip of the only stop left gives a Head back button.

**T3. Visited stops out of every rebuild sum (B-b, B-c).**
- `midWalkRebuildState` passes unvisited stops.
- `buildDropStopsRebuildRequest` returns a refusal when nothing unvisited is left. Callers say so (the last-stop
  notice).

Tests:
- `tests/planner-actions.test.ts`: (a) with stops [B], dropping B is refused; (b) `buildExtendedTimeRebuildRequest`
  with unvisited [B] prices only the leg to B.
- Component test in `tests/walk-planner-midwalk-changes.test.tsx`: visit A, chat-drop B. Assert no `/api/walk-plan`
  request goes out with an empty `explicitAttractions`, and the last-stop notice is on screen (EN and HE).

**T4. `RouteEdit` + `buildRouteEditRequest` (pure).**

Table tests in `tests/planner-actions.test.ts`:
- end `start` → `maxEnd 0`, `endAnchor` = real start, even after an earlier end at X.
- end `stop` → `endAnchor` = stop coordinates, `maxEnd 100`, pinned.
- end `place` → added, pinned, anchored.
- `orderIds` → stop order as given, `fixedOrder` and `keepStopOrder` true.
- order + end stop → end stop last.
- `minutesDelta +20` → `available = base + 20`, fill, heading.
- `minutesDelta −20` → no fill, floor 15.
- `minutesDelta` clamped to −120 / 240.
- drop everything → refused.
- adds only → same request as today's `buildAddPlaceRebuildRequest` (regression).

**T5. `runRouteEdit` + `announceRouteEdit` + wrappers + `keepStopOrder` in `handleBuildWalk`.**

Component tests in a new `tests/walk-planner-chat-edits.test.tsx`, using the `walk-planner-sol-midwalk` harness
(fake `/api/walk-assistant` answers):
1. Remove via chat shows "Removed: X · about N min left", and the next `/api/walk-plan` body lacks X.
2. add + skip + end start in one reply → one rebuild whose body has the add, lacks the drop, and has
   `maxEndDistanceFromOriginMeters: 0` and `returnTo` = the real start. The line lists all three.
3. After that, an automatic pace rebuild still sends `maxEnd 0` and the same `returnTo` (persistence).
4. A reorder, then a pace rebuild, still sends `fixedOrder: true`.
5. A tap while a rebuild runs shows `stillUpdating` and leaves pins unchanged.
6. An add that comes back missing shows the "Couldn't fit" line.
7. The Hebrew app shows the Hebrew line and no English.
8. Reload mid-walk after "end at X": the resumed input keeps `endAnchor` X and `keepStopOrder`. Extend
   `tests/active-walk-store.test.ts` so the new field survives.

**T6. Server: new tools (`propose_end`, `propose_order`, `propose_time`, `propose_rejoin`, `propose_planner`), new
head-back description, and the `end` context line.**

Tests in a new `tests/walk-turn-edits.test.ts`:
- Each tool's valid call → its action.
- Each invalid call → the exact error text from §3.4.
- Two `propose_end` calls → the last one wins.
- The background contains "The walk ends: back at the start." when `end.kind` is `start`.

Tests in `tests/walk-assistant.test.ts`: `end` is checked (a bad `kind` is dropped, `name` is fenced and cut to 80).

**T7. Client: map the new actions; combined button and labels.**

Tests in `tests/use-walk-chat.test.tsx`:
- A reply with add + skip + end start → first button label `Apply: +Gan HaShoura · −Glanis · end at the start`
  (HE: `לבצע: +גן השורה · −גלאניס · סיום בהתחלה`).
- Tapping it calls `onAction` with the whole edit.
- Head back is a separate button, never merged.
- A label over 60 characters falls back to "Apply all {n} changes".

Tests in `tests/walk-chat-affirm.test.tsx`: a typed "כן" runs the combined edit.

**T8. Buttons: stop-list Remove on every unvisited stop, Done rename, Hebrew labels; map popup Add while walking.**

Tests:
- `tests/attraction-distances-panel.test.tsx`: Remove shows on stops 2..n and not on the last one; Done shows on the
  next stop only; Hebrew labels; the pinned confirm works in HE.
- Component test: Remove on the second stop → its rebuild body lacks that stop, and the "Removed" line shows.
- Component test: map Add while walking → `addPlaceToLiveWalk` rebuild with the place pinned.

**T9. Keyword chat vocabulary and `end-start` intent.**

Tests in `tests/walk-chat-intent.test.ts`:
- Every "no" row of §1.3 now gives `skip` with stop id `a`.
- "בלי עליות" and "without hills" are not `skip`.
- "לסיים בנקודת ההתחלה" and "finish back at the start" → `end-start`.
- "חזרה להתחלה עכשיו" and "go back to the start now" stay `head-back`.
- "תחזיר אותי למסלול" stays `rejoin`.

Tests in `tests/walk-chat-reply.test.ts`: the `end-start` reply and button, EN and HE.

**T10. Sol: real start in `getCurrentWalk`; `fixedOrder` persists mid-walk.**

Tests in `tests/walk-planner-sol-midwalk.test.tsx`:
- After one rebuild, `getCurrentWalk().start` equals the first origin.
- A Sol build with `fixedOrder`, then a pace rebuild, still sends `fixedOrder: true`.

**T11 (optional). Per-change Undo (§3.9).**

Component test: two chat edits, then Undo on the second notice → the route after the first edit is back, and
"Back to previous route" still goes to the original.

**T12. Phone check (Ariel).**
1. A 2 km/h-planned walk walked faster. Say "תורידו את {stop 2}" → a button → tap → the line says "הוסר", and the map
   no longer goes there.
2. "תוסיף גן לעגלה ותסיים בהתחלה" → one combined button. The route ends at the real start, and the time left is
   shown.
3. Remove the last stop → the "last stop, head back?" line, with no new stops.
4. "קודם X ואז Y" → the order holds after the next automatic update.
5. Reload the page mid-walk, then lengthen by 20 min → still ends where it was set.
6. Hebrew labels on a small screen: no English, and mixed names read correctly.

---

## 5. Risks

- **The model offering cuts again.** With the guard gone it may suggest cutting a stop to a walker who is ahead. It is
  still a tap with the real stop name on it, and the paceLine rule stays. The T1 log shows how often it happens. A
  hijacked place name can at most add a "Skip X" button; it cannot run it.
- **`endAnchor` now means "where the walk ends".** Head back and the direction options aim at it
  (`WalkPlannerApp.tsx:685`). After "end at X", "Head back" goes to X. Its label must then say "to {X}", not "to the
  start". There is a T5 component test for this.
- **`fixedOrder` and extra stops.** `fixedOrder` skips `enforceEndDistance`, and extra stops are appended last. With an
  end stop plus a lengthen, an extra stop could land after the end stop. When the end is a stop and there is no
  walker order, do not set `fixedOrder`; let `enforceEndDistance` keep X last. T4 covers this.
- **Lengthen can relax the end limit.** A lengthen with no heading is allowed to retry. Those retries can relax the end
  limit (`route.ts:651, 680-700`), which would silently cancel "end at X". Always pass the heading on lengthen. If there is
  none, send `stopCount`. Otherwise accept the English warning, which is a known gap.
- **Loop order.** `bestLoopOrder` orders the stops for a loop that closes at the walker's position, not at `returnTo`
  (`tsp-planner.ts:467`). It may not be the best order mid-walk. This was already true; the field check covers it.
- **Persistence.** Pins and the dropped set are not in the active-walk store, so a reload forgets them (existing).
  `keepStopOrder` lives on the input, so it is saved.
- **Concurrency.** One rebuild at a time stays the rule (P5). A combined edit must check the in-flight flag before it
  touches any ref, or a refused tap leaves pins or dropped ids behind.
- **Wider effect of excluding visited stops.** Excluding visited stops in `midWalkRebuildState` changes what every pace,
  heading and recall builder sees. Expect some planner-actions and heading-continued tests to need new numbers. The
  behavior should only get more correct.
- **Cost.** About 400 more prompt tokens per walk-chat turn and up to 12 tool calls; it stays under the $0.08 turn
  ceiling. Places calls are unchanged.
- **Shared file.** `WalkPlannerApp.tsx` is being edited by other sessions. Keep T3/T5/T8 diffs small, with no
  reformatting.
- **Still needs a phone:**
  - how long the combined rebuilds take on real ORS
  - whether the loop really closes at the real start
  - how mixed Hebrew/English labels look on a small screen
- **Not in this plan:**
  - P14 (one decision for the same pace situation)
  - the chat's "Plan at X km/h" re-base (review "Not fixed")
  - a superseded queued Sol build saying "map not updated"
  - stroller and avoid-street rules from the walk chat itself (T6 hands them to Sol through `propose_planner`)
