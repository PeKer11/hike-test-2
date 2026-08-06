# TODO

## MVP
- [x] Project scaffolding (Next.js + TypeScript + Tailwind)
- [x] Install map dependencies (Leaflet, react-leaflet)
- [x] TypeScript types (waypoints, constraints, routes, ORS API)
- [x] Utility functions (geo, time, polyline)
- [x] ORS API client (directions, optimization)
- [x] Nominatim geocoding client
- [x] API route handlers (proxy for directions, optimization, geocode)
- [x] Constraint builder (UI model → VROOM request)
- [x] Route planner orchestrator (simple vs. optimized routing)
- [x] React hooks (waypoints, constraints, route calculation, map interaction)
- [x] Interactive map with click-to-add waypoints
- [x] Place search with Nominatim autocomplete
- [x] Waypoint list with reorder, required toggle, delete
- [x] Constraint panel (max distance, time windows, start/end, must-visit)
- [x] Route calculation and map display
- [x] Route results panel (distance, duration, stops, warnings)

## QA & Hardening (completed 2026-03-18)
- [x] Code review (3 parallel review agents)
- [x] Fix: leaflet-defaulticon-compatibility module import
- [x] Fix: segment geometry splitting (was sharing full route)
- [x] Fix: silent skip of failed direction segments (now warns)
- [x] Fix: timeToSeconds null safety for invalid input
- [x] Fix: Nominatim coordinate NaN validation
- [x] Fix: empty jobs/vehicles rejection in optimization handler
- [x] Unit tests (geo, time, polyline, constraint-builder — 36 tests)
- [x] Test script added (vitest)

## AI Walking Companion (New Direction)

### Phase 1 — Graph Layer
- [ ] Build `src/lib/graph/osm-loader.ts` — download + cache OSMnx street graph by location + radius
- [ ] Add bounding box filter (2-5 km around user, expandable)
- [ ] Add city-level cache to avoid repeated downloads
- [ ] **Public transit legs (metro/bus) as a route option** — flagged 2026-07-29. Different case from the walking-only Graph Layer decision above (JS/ORS benchmarked faster for pure walking distance, see [[project_hiking_ai_roadmap]] memory) — this is multi-modal routing (walk → transit → walk), which ORS's free tier doesn't cover. OSMnx 2.1.0 (shipped Feb 2026, per `hiking-pulse` 2026-07-28) supports transit-network modeling and could be the right tool specifically for this sub-problem, even though it lost the walking-routing comparison. Not scoped yet — needs its own investigation before building (GTFS data availability for target cities, whether OSMnx or a dedicated transit API like Google Directions Transit mode is the better fit).

### Phase 2 — Attraction Discovery
- [x] Build `src/lib/attractions/overpass-client.ts` — query POIs by location + category
- [x] Build `src/lib/attractions/attraction-ranker.ts` — rank by relevance, popularity, avg visit time
- [x] Define Attraction schema: `{ id, name, coordinates, category, avgVisitMinutes, rating? }`
- [x] Support explicit mode (user names places) + open mode (system suggests) — free-text prompt → Gemini Flash-Lite NER (`src/lib/api/gemini-client.ts`) → Nominatim geocode → `explicitAttractions`, via `/api/extract-places` and `PlacePromptPanel`

### Phase 3 — TSP Route Planner
- [x] Build `src/lib/optimization/tsp-planner.ts` — Nearest Neighbor heuristic + 2-opt improvement
- [x] Integrate with ORS for real walking distances (not straight-line) — done in `babb6d3` (`getMatrix` in `ors-client.ts`, wired into `tsp-planner.ts`'s distance matrix with haversine fallback if ORS fails). Note: the *ordering* step now uses real distances, but the earlier `selectFeasibleAttractions` time-budget filter still doesn't — see the "confirmed bug" item under `attraction-ranker.ts` below.
- [x] Define `WalkPlanRequest` and `WalkPlan` types in `src/lib/types/walk-plan.ts`
- [x] Handle `feasible: false` and `droppedAttractions` output

### Phase 4 — Real-Time Walk Engine
- [x] Build `src/lib/walk/walk-tracker.ts` — GPS tracking + pace calculation
- [x] Build `src/lib/walk/deviation-detector.ts` — deviation >50m → re-route
- [x] Build `src/lib/walk/poi-alerter.ts` — max 1 alert / 5 min, direction-relevant POIs only

- [ ] **Simulated deviation from the route:** `SimulatedWalkTracker` (`src/lib/walk/simulated-walk-tracker.ts`) only advances strictly along the planned route's own geometry (via `cumulativeDist`/`totalDistance` built from that geometry) — there's no way to make the simulated walker stray off-path. This means `deviation-detector.ts`'s >50m re-route trigger and `OffRouteNotification.tsx` can't actually be exercised end-to-end without real GPS drift. Needs a simulation mode that injects an off-route offset (or follows a different, nearby path for a stretch) so the full deviation → re-route → notification flow can be tested on demand.

### Phase 5 — Safety Layer
- [ ] Research IMS API (`ims.gov.il`) — is it programmatically accessible?
- [ ] Research פיקוד העורף API (`oref.org.il`) — alert feed format?
- [ ] Build `src/lib/safety/ims-client.ts` — weather + flood risk
- [ ] Build `src/lib/safety/oref-client.ts` — security alerts by area
- [ ] Build `src/lib/safety/safety-scorer.ts` — Go / Caution / No-Go score

### Phase 6 — Walk Companion UI
- [ ] Pre-walk screen: time available + walking pace + explicit/open mode input — `WalkCompanionPanel` covers location/time/pace/radius/categories; explicit-mode input is missing
- [x] Walk plan preview: ordered attractions, estimated time, feasibility check, safety briefing — `WalkPlanResults` + `TrailIntelligencePanel`
- [x] Active walk screen: real-time map, next step highlighted, progress bar, skip button — live map, follow-position and off-route banner in `WalkPlannerApp`; next-step highlight, "N of M stops" progress bar and per-stop skip in `AttractionDistancesPanel` (a skip marks the stop visited in `VisitTracker`, so re-plans drop it like a walked-past one)
- [x] Non-intrusive POI alert overlay — auto-dismissing overlay in `app/app/page.tsx`
- [ ] **Per-stop voice narration:** AI-generated spoken explanation for each attraction on the route (what it is, why it's worth stopping) — competitor research (`hiking-pulse`, 2026-07-28) found this is table-stakes for the category (Voyay, WalkNicely, AI TourMate all do audio narration), not our differentiator (that's the pace-adaptive re-route), but its absence is a real gap vs. every competitor. Needs: a TTS provider decision (cost/quality), and content generation (likely another Gemini pass per attraction, similar to the canonical-name/preference-extraction calls already built).
- [ ] **Historical stories per stop:** short historical/interesting narrative content per attraction, feeding into the voice narration above (or shown as text if narration isn't built first). Likely sourced via a Gemini call per attraction (name + coordinates → a few sentences of real history/context) rather than a fixed database — needs a hallucination-guard in the same spirit as `resolveCanonicalName`'s "prefer null over a plausible-sounding guess" (a fabricated "historical fact" is worse than no story at all).
- [ ] **Additional in-context recommendations:** surface extra suggestions beyond the planned stops (e.g. "there's also X nearby" cross-sell within a walk) — not yet scoped in detail, flagged by Ariel 2026-07-29 as a direction to think through later, not a concrete spec yet.

### Improvements — Walk Companion Pipeline

#### attraction-ranker.ts (`src/lib/attractions/attraction-ranker.ts`)
- [x] **Confirmed bug: `selectFeasibleAttractions`'s greedy budget-fit pass doesn't recompute distance/score against the actually-growing route — it reuses a stale, origin-only number for every candidate. Fixed 2026-08-06.** The loop now tracks where the walk has actually reached: the first pick is still costed off the baked-in origin distance (the walker is standing there), and after every acceptance each remaining candidate is re-costed by `haversineDistance` from that stop and the remaining list re-sorted on a position-corrected score (`scoreFrom` adds the ranker's `- distanceFromOrigin/1000` term back out and replaces it with the distance from the last stop). A rejection doesn't re-sort — nothing moved. Deliberately still haversine and still local: the real walking-network distances belong to `tsp-planner.ts`'s ORS matrix, and a matrix call per candidate per accepted stop would be quadratic against a rate-limited API to sharpen a pre-filter. Signature and `{ selected, dropped }` shape unchanged, so all three call sites (`walk-plan`, `attractions`, `tsp-debug`) were untouched. Tests in `tests/attraction-ranker.test.ts` cover both directions of the bug (a candidate far from the origin but one hop from the last stop is now kept; one that looked cheap from the origin but lies back past it is now reordered behind a better next step and then dropped), plus the `maxAttractions` cap and the unscored-explicit-stop fallback to pure proximity. One fixture in `tests/walk-plan-api.test.ts` moved — its second filler POI sat 100 m from the first, which is now correctly affordable. Full suite (388 tests), typecheck and lint pass. Original report follows. Verified in code (2026-08-01): `rankAttractions` (lines ~200-223) scores every attraction once, up front, using `distanceFromOriginMeters` (straight-line distance from the origin only) baked into each `ScoredAttraction`, then sorts once. `selectFeasibleAttractions` (lines 240-272) then walks that fixed, pre-sorted list top-to-bottom and — per attraction — computes `walkingMinutes` from that same frozen `distanceFromOriginMeters` (line 258-259, explicitly commented as "Rough walking time from previous stop (or origin) — this is a heuristic"), not from the previously *accepted* stop. So as stops get greedily accepted/dropped, neither the score nor the time-cost estimate for the remaining candidates is ever recalculated against the real, currently-built path — e.g. after accepting stop #2, a candidate #3 that's actually close to stop #2 (and would clearly fit the remaining budget) can still get dropped because its stale origin-distance number makes it look too expensive, while a candidate that's actually far from stop #2 can get accepted because its origin-distance looked cheap. `tsp-planner.ts`'s later reinsertion pass (the "smarter drop logic" item below) only rescues attractions already selected here — it never reconsiders ones this step already dropped for the wrong reason. Fix needs the budget-fit loop to compute cost incrementally from the last accepted stop (or route the whole selection step through the same real-distance mechanism the TSP-planner real-distance TODO above is adding), and to re-run/re-sort remaining candidates after each pick rather than trusting one static origin-based pass.

#### route.ts (`src/app/api/walk-plan/route.ts`)
- [ ] **Missing constraint: max distance from the start point at walk end.** `WalkCompanionPanel.tsx`'s "Search radius (km)" only bounds how far Overpass looks for candidate attractions around the origin — there's no separate param for "I want to end up within X km of where I started" (e.g. a loop walk that doesn't strand the user far from their starting point/car/hotel). Needs a distinct end-distance-from-origin constraint, plumbed through `buildWalkPlan`/`planWalkOrder` alongside the existing time-budget constraint, not conflated with search radius.
- [ ] **Optimization loop:** after `buildWalkPlan`, simulate the result (check feasibility, dropped count, total time coverage). If unsatisfactory, retry with relaxed radius or fewer constraints — loop until a good-enough plan is produced or a max iteration count is hit
- [ ] **User confirmation step:** optionally surface the plan to the user before committing ("here's your plan, approve or adjust") rather than returning the first result silently
- [x] **Input call audit:** review when and how often the frontend calls this endpoint — debounce, prevent duplicate calls, and only re-fetch when inputs actually change — `buildWalkRequestIdRef` in `app/app/page.tsx` supersedes stale in-flight calls; the endpoint is only hit on explicit user action or a pace-triggered rebuild

#### overpass-client.ts (`src/lib/attractions/overpass-client.ts`)
- [ ] **Dynamic avgVisitMinutes:** make visit duration context-aware — vary by country, city, attraction size, or use OSM tags (e.g. `area`, `capacity`) as signals instead of a fixed global constant per category
- [ ] **Name unnamed OSM elements instead of dropping them:** `toAttraction` currently returns `null` for any element without `name` / `name:en` / `name:he` (`overpass-client.ts:106-107`), so unnamed POIs are silently discarded. Decided fallback policy (not implemented — needs an infra decision first):
  1. **Cheap OSM-local pass first (preferred, no new API):** derive a name from tags already present on the element — `wikipedia` / `wikidata` label, `brand` / `operator` / `ref`, `addr:street` + `addr:housenumber` ("Café, 12 Ben Yehuda St"), or the name of the enclosing named way/building/site relation. Only elements that still have nothing fall through to step 2.
  2. **Google reverse-lookup fallback:** real-time nearest-place lookup on the coordinate — Google Places **Nearby Search** (rankby=distance, small radius) or Google **Reverse Geocoding** — and use the returned place name.
  3. If step 2 also finds nothing, drop the element exactly as today.
  Blocked on infra: no Google key exists (`.env.example` has only `ORS_API_KEY`), so this needs a `GOOGLE_PLACES_API_KEY` / `GOOGLE_MAPS_API_KEY` env var plus a decision on which Google API, its cost/quota, and per-request caching before any code is written.

#### extract-places (`src/app/api/extract-places/route.ts`, `nominatim-client.ts`)
- [ ] **Confirmed bug (schema-level certainty, not inference): a stated stop COUNT with no named places (e.g. "bring me 3 famous places in Tel Aviv") is silently dropped, and the whole city becomes a single destination.** Verified in code (2026-08-06) at the strictest level available — the Gemini call in `gemini-client.ts` enforces `responseMimeType: "application/json"` + `responseSchema: PLACES_SCHEMA`, and `PLACES_SCHEMA` (lines ~27-57) is a hard `Type.OBJECT` with exactly four properties: `places` (string array), `contextLocation` (string|null), `durationMinutes` (integer|null), `categoryNeeds` (array of the fixed enum `landmark, museum, park, food, viewpoint, religious, shopping, entertainment, nature, other` — confirmed against `ATTRACTION_CATEGORIES` in `preference-extractor.ts`). Because this is a structured-output schema enforced by the Gemini API itself, not just prompt wording, there is no field the model could populate with a count or a "famous/notable" quality even if it recognized the request — it is not a matter of the model failing to comply, the schema makes it physically impossible. Per `PLACE_EXTRACTION_SYSTEM_PROMPT`'s own worked example ("I want to visit Jerusalem" -> `places: ["Jerusalem"]`, no smaller place named), the same rule applies here: `places` resolves to `["Tel Aviv"]`, contextLocation null, and both "3" and "famous" are discarded with nowhere to go. Not rescued downstream either: even in pure open/discovery mode, `selectFeasibleAttractions` only fills stops up to the time budget (`availableMinutes`) — no code path anywhere plans toward a requested stop count. Needs: (1) a `stopCount`/`placeCount` field added to `PLACES_SCHEMA` and the extraction prompt, threaded through to cap `selectFeasibleAttractions`'s selection at that number instead of (or in addition to) the time budget; (2) a decision on how "famous"/"notable" maps to existing signals — likely reusing the notability signal `rankAttractions` already computes (`notabilityBonus`, wikidata/wikipedia/heritage tags) as a sort key when a "famous"-type request is detected, rather than adding a new category.

- [ ] **Google fallback when Nominatim can't geocode a named place:** live-tested 2026-07-28 — a real, well-known place ("מדרחוב זכרון יעקב", 4.4★/4.7K reviews on Google) came back as `unresolvedNames` because Nominatim/OSM has no matching searchable entity for it in that area, even though it's not a naming problem (the user supplied the exact correct name). This is the same underlying gap as the unnamed-OSM-elements item above (OSM coverage vs Google's), just triggered from the opposite direction (a resolvable name Nominatim doesn't have, vs. no name at all). Proposed fix: when Nominatim returns zero results for an extracted name, fall back to Google Places **Text Search** (or Geocoding API) using that name + the `contextLocation`/bias as a query hint, before giving up and reporting it as unresolved. Blocked on the same infra decision as above (`GOOGLE_PLACES_API_KEY`, cost/quota) — should be designed and built together with that item rather than as a separate one-off, since both need the same key/decision.

- [ ] **Don't fully trust Gemini for origin/location resolution:** flagged 2026-07-30 — `contextLocation`/`contextCoordinates` auto-fill (and the canonical-name retry) rest on Gemini's judgment of what a place name refers to, with no independent cross-check. The "prefer null over a guess" instruction reduces but doesn't eliminate the risk of a wrong-but-confident location silently becoming the walk's origin. Consider a sanity check (e.g. distance-from-expected-region bound, or requiring the geocode result and Gemini's claimed area to agree within some radius) before fully trusting an inferred origin, especially now that it can override manually-entered coordinates in some cases.

#### tsp-planner.ts (`src/lib/optimization/tsp-planner.ts`)
- [x] **Smarter drop logic:** before discarding a high-score attraction that exceeds the time budget, try reinserting it at an earlier position in the tour. Only drop if no valid insertion exists within budget — implemented in `planWalkOrder`
- [ ] **Don't pad a short explicit stop list just because there's leftover time budget:** if the user names a small, specific set of must-see stops (e.g. 3 named places) but also sets a generous time budget (e.g. way more time than those 3 stops need), the planner should not add extra discovered attractions to "use up" the remaining time — it should just return the walk through the 3 requested stops. Extra time left over is fine; it's not a signal to keep inserting more stops. Needs a way to distinguish "explicitly named stops" (from the free-text extraction / manually added waypoints) from "discovered/filler attractions" (from Overpass/category-need search) so only the latter respects leftover budget as a reason to add more.

#### preference-store.ts (`src/lib/preferences/preference-store.ts`)
- [x] Per-attraction like/dislike UI (`WalkFeedbackCard`, replaced the whole-walk-only 👍/👎) writing real POI-level `attraction_feedback` rows (`osm_id`/`poi_name`/`lat`/`lng`) via `saveAttractionFeedback` — built 2026-07-30.
- [ ] **POI-level suppression on the READ side:** the write side now has real POI-level data (see above), but nothing reads it back yet — a specific place the user downvoted isn't excluded if it's rediscovered on a later walk. Needs the `attraction_feedback` table's generated `poi_key` identity (`osm_id`, else `lower(name)@lat,lng` rounded to ~4dp) reconstructed on the read side to match a freshly-discovered Overpass result against a past downvoted POI, then wired into `attraction-ranker.ts`/`selectFeasibleAttractions` alongside the existing category-level suppression.
- [x] **Finish the non-binary preference conversion — done 2026-08-06.** The gap was narrower than it first looked: `attraction_feedback` already had a `signal = 'upvote'` category-level row shape with `occurrence_count` (written by `saveWalkFeedback` on every post-walk rating, via `deriveCategorySignals`), but nothing ever *read* it back — `walk-plan/route.ts` only ever called `getDownvotedCategories`. Design decision (confirmed with Ariel): mirror the downvote mechanism symmetrically, additive on top of the existing flat boost, not a replacement — `profiles.preferred_categories` (explicit free-text, "I love museums") stays a flat `PREFERRED_CATEGORY_BOOST` (+4) because that evidence is still qualitatively different (high-confidence on first occurrence); the *new* piece is `occurrencePreferenceBoost()` in `attraction-ranker.ts` (mirrors `downvotePenalty`: 2 per occurrence, capped at 8 via `PER_OCCURRENCE_PREFERENCE_BOOST`/`MAX_OCCURRENCE_PREFERENCE_BOOST`), fed by the new `getUpvotedCategories()` in `preference-store.ts` (mirrors `getDownvotedCategories`, both now share a `getCategorySignalCounts` helper). Wired into both `rankAttractions` call sites in `walk-plan/route.ts` via `withProfilePreferences`, and into the exploration-pick exclusion (an upvoted category is now barred from exploration, same reasoning as a downvoted one). No schema migration needed — the column and signal value already existed. Tests added mirroring the existing downvote coverage in `tests/attraction-ranker.test.ts`, `tests/preference-store.test.ts` and `tests/walk-plan-api.test.ts` — including the combined preferred+upvoted+downvoted arithmetic, the narrowness of the new exploration exclusion, and (the one real coverage gap in the first pass) the route-level "saved upvotes" block proving the now three-way `Promise.all` still isolates a failing read from the other two. Full suite (384 tests), typecheck, and lint all pass.

#### General / cross-cutting
- [ ] **Study the OSM AI Agent (QGIS plugin) for ideas:** natural-language → Overpass query via AI (https://plugins.qgis.org/plugins/osm_ai/) — same pattern this app already ships (prompt → Gemini → geocoded stops, `place-extractor.ts`/`preference-extractor.ts`), found via `hiking-pulse` 2026-07-28. Worth reading their approach for the category-need Overpass search specifically (`findNeedAttractions` in `extract-places/route.ts`) in case they've solved a query-construction problem we haven't hit yet.
- [ ] **Systematic hallucination audit across every Gemini call:** flagged 2026-07-29 — we have a real, working hallucination-guard pattern (`resolveCanonicalName`'s "prefer null over a plausible-sounding guess," the same philosophy proposed for historical-stories content above), but it was added ad hoc per-feature as each was built (place extraction, canonical-name retry, category-need detection, preference extraction). Do a deliberate pass across all of them to confirm every Gemini-backed extraction has an explicit "return null/empty rather than guess" instruction and that downstream code actually treats null as "nothing found" rather than silently trusting whatever comes back — before adding the historical-stories/narration features above, which will be the highest-hallucination-risk content yet (fabricated "history" is worse than a fabricated place name, since there's no geocode step to fail loudly).
- [ ] **Conversational auto-fill + chat history** (bigger vision, flagged 2026-07-28, still not scoped): let the app parse partial info directly out of free text (already partly done: duration, origin, category-needs) and then follow up conversationally for whatever's still missing, either via chat or quick-select buttons — plus a history of past planning conversations. Explicitly blocked on doing competitor/UX research on this specific pattern first (partial-info auto-fill + conversational fill-the-gaps + chat history UX), not on engineering — don't build this off a one-paragraph description alone.
  - **Specific under-specified-prompt case (flagged 2026-08-01):** when the prompt only names a location with no stated intent (e.g. "bring me a walk in Zichron [Yaakov]" — no categories, no named stops, no stated need), the app should ask a clarifying follow-up ("want a nature walk? history? food?") instead of silently guessing a generic walk. The clarifying question(s) should be informed by the user's saved `preferred_categories`/`downvoted` signal when logged in (e.g. skip asking about a category they've already downvoted, or lead with one they're known to like) rather than asking a generic, preference-blind question every time.
- [ ] **Domain extensions beyond walking** (long-term, not scoped): supermarket shopping runs and Wolt-style courier delivery as other uses of the same TSP/routing core — the `/app` hub page already has a placeholder sentence hinting at this ("other kinds of outings will get their own space here later") but no actual multi-domain UI exists.

#### page.tsx (`src/app/app/page.tsx`)
- [ ] **Split/expand the pace-rebuild setting: separate fast-pace vs. slow-pace auto-rebuild, and an option to ask the user mid-walk instead of rebuilding silently.** Verified in code (2026-08-01): `PaceChecker`/`ReplanTrigger` today has a single all-or-nothing `WalkSettings.paceCheckEnabled` flag — when on, any trigger reason (too slow or too fast) calls `onReplanNeeded` which goes straight into `handleBuildWalk(..., { autoResume: true })` in `WalkPlannerApp.tsx` with no user confirmation step, regardless of which direction the pace deviated. Wanted: (1) let the user separately choose whether auto-rebuild applies when they're walking faster than planned vs. slower than planned (e.g. someone might want a silent rebuild when running late, but prefer to just keep the extra buffer time silently when ahead of schedule, or vice versa); (2) a third mode — instead of "auto-rebuild" or "off", prompt the user mid-walk ("you're ahead of pace — add another stop?" / "you're behind — shorten the route?") and let them confirm before `handleBuildWalk` actually runs. This is a bigger change than the existing auto-resume toggle below (which only covers whether GPS tracking auto-resumes *after* a rebuild that's already been decided) — this item is about whether/how the rebuild decision itself gets made.
  - **Ask intent before assuming a slow pace stays slow:** when a slow-pace trigger fires, don't just silently shorten/rebuild the route on the assumption the walker will stay this slow for the rest of the walk — ask them directly ("you're walking slower than planned — do you plan to speed up, or should we adjust the route?"). If they say they intend to speed back up, hold off rebuilding (or rebuild against the original pace) instead of prematurely dropping stops; only rebuild against the slower pace if they confirm that's really their pace now, or don't respond. Whether this question gets asked at all (vs. just auto-rebuilding) should itself be a `WalkSettings` option, consistent with the auto-vs-ask modes above.
  - **Offer to speed up, opt-in only (flagged 2026-08-06):** when a slow-pace trigger fires, in addition to (or as part of) the "ask intent" question above, the app can suggest the walker pick up the pace instead of shortening the route ("you're behind — want to walk a bit faster to stay on plan, or should we adjust the route?"). This suggestion must be gated behind its own explicit `WalkSettings` opt-in (default OFF) — only show/offer it to a walker who has turned it on in settings; never surface it unprompted. Implement the full path (trigger condition, the prompt/UI, and the settings toggle) once scoped, not just the toggle.
  - **Settings extensibility — think through what else belongs here (flagged 2026-08-06):** `WalkSettings` is accumulating a growing list of independent opt-in toggles from these pace-related items alone (ask-vs-auto mode, fast/slow split, speed-up offer, auto-resume). Before building each one as a one-off checkbox, take a pass at the settings surface as a whole — how these group logically (e.g. "pace behavior" as one section), whether a settings redesign/reorganization is needed as more get added, and what other controls are likely to want the same "opt-in, off by default, surfaced in `WalkCompanionPanel`'s settings" treatment. Not scoped yet — a design pass, not an instruction to build anything specific.
- [ ] **Settings toggle for auto-resume after a pace-triggered rebuild:** a slow-pace rebuild now resumes live GPS tracking automatically (`handleBuildWalk(..., { autoResume: true })` from the `PaceChecker` callback in `handleStartWalk`, which calls `handleStartWalk(data)` on success). Add a `WalkSettings` flag (e.g. `autoResumeAfterRebuild`, default `true`) plus a checkbox in `WalkCompanionPanel`'s settings so a user can opt out and confirm the new route manually instead.

### Fixes Pending (from adversarial review)
- [x] Fix stale async race in `page.tsx:158-206` — `onFindHike` should abort if state cleared
- [x] Fix empty-route success masking in `route-planner.ts` — throw if all segments fail

## User Profile System (Supabase)

### Foundational layer — built 2026-07-28
- [x] Supabase browser client — `src/lib/supabase/client.ts`
- [x] Supabase server client (Server Components / Route Handlers / Server Actions) — `src/lib/supabase/server.ts`
- [x] Session refresh on every request — `src/lib/supabase/session.ts` + `src/proxy.ts` (Next 16 renamed the `middleware` file convention to `proxy`; the proxy no-ops when the Supabase env vars are absent, so the app still runs without them)
- [x] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` documented in `.env.example`
- [x] Initial schema — `supabase/migrations/20260728120000_initial_schema.sql`: `profiles` (pace, preferred categories, typical visit minutes, group preference) + `attraction_feedback` (upvote/downvote/skip on a POI or a whole category), RLS enabled with own-rows-only policies on both

**Run 2026-07-28** against the live project via the dashboard SQL editor. Both tables exist with RLS, and `on_auth_user_created` creates an empty `profiles` row for every new user.

### Auth — built 2026-07-28
- [x] Email + password auth screens — `src/app/login/page.tsx`, `src/app/signup/page.tsx`, shared form in `src/components/auth/AuthForm.tsx`
- [x] Email confirmation callback — `src/app/auth/callback/route.ts` (handles both the PKCE `?code=` and the `?token_hash=&type=` template shapes)
- [x] Session-aware account indicator — `src/components/auth/AccountIndicator.tsx` (server-rendered) + `LogoutButton.tsx`, mounted in `src/app/app/layout.tsx`. Renders nothing when the Supabase env vars are absent, and no walk-planning feature is gated behind login.
- [ ] Verify the live flow in a browser with a real inbox (signup → confirmation email → callback → session). Confirm the Supabase Auth **Site URL / Redirect URLs** allow-list includes `http://localhost:3000/auth/callback`, otherwise the email link bounces.

### Not built yet — next session picks up here
- [ ] Profile UI — the first-time onboarding questionnaire (categories, typical trip length, pace, solo/group) from the vault doc
- [x] Feedback UI — post-walk "did you like this walk?" (thumbs + optional free text) — `src/components/walk/WalkFeedbackCard.tsx` → `src/app/api/walk-feedback/route.ts`. Writes one **category-level** `attraction_feedback` row per category the walk contained (the table has no walk-level target). Per-POI "skipped" capture is still open.
- [x] Preference learning from free text — `src/lib/preferences/preference-extractor.ts` (Gemini pass + merge logic) + `preference-store.ts` (RLS-scoped read-modify-write of `profiles.preferred_categories`). Fed by both the "name your own stops" box and the post-walk elaboration. Gated by the "Remember my preferences" setting (`WalkSettings.preferenceLearningEnabled`, default on) and by having a session.
- [x] Wire the stored profile back into `WalkCompanionPanel` defaults (pace, preferred categories) and into `walk-plan` scoring — scoring done 2026-07-30 (`withProfilePreferences`, commit `6ba5118`), form defaults done same day (`getProfileDefaults`, commit `134215b`). Both are starting values, not locks — a manual change survives.
- [ ] Decide the migration path from the existing localStorage profile idea (`CLAUDE.md` → "User Profile Schema") to Supabase for signed-in users
- [ ] Generate DB types (`supabase gen types typescript`) and drop the `any` default on the client generics

## Post-MVP (Hiking Mode)
- [ ] Dependency security upgrade: `npm audit` (2026-07-28) flags 9 pre-existing vulnerabilities (1 low, 8 high) in transitive deps — Next.js itself needs a version bump (`npm audit fix --force` proposes `next@16.2.12`, outside current stated range — needs a deliberate upgrade + test pass, not an unattended `--force`), plus `@babel/core`, `js-yaml`, `brace-expansion`, `picomatch`. Not introduced by the Supabase install (verified: only `@supabase/ssr` + `@supabase/supabase-js` were added to `package.json`), pre-existed it.
- [ ] End-to-end testing with live ORS API key
- [ ] Server-side caching for directions/geocode responses
- [ ] Rate limiting/retries with backoff for upstream APIs
- [ ] Trail intelligence research spike for official sources: Israel Meteorological Service, Home Front Command, רשות הטבע והגנים, and Israel Police road-closure data — RTG/GovMap covered in `RTG_DATA_SPIKE.md`; IMS, Home Front Command and Police are still unresearched here
- [ ] Live safety integration for weather, flood risk, security alerts, trail closures, and blocked access roads — `build-briefing.ts` produces the briefing shape but every source is `status: "unavailable"` / heuristic
- [x] RTG-first trail data investigation (official API/feed, GIS download, or importable dataset) — see `RTG_DATA_SPIKE.md`
- [x] Keep both official trail-data paths open: direct RTG source and GovMap-backed source — decision recorded in `RTG_DATA_SPIKE.md`
- [x] Preferred trail-data strategy: RTG first, GovMap fallback/enrichment, and combine both if that produces a more reliable result — decision recorded in `RTG_DATA_SPIKE.md`
- [x] `Find Me a Hike` fallback policy: if no official RTG trail is found, still return a thoughtful general hiking suggestion with a clear non-official disclaimer and user-responsibility note — `searchBestHike` fallback branch
- [x] `Find Me a Hike` near-match behavior: suggest which constraints to relax or show an almost-matching route when no exact official result exists — `buildConstraintHints` / `buildFallbackMessages`
- [ ] Follow-up: add tourism/interesting places discovery and route-through/route-to suggestions
- [ ] Follow-up: evaluate GovMap as a potential source for tourism/POI enrichment and integrate if useful
- [ ] Follow-Up 3 security review: broad app/API/dependency/secrets/deployment security assessment
- [ ] Follow-Up 3 constraint QA + presentation pass: verify edge cases and explain failures/limits clearly in the UI
- [ ] Follow-Up 3 QA expansion: broader internal testing, regression coverage, edge-case scenarios, and release checks
- [ ] Follow-Up 3 internal verification: validate route generation, hike search, fallback behavior, and live-source failure handling
- [ ] Follow-Up 3 AI review pass: ask both AI systems/agents for broad testing, review, and additional follow-up recommendations
- [ ] Follow-Up 3 official website: design and build a public-facing product site
- [ ] Follow-Up 3 API cost review: pricing, quotas, billing, and provider trade-offs
- [ ] Follow-Up 3 cloud architecture: hosting that does not depend on a local machine running 24/7
- [ ] Follow-Up 3 production platform planning: storage, jobs, monitoring, uptime, backups, scaling
- [ ] Follow-Up 3 product design pass: stronger visual design and launch-quality UX polish
- [ ] Follow-Up 3 assistant/bot exploration: guided planning assistant with optional voice experience
- [ ] Follow-Up 3 legal review: terms, liability, privacy, data licensing, and legal-counsel check — confirm no exposure to suit (safety-alert accuracy, third-party map/POI data licensing, GPS-tracking liability)
- [ ] Follow-Up 3 patent/IP review: have a patent attorney check the routing/re-planning approach (TSP+MST shortcutting, deviation-triggered re-route, pace-based auto-replan with visited-attraction exclusion) for patentability and for freedom-to-operate against existing patents (Waze/Google/Komoot-style navigation patents)
- [x] Constraint-based hike search from user location with optional endpoint and endpoint-distance constraint — `HikeSearchPanel` + `hike-search.ts` preferences
- [ ] Prompt-based hike generation (for example: "find me a good hike in Jerusalem") using RTG trail data first, with fallback to generic routing
- [x] Drag to reorder waypoints — HTML5 drag-and-drop in `WaypointList`
- [ ] Route elevation profile
- [ ] Save/load routes (localStorage) — only `walk-settings` is persisted today
- [x] Mobile responsive layout
- [ ] Improve in-app phone UI/UX polish — better mobile spacing, hierarchy, controls, map/form balance, and touch-first flow across the app
- [ ] Add dynamic mid-walk replanning — let the user update intent during the walk (for example, keep remaining planned stops but also add food), rebuild the route from the current position, preserve already-visited stops as completed, and avoid generating them again
- [x] GPX export — `gpx-exporter.ts` (GPX + CSV) wired into `WalkRecordingPanel`
- [ ] Share routes via URL
