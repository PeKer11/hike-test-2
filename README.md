# Hiking Route Planner

A web app that helps users find the best walking and hiking routes based on their constraints — distance limits, must-visit places, time windows, and fixed start/end points.

## Tech Stack

- **Next.js 15 + TypeScript** (App Router)
- **Tailwind CSS** for styling
- **Leaflet + react-leaflet** for interactive maps (OpenStreetMap tiles)
- **OpenRouteService API** for walking directions + route optimization
- **Nominatim** for geocoding/place search

## Getting Started

### Prerequisites

- Node.js 18+
- An OpenRouteService API key (free at https://openrouteservice.org/dev/#/signup)

### Setup

```bash
git clone <repo-url>
cd hiking-route-planner
npm install
```

Create a `.env.local` file from the example:

```bash
cp .env.example .env.local
```

Add your OpenRouteService API key to `.env.local`.

### Development

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Build

```bash
npm run build
npm start
```

## Features

- Interactive map — click to add waypoints or search for places
- Constraint-based route optimization:
  - **Max total distance** — limit the total route length
  - **Must-visit places** — mark certain stops as required, others optional
  - **Time windows** — visit places within specific time ranges
  - **Start/end points** — fix where the route begins and ends
- Users can combine any constraints they want
- Route display with distance and duration stats
- Walking and hiking profile support

## Architecture

- **API proxying**: The ORS API key is server-side only, proxied through Next.js Route Handlers at `/api/directions`, `/api/optimization`, `/api/geocode`
- **Route optimization**: Uses OpenRouteService's VROOM-based optimization endpoint, which natively supports all constraint types
- **Map rendering**: Leaflet components use `"use client"` and `next/dynamic` with `{ ssr: false }` to avoid SSR issues
- **State management**: Hook-based (`useWaypoints`, `useConstraints`, `useRouteCalculation`) — no external state library needed
