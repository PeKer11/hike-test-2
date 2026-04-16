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
- [ ] Build `src/lib/attractions/overpass-client.ts` — query POIs by location + category
- [ ] Build `src/lib/attractions/attraction-ranker.ts` — rank by relevance, popularity, avg visit time
- [ ] Define Attraction schema: `{ id, name, coordinates, category, avgVisitMinutes, rating? }`
- [ ] Support explicit mode (user names places) + open mode (system suggests)

### Phase 3 — TSP Route Planner
- [ ] Build `src/lib/optimization/tsp-planner.ts` — Nearest Neighbor heuristic + 2-opt improvement
- [ ] Integrate with ORS for real walking distances (not straight-line)
- [ ] Define `WalkPlanRequest` and `WalkPlan` types in `src/lib/types/walk-plan.ts`
- [ ] Handle `feasible: false` and `droppedAttractions` output

### Phase 4 — Real-Time Walk Engine
- [ ] Build `src/lib/walk/walk-tracker.ts` — GPS tracking + pace calculation
- [ ] Build `src/lib/walk/deviation-detector.ts` — deviation >50m → re-route
- [ ] Build `src/lib/walk/poi-alerter.ts` — max 1 alert / 5 min, direction-relevant POIs only

### Phase 5 — Safety Layer
- [ ] Research IMS API (`ims.gov.il`) — is it programmatically accessible?
- [ ] Research פיקוד העורף API (`oref.org.il`) — alert feed format?
- [ ] Build `src/lib/safety/ims-client.ts` — weather + flood risk
- [ ] Build `src/lib/safety/oref-client.ts` — security alerts by area
- [ ] Build `src/lib/safety/safety-scorer.ts` — Go / Caution / No-Go score

### Phase 6 — Walk Companion UI
- [ ] Pre-walk screen: time available + walking pace + explicit/open mode input
- [ ] Walk plan preview: ordered attractions, estimated time, feasibility check, safety briefing
- [ ] Active walk screen: real-time map, next step highlighted, progress bar, skip button
- [ ] Non-intrusive POI alert overlay

### Improvements — Walk Companion Pipeline

#### route.ts (`src/app/api/walk-plan/route.ts`)
- [ ] **Optimization loop:** after `buildWalkPlan`, simulate the result (check feasibility, dropped count, total time coverage). If unsatisfactory, retry with relaxed radius or fewer constraints — loop until a good-enough plan is produced or a max iteration count is hit
- [ ] **User confirmation step:** optionally surface the plan to the user before committing ("here's your plan, approve or adjust") rather than returning the first result silently
- [ ] **Input call audit:** review when and how often the frontend calls this endpoint — debounce, prevent duplicate calls, and only re-fetch when inputs actually change

#### overpass-client.ts (`src/lib/attractions/overpass-client.ts`)
- [ ] **Dynamic avgVisitMinutes:** make visit duration context-aware — vary by country, city, attraction size, or use OSM tags (e.g. `area`, `capacity`) as signals instead of a fixed global constant per category

#### tsp-planner.ts (`src/lib/optimization/tsp-planner.ts`)
- [ ] **Smarter drop logic:** before discarding a high-score attraction that exceeds the time budget, try reinserting it at an earlier position in the tour. Only drop if no valid insertion exists within budget

### Fixes Pending (from adversarial review)
- [ ] Fix stale async race in `page.tsx:158-206` — `onFindHike` should abort if state cleared
- [ ] Fix empty-route success masking in `route-planner.ts` — throw if all segments fail

## Post-MVP (Hiking Mode)
- [ ] End-to-end testing with live ORS API key
- [ ] Server-side caching for directions/geocode responses
- [ ] Rate limiting/retries with backoff for upstream APIs
- [ ] Trail intelligence research spike for official sources: Israel Meteorological Service, Home Front Command, רשות הטבע והגנים, and Israel Police road-closure data
- [ ] Live safety integration for weather, flood risk, security alerts, trail closures, and blocked access roads
- [ ] RTG-first trail data investigation (official API/feed, GIS download, or importable dataset)
- [ ] Keep both official trail-data paths open: direct RTG source and GovMap-backed source
- [ ] Preferred trail-data strategy: RTG first, GovMap fallback/enrichment, and combine both if that produces a more reliable result
- [ ] `Find Me a Hike` fallback policy: if no official RTG trail is found, still return a thoughtful general hiking suggestion with a clear non-official disclaimer and user-responsibility note
- [ ] `Find Me a Hike` near-match behavior: suggest which constraints to relax or show an almost-matching route when no exact official result exists
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
- [ ] Follow-Up 3 legal review: terms, liability, privacy, data licensing, and legal-counsel check
- [ ] Constraint-based hike search from user location with optional endpoint and endpoint-distance constraint
- [ ] Prompt-based hike generation (for example: "find me a good hike in Jerusalem") using RTG trail data first, with fallback to generic routing
- [ ] Drag to reorder waypoints
- [ ] Route elevation profile
- [ ] Save/load routes (localStorage)
- [x] Mobile responsive layout
- [ ] Improve in-app phone UI/UX polish — better mobile spacing, hierarchy, controls, map/form balance, and touch-first flow across the app
- [ ] Add dynamic mid-walk replanning — let the user update intent during the walk (for example, keep remaining planned stops but also add food), rebuild the route from the current position, preserve already-visited stops as completed, and avoid generating them again
- [ ] GPX export
- [ ] Share routes via URL
