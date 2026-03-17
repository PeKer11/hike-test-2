# CLAUDE.md — Instructions for AI Assistants

## Project Overview

Hiking route planner web app. Users place waypoints on a map, select constraints, and get an optimized walking/hiking route via OpenRouteService.

## How to Run

```bash
npm run dev        # Dev server at http://localhost:3000
npm run build      # Production build
npm run lint       # Run ESLint
```

## Project Structure

```
src/
  app/             # Next.js App Router pages and API route handlers
    api/           # Server-side API proxies (directions, optimization, geocode)
  components/      # React components
    map/           # Leaflet map components (all "use client", loaded with ssr: false)
    constraints/   # Constraint panel and inputs
    waypoints/     # Waypoint list, search, individual items
    route/         # Route results and stats display
    ui/            # Reusable primitives (Button, Card, Toggle, Slider)
  lib/
    api/           # ORS and Nominatim API clients (server-side only)
    hooks/         # React hooks for state management
    optimization/  # Route planning logic and constraint builder
    types/         # TypeScript interfaces
    utils/         # Utility functions (geo, time, polyline)
```

## Key Patterns

### Coordinate Convention
- Internal model: `{ lat, lng }` (named fields, no ambiguity)
- ORS API: `[lng, lat]` (reversed!)
- Always use `toOrsCoord()` / `fromOrsCoord()` from `src/lib/utils/geo.ts`

### Leaflet + Next.js SSR
- Every component importing from `leaflet` or `react-leaflet` MUST have `"use client"` directive
- The map wrapper MUST use `next/dynamic` with `{ ssr: false }`
- Import `leaflet-defaulticon-compatibility` and its CSS in MapView to fix marker icons

### API Key Security
- `ORS_API_KEY` lives in `.env.local` (gitignored)
- Only used server-side in route handlers under `src/app/api/`
- Never import `src/lib/api/ors-client.ts` from client components

### ORS Optimization (VROOM)
- The `/v2/optimization` endpoint wraps VROOM
- Constraint mapping:
  - Max distance → `vehicles[0].max_distance` (in meters)
  - Required stops → `jobs[i].priority: 100` (optional: `priority: 0`)
  - Time windows → `jobs[i].time_windows` (seconds from midnight)
  - Start/end → `vehicles[0].start` / `vehicles[0].end`
- The optimization response returns stop order but NOT walking path geometry
- After optimization, make follow-up `/v2/directions` calls for each consecutive pair to get trail paths

### Nominatim Geocoding
- Free, no API key, but rate-limited to 1 request/second
- Debounce search input by 500ms minimum
- Must include `User-Agent: HikingRoutePlanner/1.0` header

## State Management
- Hook-based, no external library (Redux, Zustand, etc.)
- `useWaypoints` — waypoint CRUD, reorder, start/end, required toggle
- `useConstraints` — toggle and configure each constraint type
- `useRouteCalculation` — trigger calculation, loading/error/result state
- `useMapInteraction` — map center/zoom, click mode
