"use client";

/** The openstreetmap.org page OSM asks data credits to link: https://www.openstreetmap.org/copyright (ODbL). */
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";

/**
 * The routing credit HeiGIT requires for every route line we draw, in its required wording (docs/data-source-terms.md):
 * "© openrouteservice.org by HeiGIT | Map data © OpenStreetMap contributors". The words below are exact; only the
 * place and weight are ours to choose. HeiGIT allows the credit "in the map image or elsewhere", and OSM wants it
 * actively visible (no toggle, no "i" button) with "OpenStreetMap contributors" linking its copyright page.
 *
 * It is one quiet line below the map, never on its edge: under the map block on Plan, at the bottom of the sheet on
 * Live Walk. Always on screen wherever the ORS-routed line is. Placing it away from the map edge is our own judgement,
 * not something HeiGIT has confirmed. `extra` carries the other data credits that apply right now
 * (ESA WorldCover while satellite finds are shown, Open-Meteo while the companion uses weather).
 * Google's own logo and terms stay on the map, uncovered.
 */
export function MapCredits({ extra = [], className = "" }: { extra?: string[]; className?: string }) {
  return (
    <p data-testid="map-credits" lang="en" dir="ltr" className={`text-balance text-center text-[12px] leading-4 text-charcoal/70 ${className}`}>
      <span data-testid="ors-credit">
        © openrouteservice.org by HeiGIT | Map data ©{" "}
        <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          OpenStreetMap contributors
        </a>
      </span>
      {extra.map((line) => (
        <span key={line}> · {line}</span>
      ))}
    </p>
  );
}
