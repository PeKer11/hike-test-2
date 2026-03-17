# Future Ideas

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
