# CLAUDE.md — AI Walking Companion

## What This Is

Personal AI Walking Companion. Not a route planner — a companion that learns who you are as a walker and builds your perfect walk every time.

North star: `"תן לי 90 דקות בתל אביב"` → the system already knows your pace, interests, and average visit time per category. Builds the walk without configuration.

**Vault project file (full context):** `/Users/arielshorpacker/Documents/obs_vault_try/vault_try/projects/hiking-ai.md`
**Vault wiki:** `/Users/arielshorpacker/Documents/obs_vault_try/vault_try/wiki/hiking-ai/`

---

## Goal

The profile + feedback loop exist. Current work follows `docs/NEXT_PHASE_DECISIONS.md` (LLM engine, detected tier, memory, active companion).

---

## Stack

- Next.js + TypeScript + Tailwind CSS
- Leaflet + react-leaflet (interactive map, always `"use client"` + `ssr: false`)
- OpenRouteService (ORS) — directions + VROOM optimization
- Overpass API — POI discovery (with mirror fallback)
- Nominatim — geocoding (1 req/sec, 500ms debounce)
- Vitest — ~1,100+ unit tests (run `npm test`; count changes often)
- LLM seam — `src/lib/llm/` (providers: gemini, anthropic, openai, openai-compatible; zod schemas; retry + per-request timeout; budget guard)

---

## Phase Status

| Phase | What | Status |
|-------|------|--------|
| 1 — Graph Layer | Street network (OSMnx) | Skipped — ORS matrix + haversine fallback |
| 2 — Attraction Discovery | Overpass POI fetch + ranker | **Built** — `src/lib/attractions/` |
| 3 — TSP Route Planner | Nearest Neighbor + 2-opt + ORS | **Built** — `src/lib/optimization/tsp-planner.ts` |
| 4 — Real-Time Walk Engine | GPS, pace, deviation, POI alerts | **Built** — `src/lib/walk/` (incl. interactive walk, discovery collection, collapse/rejoin) |
| 5 — Safety Layer | IMS weather + פיקוד העורף + RTG | Not built — blocked on API access (detected-tier safety zones are separate, see docs/NEXT_PHASE_DECISIONS.md) |
| 6 — Walk Companion UI | Full walk mode UI | **Built** — planner, walk HUD, settings/recording/companion panels |
| — | User Profile + Feedback Loop | **Built** — Supabase profiles, category preferences, standing facts, walk feedback |
| — | LLM engine seam + budget guard + eval | **Built 2026-10-11 (P1)** — flags/keys pending, see Decisions |

The `walk-plan` API (`src/app/api/walk-plan/route.ts`) already wires Phase 2 + 3 + ORS into one endpoint. The walk engine (Phase 4) exists but isn't fully wired into the companion UI.

---

## Decisions Made

- **No OSMnx / street graph.** A hand-rolled JS graph benchmarked faster and lighter than OSMnx/Python for local routing (2026-07-27) — no need for a dedicated graph library.
- **Real walking-network distances for ordering (2026-07-30).** `tsp-planner.ts`'s matrix now comes from ORS Matrix Service (`foot-walking`), with a haversine fallback if that call fails — supersedes the earlier "haversine is sufficient" decision, which undercounted real walking distance on non-straight streets.
- **Coordinate convention:** internal = `{ lat, lng }`, ORS = `[lng, lat]`. Always use `toOrsCoord()` / `fromOrsCoord()` from `src/lib/utils/geo.ts`.
- **API keys server-side only.** `ORS_API_KEY` in `.env.local`, only used in `src/app/api/` route handlers.
- **No Redux/Zustand.** Hook-based state management (`useWaypoints`, `useConstraints`, `useRouteCalculation`, `useMapInteraction`, `useWalkSettings`).
- **Leaflet SSR rule.** Any component importing `leaflet` or `react-leaflet` must have `"use client"` + `next/dynamic` with `{ ssr: false }`.
- **User profile in localStorage first.** Backend persistence comes after the feedback loop is proven.
- **Corridor POIs, not per-fix lookups (2026-10-01).** Places near a walk come from one Overpass corridor query per route geometry (`/api/nearby`, `NearbyLoader`); left/right/ahead is classified locally on every fix. A walker >200 m outside the corridor triggers at most one point fetch per 2 min. Never a network call per GPS fix.
- **Local rejoin vs full rebuild (2026-10-01).** Off route, the default answer is `runLocalRejoin`: up to 2 street-snapped ORS directions (`/api/reroute`, no matrix) spliced onto the existing route; stops, order and the GPS watch are untouched. A full `/api/walk-plan` rebuild is the fallback (no routable way back, or >400 m away) and the "Redraw from here" button. The drawn route never starts with a straight GPS-to-vertex segment (`remainingRoute` gets the matched point).
- **No Google Places/Routes (2026-10-01).** Google's terms forbid showing Places/Routes data on a non-Google map, and imagery+vision on Google imagery is forbidden. Stay on OSM/Overpass + ORS; `NearbyProvider` (`src/lib/places/nearby-provider.ts`) is the seam if the basemap ever becomes Google.
- **LLM engine (2026-10-11).** All model calls go through `src/lib/llm/runLlm` (`gemini-client.ts` is a thin wrapper). Provider via `LLM_PROVIDER`/`LLM_MODEL` (tier overrides `_T1.._T3`), optional fallback on timeout/5xx/schema failure, per-request timeout (T1 6 s), `LLM_DAILY_BUDGET_USD` + per-caller caps via `llm_usage` (service role only): the budget guard is **built and wired for `/api/extract-places` only** (other LLM callers still pass no context, so they are uncapped), is inactive without `SUPABASE_SERVICE_ROLE_KEY`, and the `llm_usage` migration is not yet applied to a real DB. Default is a **pinned** `gemini-3.1-flash-lite` (never `-latest`, which silently moved to a 3x pricier model). No self-hosted GPU; open-weight models only via a hosted OpenAI-compatible endpoint. Untrusted text goes in `<data>` blocks. **Eval winner: not yet decided** — run `scripts/llm-eval.ts` with real keys (70 cases, 33 Hebrew-only) and record the result here. **Ariel action A3: enable Cloud Billing on the Gemini project** (free tier lets Google train on prompts) before public traffic; record the date here when done.
- **Shared upstream etiquette (2026-10-11).** Nominatim/Overpass/Wikipedia calls send `HikingRoutePlanner/1.0 (contact: $APP_CONTACT)` and sit behind a circuit breaker (3 failures or a Retry-After -> skipped 10 min). Basemap tile URL is `NEXT_PUBLIC_TILE_URL` (default OSM standard tiles; OSMF policy limits heavy/commercial use, so plan a provider before launch).
- **ORS VROOM returns order only, not geometry.** Always follow up with `/v2/directions` calls per consecutive pair.

---

## User Profile Schema (original design; the live schema is in `supabase/migrations/`)

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

Originally planned for `localStorage`; persistence now lives in Supabase (RLS) behind the "Remember my preferences" consent.

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
npm run test:e2e   # Playwright smoke suite — builds and serves the app itself on :3101
```

`test:e2e` runs against a production build in the app's auth-not-configured mode, with
`/api/walk-plan` stubbed at the browser. `E2E_REAL_UPSTREAM=1 npm run test:e2e` drops that
stub and drives the real Overpass/ORS path instead — worth doing by hand whenever the
walk-plan route changes.

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

## Architecture Maintenance Rules

Layering: `app -> components -> lib` (never upward). Enforced by `npm run deps:check` (dependency-cruiser, also a CI step).

1. **Before a feature:** inspect the relevant existing modules and reuse them. No duplicated logic, speculative abstractions, or new dependencies without need.
2. **After a feature:** run the relevant tests, `npx tsc --noEmit`, `npm run lint`, `npm run deps:check`.
3. **Refactor only the code the feature touches.** Unrelated modules need approval.
4. **Check-in cadence:** at the end of a feature, run `git log --oneline arch-review..HEAD | wc -l`. If ~15+ commits or 3-5 substantial features have landed, *suggest* (don't force) a focused review of recently changed code, only if complexity actually grew. After a review, move the tag: `git tag -f arch-review`.
5. **Full audit** (`improve-codebase-architecture`, `npm run knip`, `npm run deps:check`) only on real signals: circular deps, duplicated responsibilities, high coupling, or one change spreading across unrelated modules. Not on a calendar.
6. **Never** start a broad rewrite, DB migration, deploy, or knip-driven deletion without explicit approval. Knip results are leads (dynamic/Next-entry code can look unused), not a delete list.
7. Preserve behavior, API contracts, permissions and security. Report important coverage gaps and add tests for them.
8. **Every Traike change** ends with a GitHub commit+push and a zip in `~/Downloads`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
