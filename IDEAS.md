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
