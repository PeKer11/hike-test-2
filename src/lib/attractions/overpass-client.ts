import { amenityKindOfTags } from "@/lib/attractions/amenity-tags";
import { createCircuitBreaker, parseRetryAfterMs } from "@/lib/api/circuit-breaker";
import { appUserAgent } from "@/lib/api/http-identity";
import type { Attraction, AttractionCategory } from "@/lib/types";
import type { Coordinates, NearbyPlace } from "@/lib/types";
import { walkCopy } from "@/lib/walk/walk-copy";

// Primary + mirror — tried in order if the previous one times out or fails
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

// How long a visitor typically spends at each category (minutes)
const AVG_VISIT_MINUTES: Record<AttractionCategory, number> = {
  landmark: 20,
  museum: 60,
  park: 30,
  food: 45,
  viewpoint: 15,
  religious: 20,
  shopping: 30,
  entertainment: 60,
  nature: 40,
  other: 15,
};

/**
 * Multiplier bounds on the per-category base above.
 *
 * The base numbers come from what a visitor typically does at that kind of
 * place, and tags are a weak proxy for size — a mapper who drew a footprint or
 * filled in `building:levels` was not estimating anybody's visit. Halving and
 * doubling is as far as that evidence stretches; past it the category itself is
 * the better guess.
 */
const MIN_VISIT_MULTIPLIER = 0.5;
const MAX_VISIT_MULTIPLIER = 2;

/** Nothing is worth stopping for less than this, whatever the tags say. */
const MIN_VISIT_MINUTES = 5;

/**
 * OSM subtypes that are a two-minute look, not a visit, regardless of what
 * their category's base says. A statue and a castle are both `historic` and
 * both rank as `landmark`, and charging 20 minutes for the statue is what
 * pushes the castle out of the plan.
 */
const GLANCEABLE_MULTIPLIER = 0.5;
const GLANCEABLE_HISTORIC = new Set([
  "memorial",
  "monument",
  "wayside_cross",
  "wayside_shrine",
  "milestone",
  "boundary_stone",
  "tomb",
]);

/**
 * Visit length for one element: the category base, adjusted by whatever size
 * signals the element's own OSM tags happen to carry.
 *
 * Scoped to tags Overpass already returns, deliberately. The original item also
 * wanted per-country and per-city variation, which needs a geo dataset nothing
 * here has — a hand-written table of guesses would look like data and be worth
 * less than the flat constant it replaced. Everything below is read off the
 * element itself.
 *
 * `area` is not used as a size signal despite being an obvious candidate: in
 * OSM it is a boolean that marks a closed way as a polygon rather than a line,
 * so it says nothing about how big the polygon is. What it hints at — the place
 * has a footprint at all — is already covered better by the element being a way
 * or relation rather than a node.
 *
 * Multipliers compound, so a six-storey museum drawn as a building gets both
 * adjustments, then the clamp keeps the product honest.
 */
export function visitMinutesForElement(
  category: AttractionCategory,
  tags: Record<string, string>,
  elementType: OverpassElement["type"],
): number {
  const base = AVG_VISIT_MINUTES[category];
  let multiplier = 1;

  // Drawn as a footprint rather than dropped as a point: somebody thought this
  // place had an outline worth tracing, which is the closest thing to a size
  // signal available without downloading geometry and computing the area.
  if (elementType === "way" || elementType === "relation") multiplier *= 1.25;

  // Storeys are a real proxy for how much there is to walk through inside.
  const levels = Number(tags["building:levels"]);
  if (Number.isFinite(levels)) {
    if (levels >= 6) multiplier *= 1.5;
    else if (levels >= 3) multiplier *= 1.25;
  }

  // How many people the place is built to hold — a 2000-seat theatre is a
  // different evening from a 60-seat one.
  const capacity = Number(tags.capacity);
  if (Number.isFinite(capacity)) {
    if (capacity >= 500) multiplier *= 1.5;
    else if (capacity >= 100) multiplier *= 1.25;
  }

  if (
    GLANCEABLE_HISTORIC.has(tags.historic) ||
    tags.tourism === "artwork" ||
    tags.man_made === "survey_point"
  ) {
    multiplier *= GLANCEABLE_MULTIPLIER;
  }

  const clamped = Math.min(
    Math.max(multiplier, MIN_VISIT_MULTIPLIER),
    MAX_VISIT_MULTIPLIER,
  );

  // Rounded to five minutes: these are estimates shown to a person planning an
  // afternoon, and "27 min visit" claims a precision none of this has.
  return Math.max(MIN_VISIT_MINUTES, Math.round((base * clamped) / 5) * 5);
}

// OSM tag → category mapping
function inferCategory(tags: Record<string, string>): AttractionCategory {
  const { tourism, amenity, leisure, historic, natural, shop } = tags;

  if (tourism === "museum") return "museum";
  if (tourism === "viewpoint") return "viewpoint";
  if (
    tourism === "attraction" ||
    tourism === "artwork" ||
    tourism === "theme_park" ||
    tourism === "zoo" ||
    tourism === "aquarium"
  )
    return "landmark";
  if (historic) return "landmark";
  if (amenity === "place_of_worship") return "religious";
  if (amenity === "restaurant" || amenity === "cafe" || amenity === "bar")
    return "food";
  if (amenity === "theatre" || amenity === "cinema") return "entertainment";
  if (leisure === "park" || leisure === "garden") return "park";
  if (
    leisure === "miniature_golf" ||
    leisure === "water_park" ||
    leisure === "amusement_arcade" ||
    leisure === "escape_game" ||
    leisure === "bowling_alley"
  )
    return "entertainment";
  if (natural === "peak" || natural === "waterfall" || natural === "cave_entrance")
    return "nature";
  if (shop) return "shopping";
  return "other";
}

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

interface EndpointAttempt {
  endpoint: string;
  method: "GET" | "POST";
}

// Per-mirror breaker: three failures in a row (or a Retry-After) skips that
// mirror for 10 minutes so a refusing public instance is not hammered.
export const overpassBreaker = createCircuitBreaker();

function requestHeaders(): Record<string, string> {
  return {
    ...REQUEST_HEADERS,
    "User-Agent": appUserAgent(),
  };
}

const REQUEST_HEADERS = {
  Accept: "application/json,text/plain,*/*",
  "Accept-Language": "en-US,en;q=0.9",
};

function buildOverpassQuery(center: Coordinates, radiusMeters: number): string {
  const { lat, lng } = center;
  const r = radiusMeters;

  // Query for the most relevant tourism/cultural POI types within radius
  return `
[out:json][timeout:25];
(
  node["tourism"~"museum|attraction|viewpoint|artwork|gallery|theme_park|zoo|aquarium"](around:${r},${lat},${lng});
  node["historic"](around:${r},${lat},${lng});
  node["amenity"~"place_of_worship|theatre|cinema|restaurant|cafe"](around:${r},${lat},${lng});
  node["leisure"~"park|garden|miniature_golf|water_park|amusement_arcade|escape_game|bowling_alley"](around:${r},${lat},${lng});
  node["natural"~"peak|waterfall|cave_entrance"](around:${r},${lat},${lng});
  way["tourism"~"museum|attraction|viewpoint|theme_park|zoo|aquarium"](around:${r},${lat},${lng});
  way["historic"](around:${r},${lat},${lng});
  way["leisure"~"park|garden|miniature_golf|water_park|amusement_arcade|escape_game|bowling_alley"](around:${r},${lat},${lng});
);
out center;
`.trim();
}

function elementToAttraction(el: OverpassElement): Attraction | null {
  const tags = el.tags ?? {};
  const name = tags.name ?? tags["name:en"] ?? tags["name:he"];
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  const category = inferCategory(tags);
  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    coordinates: { lat, lng },
    category,
    avgVisitMinutes: visitMinutesForElement(category, tags, el.type),
    tags,
  };
}

// A public mirror that has not answered in this long is treated as down; the
// old 20s per attempt let one dead mirror eat the whole request.
const ATTEMPT_TIMEOUT_MS = 8_000;
// A slow (not failed) attempt does not block the next one: after this long the
// next mirror is started alongside it and the first good answer wins.
const HEDGE_DELAY_MS = 2_500;

/** One request to one mirror. Throws on any failure; keeps the breaker current. */
async function overpassAttempt(
  attempt: EndpointAttempt,
  query: string,
  body: string,
  cancel: AbortSignal,
): Promise<OverpassElement[]> {
  const signal = AbortSignal.any([cancel, AbortSignal.timeout(ATTEMPT_TIMEOUT_MS)]);
  try {
    const response =
      attempt.method === "POST"
        ? await fetch(attempt.endpoint, {
            method: "POST",
            headers: {
              ...requestHeaders(),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
            signal,
          })
        : await fetch(`${attempt.endpoint}?data=${encodeURIComponent(query)}`, {
            method: "GET",
            headers: requestHeaders(),
            signal,
          });

    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) {
        overpassBreaker.recordFailure(
          attempt.endpoint,
          parseRetryAfterMs(response.headers?.get?.("Retry-After")),
        );
      }
      const errorText = await response.text().catch(() => "");
      const detail = errorText.trim().slice(0, 160);
      throw new Error(
        `Overpass API error: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ""}`,
      );
    }

    const data = (await response.json()) as OverpassResponse;
    overpassBreaker.recordSuccess(attempt.endpoint);
    return data.elements;
  } catch (err) {
    // Cancelled because another mirror already won: not this mirror's fault.
    if (!cancel.aborted && !(err instanceof Error && err.message.startsWith("Overpass API error"))) {
      overpassBreaker.recordFailure(attempt.endpoint);
    }
    throw err instanceof Error ? err : new Error("Overpass request failed.");
  }
}

/**
 * Run one Overpass query against the endpoint list (POST then GET on each) and
 * return its elements. Attempts start in order: the next one starts as soon as
 * the previous fails, or after HEDGE_DELAY_MS if it is merely slow, and the
 * first good answer wins. Shared by the attraction search and the
 * along-the-walk lookups so they fail over identically.
 */
export async function runOverpassQuery(query: string): Promise<OverpassElement[]> {
  const body = `data=${encodeURIComponent(query)}`;
  const attempts: EndpointAttempt[] = OVERPASS_ENDPOINTS.flatMap((endpoint) => [
    { endpoint, method: "POST" as const },
    { endpoint, method: "GET" as const },
  ]);

  const cancel = new AbortController();

  return new Promise<OverpassElement[]>((resolve, reject) => {
    let next = 0;
    let pending = 0;
    let settled = false;
    let lastError: Error = new Error("Overpass API unavailable.");
    let hedgeTimer: ReturnType<typeof setTimeout> | undefined;

    const fail = () => {
      settled = true;
      if (
        lastError.message.includes("403") ||
        lastError.message.toLowerCase().includes("forbidden")
      ) {
        reject(
          new Error(
            "Public map data service temporarily rejected the walk request. Please try again in a moment or adjust the area slightly.",
          ),
        );
        return;
      }
      reject(lastError);
    };

    const launch = () => {
      if (settled) return;
      clearTimeout(hedgeTimer);
      while (next < attempts.length && overpassBreaker.isOpen(attempts[next].endpoint)) {
        next += 1;
      }
      if (next >= attempts.length) {
        if (pending === 0) fail();
        return;
      }
      const attempt = attempts[next];
      next += 1;
      pending += 1;
      hedgeTimer = setTimeout(launch, HEDGE_DELAY_MS);
      overpassAttempt(attempt, query, body, cancel.signal).then(
        (elements) => {
          if (settled) return;
          settled = true;
          clearTimeout(hedgeTimer);
          cancel.abort();
          resolve(elements);
        },
        (err: Error) => {
          pending -= 1;
          lastError = err;
          launch();
        },
      );
    };

    launch();
  });
}

export async function fetchAttractions(
  center: Coordinates,
  radiusMeters: number,
): Promise<Attraction[]> {
  const elements = await runOverpassQuery(buildOverpassQuery(center, radiusMeters));

  const attractions: Attraction[] = [];
  const seenIds = new Set<string>();

  for (const el of elements) {
    const attraction = elementToAttraction(el);
    if (!attraction) continue;
    if (seenIds.has(attraction.id)) continue;
    seenIds.add(attraction.id);
    attractions.push(attraction);
  }

  return attractions;
}

// --- Places along a walk -----------------------------------------------------

// `around` takes "radius, lat1, lon1, lat2, lon2, ..." — a corridor around the
// polyline; with a single point it is the circle fetchAttractions already uses.
function aroundClause(radiusMeters: number, points: Coordinates[]): string {
  const coords = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(",");
  return `(around:${radiusMeters},${coords})`;
}

const MAX_NEARBY_ELEMENTS = 300;
// The scan's union is bigger: a corridor's worth plus a notable-only ring.
const MAX_SCAN_ELEMENTS = 450;

function corridorStatements(a: string): string {
  return `  node["tourism"~"museum|attraction|viewpoint|artwork|gallery|theme_park|zoo|aquarium"]${a};
  node["historic"]${a};
  node["amenity"~"place_of_worship|theatre|cinema|restaurant|cafe"]${a};
  node["leisure"~"park|garden|miniature_golf|water_park|amusement_arcade|escape_game|bowling_alley"]${a};
  node["natural"~"peak|waterfall|cave_entrance"]${a};
  way["tourism"~"museum|attraction|viewpoint|theme_park|zoo|aquarium"]${a};
  way["historic"]${a};
  way["leisure"~"park|garden|nature_reserve|miniature_golf|water_park|amusement_arcade|escape_game|bowling_alley"]${a};
  way["landuse"="forest"]${a};
  way["natural"~"wood|water|beach"]${a};
  node["amenity"~"drinking_water|toilets"]${a};`;
}

// The ring: only what is worth a detour. Viewpoints, attractions, museums,
// anything historic, named parks / reserves / gardens, peaks, water, beaches,
// woods, and anything with a Wikidata item.
function ringStatements(r: string): string {
  return `  nwr["tourism"~"viewpoint|attraction|museum"]${r};
  nwr["historic"]${r};
  nwr["leisure"~"park|nature_reserve|garden"]["name"]${r};
  nwr["natural"~"peak|water|beach|wood"]${r};
  nwr["wikidata"]${r};`;
}

function buildNearbyQuery(radiusMeters: number, points: Coordinates[]): string {
  const a = aroundClause(radiusMeters, points);
  return `
[out:json][timeout:25];
(
${corridorStatements(a)}
);
out center ${MAX_NEARBY_ELEMENTS};
`.trim();
}

/** One union: the corridor with full tags plus the notable-only ring. */
function buildScanQuery(
  radiusMeters: number,
  ringRadiusMeters: number,
  points: Coordinates[],
): string {
  const a = aroundClause(radiusMeters, points);
  const r = aroundClause(ringRadiusMeters, points);
  return `
[out:json][timeout:25];
(
${corridorStatements(a)}
${ringStatements(r)}
);
out center ${MAX_SCAN_ELEMENTS};
`.trim();
}

/**
 * Mirrors `ringStatements`: what is worth a detour from the ring. Used to
 * thin tile-cache results (which hold the whole corridor set) to a plain scan's ring.
 */
export function isRingNotable(tags: Record<string, string>): boolean {
  return Boolean(
    /^(viewpoint|attraction|museum)$/.test(tags.tourism ?? "") ||
      tags.historic ||
      (/^(park|nature_reserve|garden)$/.test(tags.leisure ?? "") && tags.name) ||
      /^(peak|water|beach|wood)$/.test(tags.natural ?? "") ||
      tags.wikidata,
  );
}

function sceneryLabel(tags: Record<string, string>): string {
  if (tags.landuse === "forest" || tags.natural === "wood") return walkCopy.scenery.wood;
  if (tags.natural === "water") return walkCopy.scenery.water;
  if (tags.natural === "beach") return walkCopy.scenery.beach;
  if (tags.tourism === "viewpoint") return walkCopy.scenery.viewpoint;
  if (tags.leisure === "park" || tags.leisure === "garden") return walkCopy.scenery.park;
  return walkCopy.scenery.other;
}

const SCENERY_ONLY = (tags: Record<string, string>): boolean =>
  tags.landuse === "forest" ||
  tags.natural === "wood" ||
  tags.natural === "water" ||
  tags.natural === "beach" ||
  tags.leisure === "nature_reserve";

function elementToNearbyPlace(el: OverpassElement): NearbyPlace | null {
  const tags = el.tags ?? {};
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (lat === undefined || lng === undefined) return null;

  // Practical amenities (water, toilets): never callouts. The discovery loader
  // splits them off by `tags.amenity` and keeps them for the companion.
  const amenity = amenityKindOfTags(tags);
  if (amenity) {
    return {
      id: `osm-${el.type}-${el.id}`,
      name: tags.name ?? (amenity === "toilets" ? "Toilets" : "Drinking water"),
      coordinates: { lat, lng },
      category: "other",
      avgVisitMinutes: 0,
      tags,
      source: "osm",
      verification: "mapped-unnamed",
      kind: "scenery",
    };
  }

  const named = elementToAttraction(el);
  const isScenery =
    SCENERY_ONLY(tags) ||
    (named === null && (tags.leisure === "park" || tags.leisure === "garden"));
  if (named && !isScenery) {
    return { ...named, source: "osm", verification: "registered", kind: "poi" };
  }

  // Unnamed land cover is still worth a mention ("wooded area"); an unnamed
  // restaurant or shop is not.
  if (!isScenery) return null;
  const category = inferCategory(tags);
  return {
    id: `osm-${el.type}-${el.id}`,
    name: named?.name ?? sceneryLabel(tags),
    coordinates: { lat, lng },
    category: category === "other" ? "nature" : category,
    avgVisitMinutes: 0,
    tags,
    source: "osm",
    verification: named ? "registered" : "mapped-unnamed",
    kind: "scenery",
  };
}

async function fetchNearby(
  radiusMeters: number,
  points: Coordinates[],
  ringRadiusMeters?: number,
): Promise<NearbyPlace[]> {
  const elements = await runOverpassQuery(
    ringRadiusMeters === undefined
      ? buildNearbyQuery(radiusMeters, points)
      : buildScanQuery(radiusMeters, ringRadiusMeters, points),
  );
  const places: NearbyPlace[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    const place = elementToNearbyPlace(el);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    places.push(place);
  }
  return places;
}

/** Places within `radiusMeters` of a (pre-simplified) walking path. */
export function fetchPlacesAlongPath(
  path: Coordinates[],
  radiusMeters: number,
): Promise<NearbyPlace[]> {
  return fetchNearby(radiusMeters, path);
}

/**
 * The discovery scan: corridor and ring in ONE Overpass request. The caller
 * splits the result by distance to the path.
 */
export function fetchPlacesScan(
  points: Coordinates[],
  radiusMeters: number,
  ringRadiusMeters: number,
): Promise<NearbyPlace[]> {
  return fetchNearby(radiusMeters, points, ringRadiusMeters);
}

/** Most elements one tile-union request may return (many tiles, one request). */
const MAX_TILE_ELEMENTS = 1500;

/**
 * The same corridor + ring statements over a union of bounding boxes: what the
 * shared tile cache fetches for the tiles it is missing. Everything in the
 * boxes comes back; the caller filters to its corridor in memory.
 */
export async function fetchPlacesInBboxes(
  bboxes: Array<{ south: number; west: number; north: number; east: number }>,
): Promise<NearbyPlace[]> {
  const body = bboxes
    .map((b) => {
      const box = `(${b.south.toFixed(5)},${b.west.toFixed(5)},${b.north.toFixed(5)},${b.east.toFixed(5)})`;
      return `${corridorStatements(box)}\n${ringStatements(box)}`;
    })
    .join("\n");
  const elements = await runOverpassQuery(
    `[out:json][timeout:25];\n(\n${body}\n);\nout center ${MAX_TILE_ELEMENTS};`,
  );
  const places: NearbyPlace[] = [];
  const seen = new Set<string>();
  for (const el of elements) {
    const place = elementToNearbyPlace(el);
    if (!place || seen.has(place.id)) continue;
    seen.add(place.id);
    places.push(place);
  }
  return places;
}

/** Places within `radiusMeters` of one point. */
export function fetchPlacesAround(
  point: Coordinates,
  radiusMeters: number,
): Promise<NearbyPlace[]> {
  return fetchNearby(radiusMeters, [point]);
}
