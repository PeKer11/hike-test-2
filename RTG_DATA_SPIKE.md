# RTG Data Research Spike

Date: 2026-04-03

## Summary
- RTG has an official GIS portal and explicitly exposes a geographic data viewing + download entrypoint.
- A documented public RTG hike-routing API was not identified.
- RTG also publishes a GovMap integration page with multiple RTG planning/protection layers.
- GovMap API docs are available and support embedded map + layer/query workflows, but require token/domain registration.
- For v1, static normalized RTG-style trail data with ORS fallback remains the correct implementation choice.

## Sources Checked
- RTG GIS landing page: https://www.parks.org.il/gis/
- RTG GovMap layers page: https://www.parks.org.il/govmap/
- GovMap API portal: https://api.govmap.gov.il/
- GovMap JavaScript functions docs (token + domain constraints): https://api.govmap.gov.il/docs/intro/javascript-functions
- GovMap create-map docs (token required): https://api.govmap.gov.il/docs/javascript-functions/create-map

## Concrete Findings
- RTG GIS page includes "מידע נוסף / הורדת מידע גאוגרפי" and GIS contact details.
- RTG GovMap page lists RTG-related layers (for example RTG sites, reserves/gardens in planning layers, ecological corridors, flight restrictions).
- GovMap API documentation confirms:
  - JavaScript API usage requires a registered token.
  - token is domain-bound (not reusable across arbitrary domains).
  - layered map embedding and feature intersection queries are supported.
- No explicit official RTG endpoint for direct hike-route generation was found.
- A publicly documented machine-readable RTG hiking-trail feed with ready-to-ingest route geometry was not confirmed during this spike.
- Access method today is therefore best described as: downloadable GIS information may exist, but not yet validated as a supported backend ingestion workflow.
- Data format remains unconfirmed from the public pages alone; likely GIS export formats, but GeoJSON/WFS/shapefile support was not verified end-to-end.
- Licensing / redistribution terms were not confirmed from the public pages and must be checked before production ingestion.
- Update cadence was not confirmed.
- Coverage scope was not confirmed; it is still unclear whether the available layers cover all marked hiking trails or only selected RTG-managed assets.

## Canonical v1 Source Decision
- Canonical source for v1: curated static dataset stored in `src/lib/data/rtg-trails.json`.
- Source classification for the current dataset: `rtg-curated`, not `rtg-official`.
- UI and route labels must not present curated + ORS-approximated geometry as an official RTG trail.

## Current v1 Decision (kept)
- Keep RTG-first candidate search using the curated normalized trail dataset: `src/lib/data/rtg-trails.json`.
- Keep runtime fallback to existing ORS route generation when RTG candidate matching fails.
- Keep architecture ready to swap `rtg-client` to a live source later without changing UI flow.

## Follow-Up Needed
- Keep both integration paths open for future work:
  - direct RTG source if a usable official export/feed becomes available
  - GovMap-backed source if it proves more practical or complete
- Preferred direction for future implementation:
  - use RTG as the first-choice official trail source
  - use GovMap as fallback or enrichment when RTG coverage/data access is incomplete
  - if both are available, compare or combine them and prefer the more reliable/complete trail representation
- Additional follow-up direction:
  - evaluate whether GovMap can enrich the planner with tourism/interesting-point layers
  - if usable, support route suggestions that lead to or pass through selected points of interest
- Product behavior decision for `Find Me a Hike`:
  - if no official RTG trail is found, still return a thoughtful general hiking suggestion rather than no result
  - clearly disclose that no official RTG route was found
  - clearly state that the fallback is not an official trail recommendation and that final responsibility remains with the user
  - when possible, explain which constraints blocked an official match and suggest what to relax or present a near-match
- Confirm RTG geodata licensing/redistribution terms before auto-syncing production data.
- Confirm update cadence and geographic coverage scope of RTG-exported layers.
- Validate whether GovMap layer query endpoints can provide reliable trail geometry for backend ingestion (not only browser embedding).
- If live ingestion is approved:
  - v1.1: scheduled refresh job + versioned dataset snapshot
  - v1.2: replace static dataset loader with live provider-backed `rtg-client`.
