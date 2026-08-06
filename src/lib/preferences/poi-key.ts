/**
 * The TypeScript side of `attraction_feedback.poi_key`.
 *
 * That column is `generated always as (...) stored` in
 * `supabase/migrations/20260728120000_initial_schema.sql`, so it only exists
 * for rows the database already holds. Deciding whether a POI Overpass just
 * handed back is one the walker downvoted on an earlier walk means computing
 * the same identity for a row that was never written — which is what this file
 * is for. It is a reimplementation of SQL, so the SQL is quoted inline and the
 * behaviours that are easy to get subtly wrong (numeric scale, rounding
 * direction, the text format of a rounded numeric) are each pinned by a test.
 *
 * Deliberately not `server-only`: both the read path (`preference-store.ts`)
 * and the ranker consume it, and the ranker is a pure module.
 */

/**
 * The column's scale in the schema (`lat numeric(9, 6)`). A coordinate is
 * rounded to six places on the way *into* the table before `poi_key` rounds it
 * to four, and rounding twice is not always the same as rounding once — a value
 * that would round down directly can round up via an intermediate .5.
 */
const COLUMN_SCALE = 6;

/** `round(lat, 4)` — ~11 m, so the same POI re-fetched with slightly nudged geometry still matches. */
const KEY_SCALE = 4;

/** Add one to a string of decimal digits, growing it if it carries all the way. */
function increment(digits: string): string {
  const out = digits.split("");

  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] === "9") {
      out[i] = "0";
      continue;
    }
    out[i] = String(Number(out[i]) + 1);
    return out.join("");
  }

  return "1" + out.join("");
}

/**
 * `round(value, scale)::text` for a Postgres `numeric`.
 *
 * Done on the decimal digits rather than with `Math.round` or `toFixed`
 * because `numeric` is exact decimal and a float is not: 32.08005 is held as
 * 32.080049999... in a double, so `toFixed(4)` rounds it down where Postgres
 * rounds it up. `toFixed(12)` first recovers the decimal the client actually
 * sent (well inside a double's precision at coordinate magnitudes, and never
 * in exponent notation), and the rounding from there is exact.
 *
 * Postgres rounds numerics half away from zero, and keeps the scale in the
 * text output — `round(32.08, 4)::text` is `32.0800`, not `32.08`. Both matter:
 * the key is a string comparison.
 */
function roundToText(value: number, scale: number): string {
  const negative = value < 0;
  const [intPart, fracPart = ""] = Math.abs(value).toFixed(12).split(".");
  const frac = fracPart.padEnd(scale + 1, "0");

  let digits = intPart + frac.slice(0, scale);
  if (frac[scale] >= "5") {
    digits = increment(digits);
  }

  const padded = digits.padStart(scale + 1, "0");
  const whole = padded.slice(0, padded.length - scale).replace(/^0+(?=\d)/, "");
  const rounded = scale === 0 ? whole : `${whole}.${padded.slice(-scale)}`;

  // Postgres numeric has no negative zero: round(-0.00001, 4) is `0.0000`.
  return negative && /[1-9]/.test(digits) ? `-${rounded}` : rounded;
}

/** A coordinate as `poi_key` sees it: through `numeric(9, 6)`, then `round(_, 4)`. */
function coordinateText(value: number): string {
  return roundToText(Number(roundToText(value, COLUMN_SCALE)), KEY_SCALE);
}

export interface PoiIdentity {
  /** `Attraction.id` — the Overpass element id, e.g. `node/1234567`. */
  osmId?: string | null;
  name?: string | null;
  lat: number;
  lng: number;
}

/**
 * The generated column, verbatim:
 *
 *   coalesce(
 *     nullif(osm_id, ''),
 *     case when poi_name is null then ''
 *          else lower(poi_name) || '@' || round(lat, 4)::text || ',' || round(lng, 4)::text
 *     end
 *   )
 *
 * The empty string is what the column stores for category-level feedback, and
 * it is returned here for the same input so the two sides stay identical —
 * callers are expected to ignore it rather than match on it.
 */
export function poiKey(identity: PoiIdentity): string {
  const osmId = identity.osmId ?? "";
  if (osmId !== "") {
    return osmId;
  }

  if (identity.name === null || identity.name === undefined) {
    return "";
  }

  return `${identity.name.toLowerCase()}@${coordinateText(identity.lat)},${coordinateText(identity.lng)}`;
}

/**
 * Every key one POI could be filed under, because the two sides of a match do
 * not always agree on whether an OSM id exists. `saveAttractionFeedback` writes
 * `osm_id: null` for a stop the walker named themselves (the table's check
 * constraint asks for name and coordinates, not an id), so that downvote is
 * stored under a name key — while the same place rediscovered through Overpass
 * arrives with an id and would key on that, and the two would never meet.
 *
 * Comparing both identities of each side costs one extra string and closes
 * that gap. An OSM id is still the stronger of the two: it matches a renamed
 * POI, which the name key cannot.
 */
export function poiIdentityKeys(identity: PoiIdentity): string[] {
  const keys: string[] = [];

  const osmId = identity.osmId ?? "";
  if (osmId !== "") {
    keys.push(osmId);
  }

  const nameKey = poiKey({ ...identity, osmId: null });
  if (nameKey !== "") {
    keys.push(nameKey);
  }

  return keys;
}
