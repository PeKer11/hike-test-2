# CLAUDE.md — AI Walking Companion

## What This Is

Personal AI Walking Companion. Not a route planner — a companion that learns who you are as a walker and builds your perfect walk every time.

North star: `"תן לי 90 דקות בתל אביב"` → the system already knows your pace, interests, and average visit time per category. Builds the walk without configuration.

**Vault project file (full context):** `/Users/arielshorpacker/Documents/obs_vault_try/vault_try/projects/hiking-ai.md`
**Vault wiki:** `/Users/arielshorpacker/Documents/obs_vault_try/vault_try/wiki/hiking-ai/`

---

## Goal

Ship the user profile + feedback loop. That's the difference between a route planner and a companion. Everything else (safety layer, conversational UI, mobile redesign) comes after.

---

## Stack

- Next.js + TypeScript + Tailwind CSS
- Leaflet + react-leaflet (interactive map, always `"use client"` + `ssr: false`)
- OpenRouteService (ORS) — directions + VROOM optimization
- Overpass API — POI discovery (with mirror fallback)
- Nominatim — geocoding (1 req/sec, 500ms debounce)
- Vitest — 36 unit tests passing

---

## Phase Status

| Phase | What | Status |
|-------|------|--------|
| 1 — Graph Layer | Street network (OSMnx) | Skipped — haversine works fine for city walking |
| 2 — Attraction Discovery | Overpass POI fetch + ranker | **Built** — `src/lib/attractions/` |
| 3 — TSP Route Planner | Nearest Neighbor + 2-opt + ORS | **Built** — `src/lib/optimization/tsp-planner.ts` |
| 4 — Real-Time Walk Engine | GPS, pace, deviation, POI alerts | **Built** — `src/lib/walk/` |
| 5 — Safety Layer | IMS weather + פיקוד העורף + RTG | Not built — blocked on API access |
| 6 — Walk Companion UI | Full walk mode UI | Partial — `WalkSettingsPanel`, `WalkRecordingPanel`, `WalkCompanionPanel` |
| — | **User Profile + Feedback Loop** | **NOT BUILT — build this next** |

The `walk-plan` API (`src/app/api/walk-plan/route.ts`) already wires Phase 2 + 3 + ORS into one endpoint. The walk engine (Phase 4) exists but isn't fully wired into the companion UI.

---

## Decisions Made

- **No OSMnx / street graph.** Haversine distance is sufficient for attraction ordering in city mode. OSMnx adds complexity without meaningful accuracy gain at this scale.
- **Coordinate convention:** internal = `{ lat, lng }`, ORS = `[lng, lat]`. Always use `toOrsCoord()` / `fromOrsCoord()` from `src/lib/utils/geo.ts`.
- **API keys server-side only.** `ORS_API_KEY` in `.env.local`, only used in `src/app/api/` route handlers.
- **No Redux/Zustand.** Hook-based state management (`useWaypoints`, `useConstraints`, `useRouteCalculation`, `useMapInteraction`, `useWalkSettings`).
- **Leaflet SSR rule.** Any component importing `leaflet` or `react-leaflet` must have `"use client"` + `next/dynamic` with `{ ssr: false }`.
- **User profile in localStorage first.** Backend persistence comes after the feedback loop is proven.
- **ORS VROOM returns order only, not geometry.** Always follow up with `/v2/directions` calls per consecutive pair.

---

## User Profile Schema (next thing to build)

```ts
interface UserProfile {
  walkingPaceMinPerKm: number;           // default: 15
  preferredCategories: AttractionCategory[];
  avgVisitMinutes: Partial<Record<AttractionCategory, number>>;
  visitedPoiIds: string[];               // OSM IDs — never show again
  skippedPoiIds: string[];               // user explicitly skipped
  walkHistory: WalkSummary[];            // append-only
}
```

Lives in `localStorage` under key `"hikingAI:userProfile"`. Feed into `walk-plan` POST body automatically on load.

---

## Key Gotchas

- ORS free tier: 2000 direction requests/day, 40/min
- Nominatim: 1 req/sec, must include `User-Agent: HikingRoutePlanner/1.0` header
- Overpass: use mirror fallback list in `overpass-client.ts` if primary times out
- ORS optimization returns stop order NOT geometry — always follow up with directions calls

---

## How to Run

```bash
npm run dev        # Dev server at http://localhost:3000
npm run build      # Production build
npm run lint       # ESLint
npm run test       # Vitest
```

---

## Skills — When to Use What

| Situation | Tool | Command |
|-----------|------|---------|
| Planning a new feature (before coding) | Brainstorming skill | `/brainstorming` |
| Competitive research / what to build next | Hiking pulse | `/hiking-pulse` |
| Claude fails on complex code twice | Codex rescue | `/codex:rescue` |
| After building a non-trivial feature | Codex review | `/codex:review` |
| Large doc to analyze (API docs, competitor codebase) | Gemini (1M context) | `/g-cc:rescue` |
| Code review / testing strategy | Quality assurance | `/quality-assurance` |

**Multi-model routing rules for this project:**
- **Claude** = plans features, writes code, small-to-medium tasks
- **Codex** = reviews after Claude builds anything touching the walk engine, profile system, or deviation logic (correctness-critical)
- **Gemini** = use when you need to analyze something large: full ORS API docs, a competitor's open-source repo, or a long conversation history

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
