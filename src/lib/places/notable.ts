import { appUserAgent } from "@/lib/api/http-identity";

export interface NotablePlace {
  /** Wikidata QID. */
  id: string;
  name: string;
  kind: string;
  lat: number;
  lng: number;
  /** Number of Wikipedia language editions: a measure of fame, not of quality. */
  fame: number;
}

export interface Box {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Wikidata "instance of" types worth walking to (subclasses count). Anything else (roads, interchanges,
 * settlements, stations, attacks, cemeteries) never matches, which is the whole junk filter. First match wins the label.
 */
const TYPES: Array<[qid: string, kind: string]> = [
  ["Q1348006", "Viewpoint"],
  ["Q34038", "Waterfall"],
  ["Q124714", "Spring"],
  ["Q35509", "Cave"],
  ["Q179049", "Nature reserve"],
  ["Q46169", "National park"],
  ["Q839954", "Archaeological site"],
  ["Q109607", "Ruins"],
  ["Q23413", "Castle"],
  ["Q474", "Aqueduct"],
  ["Q33506", "Museum"],
  ["Q1107656", "Garden"],
  ["Q22698", "Park"],
  ["Q40080", "Beach"],
  ["Q8502", "Mountain"],
  ["Q54050", "Hill"],
  ["Q187971", "Wadi"],
  ["Q47521", "Stream"],
  ["Q4022", "River"],
  ["Q570116", "Tourist attraction"],
];

const KIND_OF = new Map(TYPES);

export function sparqlFor(box: Box): string {
  const values = TYPES.map(([q]) => `wd:${q}`).join(" ");
  return `SELECT ?item ?name ?lat ?lon ?sl ?type WHERE {
  SERVICE wikibase:box { ?item wdt:P625 ?loc . bd:serviceParam wikibase:cornerSouthWest "Point(${box.west} ${box.south})"^^geo:wktLiteral . bd:serviceParam wikibase:cornerNorthEast "Point(${box.east} ${box.north})"^^geo:wktLiteral }
  VALUES ?type { ${values} }
  ?item wdt:P31/wdt:P279* ?type . ?item wikibase:sitelinks ?sl .
  ?item rdfs:label ?name . FILTER(lang(?name) = "he" || lang(?name) = "en")
  BIND(geof:latitude(?loc) AS ?lat) BIND(geof:longitude(?loc) AS ?lon)
} ORDER BY DESC(?sl) LIMIT 400`;
}

interface Binding {
  [k: string]: { value: string } | undefined;
}

/** One place per QID, the Hebrew name when there is one, the first listed type for its label, most famous first. */
export function parseSparql(json: unknown, max = 40): NotablePlace[] {
  const rows = (json as { results?: { bindings?: Binding[] } })?.results?.bindings;
  if (!Array.isArray(rows)) return [];
  const byId = new Map<string, NotablePlace & { he: boolean; rank: number }>();
  for (const r of rows) {
    const id = r.item?.value.split("/").pop();
    const lat = Number(r.lat?.value);
    const lng = Number(r.lon?.value);
    const typeQid = r.type?.value.split("/").pop() ?? "";
    const name = r.name?.value;
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lng) || !KIND_OF.has(typeQid)) continue;
    const he = /[֐-׿]/.test(name);
    const rank = TYPES.findIndex(([q]) => q === typeQid);
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, { id, name, kind: KIND_OF.get(typeQid)!, lat, lng, fame: Number(r.sl?.value) || 0, he, rank });
      continue;
    }
    if (he && !prev.he) {
      prev.name = name;
      prev.he = true;
    }
    if (rank < prev.rank) {
      prev.kind = KIND_OF.get(typeQid)!;
      prev.rank = rank;
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.fame - a.fame)
    .slice(0, max)
    .map(({ id, name, kind, lat, lng, fame }) => ({ id, name, kind, lat, lng, fame }));
}

const CACHE_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; places: NotablePlace[] }>();

/** Notable places inside a box from Wikidata (CC0). Throws on an upstream failure; cached per 0.02-degree grid for a day. */
export async function fetchNotable(box: Box, now = Date.now()): Promise<NotablePlace[]> {
  const g = (n: number, up: boolean) => (up ? Math.ceil(n / 0.02) : Math.floor(n / 0.02)) * 0.02;
  const snapped: Box = { south: g(box.south, false), west: g(box.west, false), north: g(box.north, true), east: g(box.east, true) };
  const key = [snapped.south, snapped.west, snapped.north, snapped.east].map((n) => n.toFixed(2)).join(",");
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MS) return hit.places;
  const res = await fetch("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/sparql-results+json", "user-agent": appUserAgent() },
    body: new URLSearchParams({ query: sparqlFor(snapped) }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`wikidata ${res.status}`);
  const places = parseSparql(await res.json());
  cache.set(key, { at: now, places });
  return places;
}
