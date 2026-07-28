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

### Phase 2 — Attraction Discovery
- [x] Build `src/lib/attractions/overpass-client.ts` — query POIs by location + category
- [x] Build `src/lib/attractions/attraction-ranker.ts` — rank by relevance, popularity, avg visit time
- [x] Define Attraction schema: `{ id, name, coordinates, category, avgVisitMinutes, rating? }`
- [x] Support explicit mode (user names places) + open mode (system suggests) — free-text prompt → Gemini Flash-Lite NER (`src/lib/api/gemini-client.ts`) → Nominatim geocode → `explicitAttractions`, via `/api/extract-places` and `PlacePromptPanel`

### Phase 3 — TSP Route Planner
- [x] Build `src/lib/optimization/tsp-planner.ts` — Nearest Neighbor heuristic + 2-opt improvement
- [ ] Integrate with ORS for real walking distances (not straight-line) — ordering/time budget still use haversine; ORS is only called for display geometry in `walk-plan/route.ts`
- [x] Define `WalkPlanRequest` and `WalkPlan` types in `src/lib/types/walk-plan.ts`
- [x] Handle `feasible: false` and `droppedAttractions` output

### Phase 4 — Real-Time Walk Engine
- [x] Build `src/lib/walk/walk-tracker.ts` — GPS tracking + pace calculation
- [x] Build `src/lib/walk/deviation-detector.ts` — deviation >50m → re-route
- [x] Build `src/lib/walk/poi-alerter.ts` — max 1 alert / 5 min, direction-relevant POIs only

### Phase 5 — Safety Layer
- [ ] Research IMS API (`ims.gov.il`) — is it programmatically accessible?
- [ ] Research פיקוד העורף API (`oref.org.il`) — alert feed format?
- [ ] Build `src/lib/safety/ims-client.ts` — weather + flood risk
- [ ] Build `src/lib/safety/oref-client.ts` — security alerts by area
- [ ] Build `src/lib/safety/safety-scorer.ts` — Go / Caution / No-Go score

### Phase 6 — Walk Companion UI
- [ ] Pre-walk screen: time available + walking pace + explicit/open mode input — `WalkCompanionPanel` covers location/time/pace/radius/categories; explicit-mode input is missing
- [x] Walk plan preview: ordered attractions, estimated time, feasibility check, safety briefing — `WalkPlanResults` + `TrailIntelligencePanel`
- [ ] Active walk screen: real-time map, next step highlighted, progress bar, skip button — live map, follow-position, off-route banner and `AttractionDistancesPanel` exist; next-step highlight, progress bar and skip button do not
- [x] Non-intrusive POI alert overlay — auto-dismissing overlay in `app/app/page.tsx`

### Improvements — Walk Companion Pipeline

#### route.ts (`src/app/api/walk-plan/route.ts`)
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
- [ ] **Google fallback when Nominatim can't geocode a named place:** live-tested 2026-07-28 — a real, well-known place ("מדרחוב זכרון יעקב", 4.4★/4.7K reviews on Google) came back as `unresolvedNames` because Nominatim/OSM has no matching searchable entity for it in that area, even though it's not a naming problem (the user supplied the exact correct name). This is the same underlying gap as the unnamed-OSM-elements item above (OSM coverage vs Google's), just triggered from the opposite direction (a resolvable name Nominatim doesn't have, vs. no name at all). Proposed fix: when Nominatim returns zero results for an extracted name, fall back to Google Places **Text Search** (or Geocoding API) using that name + the `contextLocation`/bias as a query hint, before giving up and reporting it as unresolved. Blocked on the same infra decision as above (`GOOGLE_PLACES_API_KEY`, cost/quota) — should be designed and built together with that item rather than as a separate one-off, since both need the same key/decision.

#### tsp-planner.ts (`src/lib/optimization/tsp-planner.ts`)
- [x] **Smarter drop logic:** before discarding a high-score attraction that exceeds the time budget, try reinserting it at an earlier position in the tour. Only drop if no valid insertion exists within budget — implemented in `planWalkOrder`

#### page.tsx (`src/app/app/page.tsx`)
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
- [ ] Wire the stored profile back into `WalkCompanionPanel` defaults (pace, preferred categories) and into `walk-plan` scoring, replacing the hardcoded defaults
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
