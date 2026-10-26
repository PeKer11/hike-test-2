# Data-source terms (checked 2026-10-26)

| Source | What the terms say | What Traike does |
|---|---|---|
| Transitous (transit) | transitous.org/api: only open-source, non-commercial apps; "Commercial use is not allowed"; best effort. | Live calls are OFF unless `TRANSIT_ENABLED=1` (dev only). The ride home reports "not available yet". Needs a commercial transit source, or written OK from Transitous (Matrix #transitous:matrix.spline.de). |
| openrouteservice (HeiGIT) | Free Standard key: 2,000 directions/day, 40/min. Attribution "© openrouteservice.org by HeiGIT \| Map data © OpenStreetMap contributors". One key per person, never in client code. The plans page marks the Collaborative tier "commercial use not allowed"; whether Standard allows a paid product is not stated. ORS staff: commercial users email enquiry@openrouteservice.org. | Key is server-side only. Map credit now uses the exact wording. Still needs a written answer on commercial use before launch. |
| Google Places | Hours/accessibility are stored in `assistant_chats.state`. Caching limits not yet reviewed. | Open question. |

Wheelchair profile on api.heigit.org verified 2026-10-26: directions with the app's `profile_params.restrictions`, `weightings.green`, round trip, alternatives, matrix and `waytype/steepness/surface` extras all answer 200; an unroutable point answers HTTP 404 with code 2010 (handled as no-route).
