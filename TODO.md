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

## Post-MVP
- [ ] End-to-end testing with live ORS API key
- [ ] Server-side caching for directions/geocode responses
- [ ] Rate limiting/retries with backoff for upstream APIs
- [ ] Drag to reorder waypoints
- [ ] Route elevation profile
- [ ] Save/load routes (localStorage)
- [ ] Mobile responsive layout
- [ ] GPX export
- [ ] Share routes via URL
