# Future Ideas

## Core Product Vision: Personal AI Walking Assistant

**This is the north star of the product.**

Not a route planner. A personal assistant that learns who you are as a walker:
- Knows your pace, your interests, how long you actually spend at each type of attraction
- Remembers what you've visited, what you skipped, what you loved
- Improves with every walk — no manual configuration ever
- Builds your next walk already knowing you

> "Give me 90 minutes in Tel Aviv" → the system already knows you love history, walk at 17 min/km, spend ~25 min at each stop. Builds the perfect walk without asking.

Everything else in this file (routing, Overpass, TSP, GPS, safety) is infrastructure that serves this vision.

---

## AI Walking Companion (Technical Architecture)

The product is pivoting from a static route planner to an interactive city walking companion.

### Vision
User says "I have 2 hours in Tel Aviv" → system builds a smart route from real attractions,
guides in real time, adjusts pace, alerts about nearby POIs without being annoying.

### Architecture
```
UI — Walk Companion Mode
     ↕
Real-Time Walk Engine  (GPS, pace, deviation, POI alerts)
     ↕
TSP Route Planner  (attraction ordering — Nearest Neighbor + 2-opt)
     ↕
Attraction Discovery  (Overpass API + user profile)
     ↕
Graph Layer  (OSMnx street network)
     ↕
ORS (existing) — precise walking paths between points
```

### Data Sources
| Source | Use | Cost |
|--------|-----|------|
| OSMnx | Street network graph | Free |
| Overpass API | Attractions / POIs | Free |
| ORS (existing) | Walking path geometry | Free tier |
| IMS | Weather / flood risk | Free (needs API research) |
| פיקוד העורף | Security alerts | Free (needs API research) |

### Phase Breakdown
1. **Graph Layer** — `src/lib/graph/osm-loader.ts`
2. **Attraction Discovery** — `src/lib/attractions/overpass-client.ts` + `attraction-ranker.ts`
3. **TSP Planner** — `src/lib/optimization/tsp-planner.ts`
4. **Real-Time Engine** — `src/lib/walk/walk-tracker.ts`, `deviation-detector.ts`, `poi-alerter.ts`
5. **Safety Layer** — `src/lib/safety/ims-client.ts`, `oref-client.ts`, `safety-scorer.ts`
6. **Walk Companion UI** — new mode in `src/app/page.tsx` + `src/components/`

### Open Questions
- IMS + פיקוד העורף API accessibility — needs manual research spike
- Overpass rate limits at scale — self-host Overpass Mirror?
- OSMnx cache strategy — by city bounding box or by user coordinates + radius?
- **Global vs. Israel-only?** OSMnx + Overpass cover the whole world → global works. RTG + GovMap are Israel-only → mode-split needed: "city walk" = global, "nature hike" = Israel-first

---

## Follow-Up: Conversational / Interactive UX Mode

**Idea:** Instead of a form-based input, the app asks the user conversational questions to build the walk plan.

**Flow:**
1. "What are you in the mood for today?" → **City attractions** / **Nature hike**
2. If **City attractions** → ask: city/area, time available, walking pace, interests (food, art, history, architecture…)
   - Uses: OSMnx + Overpass + TSP (global coverage)
3. If **Nature hike** → ask: region, difficulty, duration, solo or group
   - Uses: RTG trail data (רשות הטבע והגנים) + GovMap layers + safety check
   - Israel-only for now; fallback to Overpass trails globally if no RTG data

**Key UX principle:** never show a blank form. Always lead with a question and build the plan step by step from answers.

**Global scope:**
- City attraction mode → works worldwide (OSMnx + Overpass are global)
- Nature hike mode → Israel has official RTG data; outside Israel, fall back to Overpass `hiking` tag + trail databases (Wikiloc API? OSM hiking routes relation type?)
- Long-term: partner with national park APIs per country

**Status:** Follow-up — not started. Design + implement after core Walking Companion MVP.

---

## Follow-Up: Personal Walk Companion Bot (Personalization Engine)

**Idea:** A conversational bot that travels with the user across sessions — not just one walk, but learns over time.

**What it remembers explicitly:**
- Which attraction categories the user enjoys (and which they skip)
- Actual walking pace (measured from real walks, not just input)
- How long the user actually spends at each type of attraction
- Cities/areas they've already explored
- Preferred walk duration and radius

**How it works:**
- After each walk: bot asks 2-3 quick questions ("Did you enjoy that museum?", "Were you too rushed?")
- Stores answers in a user profile (localStorage first, then cloud)
- Next walk: pre-fills preferences automatically + explains why ("Based on your last walk, I'm skipping shopping and adding more history")
- Gradually improves suggestions without the user having to configure anything

**Key principle:** The user never manually sets preferences — the bot infers them from behavior and confirms with short questions.

**Tech needed:**
- User profile schema: `{ preferredCategories, avgPaceMinPerKm, avgVisitMinutes per category, visitedAttractionIds }`
- Post-walk feedback flow (3 questions max)
- Pre-walk personalization: pass learned profile into attraction ranker
- Storage: localStorage → eventual cloud sync

**Status:** Follow-up — not started. Build after GPS tracking and route geometry are connected.

---

## Route Modes

### Road Trip Mode
- Switch profile from foot-walking to driving-car
- Longer distances, different constraint defaults
- Gas station / rest stop suggestions

### Multi-Stop Itineraries
- Support flights and trains between cities
- Integrate with transit APIs (Google Directions, Rome2Rio)
- Per-leg mode selection (walk, drive, transit, fly)

### General Graph-Based Route Optimization
- Model the problem as a weighted graph
- Implement client-side solvers (branch-and-bound, genetic algorithms)
- Support arbitrary constraint types via a plugin system
- Allow custom edge weight functions

## Map & Visualization

### Elevation Profile
- Show elevation gain/loss chart alongside the route
- Color-code route segments by steepness
- Total ascent/descent stats

### Weather Overlay
- Show weather forecast for planned hiking date
- Warning for bad conditions along the route

### Dark Mode
- Dark map tiles (CartoDB dark matter or similar)
- Dark UI theme

## Data & Export

### GPX Export
- Export routes as GPX files for GPS devices
- Import GPX tracks to use as waypoints

### Save/Load Routes
- Save routes to localStorage
- User accounts with cloud storage (future)
- Share routes via URL

### Offline Map Tiles
- Service worker caching for offline use
- Download tile regions for planned hikes

## UX Improvements

### Mobile Responsive Layout
- Bottom sheet for controls on mobile
- Touch-friendly map interactions
- Swipe gestures for waypoint list

### Drag-to-Reorder Waypoints
- Drag handles in waypoint list
- Visual feedback during drag

### Route Comparison
- Calculate multiple route options
- Side-by-side comparison of distance, time, elevation

### Points of Interest
- Show nearby POIs (viewpoints, water sources, shelters)
- Filter by category
- Add POIs as optional waypoints

## Better Budget

### Reduce ORS Calls After Optimization
- After stop order is optimized, request directions once for the full ordered waypoint list
- Avoid per-leg `n-1` directions calls when one call can return full geometry

### Add Server-Side Caching
- Cache geocoding and route calculations by request hash
- Reuse frequent searches and repeat route plans to lower API usage

### Replace Public Nominatim Autocomplete
- Public Nominatim is free but not suitable for production autocomplete flows
- Move to a dedicated geocoder service or self-hosted search stack

### Self-Host for High Volume
- Run self-hosted ORS/Nominatim for predictable scaling
- Trade API spend for infrastructure/operations cost when usage grows

## Algorithm/Data Upgrades

### RTG Trail-First Hike Planning
- Prefer official hiking-path data from רשות הטבע והגנים as the primary source of valid hike paths
- Distinguish between official RTG trail-based hikes and fallback generic route generation
- If no official RTG trail matches the request, tell the user and then fall back to the current best-effort routing logic
- For `Find Me a Hike`, fallback should still try to produce a thoughtful general hiking suggestion rather than a random route
- Fallback results must clearly state that no official RTG trail was found, that the result is not an official recommendation, and that final responsibility remains with the user
- When no exact official match exists, suggest which constraints to relax or show a near-match that almost satisfies the request

### Constraint-Based Hike Search From User Location
- User provides current location and optional endpoint
- User can require the hike to finish about X km away from the endpoint as a constraint
- Planner should search for the best hike path under those constraints, preferring RTG-declared hiking trails first
- If no RTG result fully satisfies the constraints, show the closest near-match and explain which constraints blocked a perfect result

### Prompt-Based Hike Generation From RTG Data
- User can type prompts like "find me a good hike in Jerusalem"
- App should generate a hike primarily from RTG hiking/trail data rather than generic pedestrian routing
- If RTG coverage is missing for the area, explain that and fall back to the current route-generation approach

### Tourism + Interesting Places Routing
- Extend planning beyond RTG hiking trails to include nearby tourism/attraction points and interesting landmarks
- Support route suggestions that pass through or lead to these points while still respecting safety and distance constraints
- Evaluate whether GovMap layers can help identify official or semi-official points of interest relevant to hikers
- If GovMap proves useful, use it as enrichment alongside RTG-first trail data

### Elevation-Aware Optimization
- Include ascent/descent penalties in optimization scoring
- Prefer routes with target effort level (easier/moderate/harder)

### Trail Difficulty Modeling
- Weight segments by trail difficulty metadata
- Let users choose preferred difficulty band for route selection

### Preference-Aware POI Scoring
- Score candidate routes by proximity to preferred POI categories
- Balance POI value against added distance/time

### Weather + Time-Aware Routing
- Incorporate forecast conditions and planned departure time into scoring
- Penalize exposed or risky segments under poor weather windows

### Trail Intelligence + Official Safety Sources
- Use Israel Meteorological Service as the primary official source for weather, heat, rain, wind, and flood-risk signals where available
- Use Home Front Command as the primary official source for active security alerts relevant to the hike area
- Use רשות הטבע והגנים as the primary official source for trail closures, restrictions, fire warnings, and park-access notices
- Check Israel Police or equivalent official road-closure sources for blocked access roads that affect trailheads, entry, or exit logistics
- Show source coverage clearly: live official, heuristic fallback, or unavailable
- Never present heuristic safety guidance as if it were verified live official data

## Validation & Production Readiness

### End-to-End Live API Verification
- Run full E2E tests against live ORS + Nominatim with a real `ORS_API_KEY`
- Validate search -> waypoint add -> optimization -> rendered route flow

### Constraint Edge-Case Test Matrix
- Verify tight/overlapping/impossible time windows
- Verify unassigned jobs handling and user-facing warnings
- Verify max-distance and fixed start/end interactions under infeasible scenarios

### API Hardening For Production
- Add rate limiting and retries with backoff around upstream API calls
- Add response caching for geocode/directions/optimization
- Add monitoring/alerts and structured error logging
- Ensure geocoding usage is policy-compliant for production workloads

### Follow-Up 3: Security, Platform, Compliance, and Product Readiness
- Run a broad security review of the app, APIs, dependencies, secrets handling, and deployment surface
- Expand constraint testing and user-facing presentation so edge cases are both handled correctly and explained clearly in the UI
- Add broader QA coverage for internal flows, regressions, edge cases, and pre-release verification
- Build stronger internal testing for route generation, hike search, live-source failures, and fallback behavior
- Ask both AI systems/agents to perform broad reviews, QA passes, and suggest additional follow-ups that may be missing
- Design and build an official public-facing website for the product, not only the internal planner UI
- Review API pricing, quotas, and payment model across ORS, geocoding, weather, security, and closure providers
- Plan cloud hosting so the app can run reliably without depending on a personal computer being awake 24/7
- Evaluate production architecture needs such as hosting, storage, background jobs, monitoring, uptime, backups, and scaling
- Improve the overall design system and polished presentation layer for a real product launch
- Explore an assistant/bot experience that can help users plan hikes, including possible voice interaction
- Review legal and regulatory issues, including terms of use, liability, data licensing, privacy, and whether legal counsel should review the production version
