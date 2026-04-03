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

## Current v1 Decision (kept)
- Keep RTG-first candidate search using static normalized trail dataset: `src/lib/data/rtg-trails.json`.
- Keep runtime fallback to existing ORS route generation when RTG candidate matching fails.
- Keep architecture ready to swap `rtg-client` to a live source later without changing UI flow.

## Follow-Up Needed
- Confirm RTG geodata licensing/redistribution terms before auto-syncing production data.
- Confirm update cadence and geographic coverage scope of RTG-exported layers.
- Validate whether GovMap layer query endpoints can provide reliable trail geometry for backend ingestion (not only browser embedding).
- If live ingestion is approved:
  - v1.1: scheduled refresh job + versioned dataset snapshot
  - v1.2: replace static dataset loader with live provider-backed `rtg-client`.
