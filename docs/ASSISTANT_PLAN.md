# Traike chat assistant — plan (2026-10-19)

## What Ariel asked for
Sol (gpt-6.1-sol) stops being a place-name *extractor* and becomes the assistant itself:
- A real chat with scrollable history; no separate "Find these places" / "Build walk" buttons.
- Sol understands the request, asks to confirm ("these places, right?"), and only then
  calls tools to get coordinates and to build the route. It works out city/place itself.
- Nothing said about time or radius = no limit (decided in code, Sol never asks).
- Sol's first prompt ("You are Traike's walking assistant...") tells it to keep answers
  short and never paste big outputs; tool results are also trimmed in code before it sees them.
- Sol does NOT compute routes: `build_walk` runs the existing code planner (rank + NN + 2-opt).

## Tools Sol gets (server-side loop, max ~6 tool calls per user turn)
- `search_place(query, near?)` → Google Places Text Search (OSM fallback).
- `find_nearby(category, near, radius_m?, count?)` → Google Nearby (OSM add-on later for nature).
- `set_walk_params(time_min?, radius_km?, end_distance_km?, pace?)` → blank stays unlimited.
- `build_walk(stop_ids)` → existing planner; result goes to the map.
Tool results are compacted (name, id, distance, type; <= ~8 items) before reaching Sol.

## Phases
1. Backend: tool-calling OpenAI provider + `/api/assistant` endpoint + compact tool results + tests (mocked). No UI change.
2. Chat UI replaces the form's find/build flow; history kept for the session.
3. Persist conversations (Supabase table — needs Ariel's OK before any migration).
4. Retire extract-places call path from the chat once the assistant is verified live.

## Open risk
Google ToS on passing Places content to an external LLM is unverified. Fallback if disallowed:
results stay server-side; Sol only sees ids/counts and asks the user to confirm by number.
