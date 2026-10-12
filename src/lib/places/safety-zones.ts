/**
 * Deny-by-default safety zones for the imagery ("detected") tier.
 *
 * !!! COARSE, CONSERVATIVE, NOT SURVEYED. Every number below is HAND-ESTIMATED
 * !!! from memory (about 0.01 degree = 1 km at best, often worse). This is NOT
 * !!! border data. It must be reviewed by Ariel or a security-aware human before
 * !!! the flag is ever turned on. False positives (suppressing a fine place) are
 * !!! OK. False negatives (suggesting a place in a restricted, foreign or West
 * !!! Bank area) are NOT. When unsure, a region was left OUT of the allowed area.
 *
 * Rule (deny by default): a point is allowed only if it lies inside one of the
 * tight ALLOWED_AREAS polygons (Israel pre-1967 plus the coastal plain, drawn
 * well inside the borders, plus a small core of western Jerusalem) AND outside
 * every deny zone. Everything else, including every foreign country, the West
 * Bank, the Golan, the Arava and the Egypt border region, is denied. The deny
 * zones overlap the allowed polygons on purpose (belt and braces). Zones are
 * data: add a row, not a code path. There is no "mixed" tier any more: a
 * mixed-population area is either inside the Jerusalem core or denied.
 *
 * TODO (real-data refinement, then re-review):
 *  - Replace ALL polygons with OSM country borders (admin_level=2) and a Green
 *    Line / Area A,B,C data file (OCHA / Survey of Israel), stored as a repo data
 *    file, and keep the margins on top of it. Add a test that samples the data.
 *  - Closed military areas inside Israel proper (firing zones) are NOT here;
 *    they are handled per candidate from OSM, and OSM is incomplete.
 *  - Jerusalem core is a rectangle; the real Green Line / seam line runs through
 *    the city and must be replaced by surveyed geometry.
 *  - Temporary closures (war, alerts) cannot be known offline; see Pikud
 *    HaOref integration (Safety Layer, phase 5).
 */
import type { Coordinates } from "@/lib/types";
import type { Bbox } from "@/lib/types/landcover";
import { distanceToPath } from "@/lib/places/path";

/** [lat, lng] pairs. */
type LatLng = readonly [number, number];

interface ZoneBase {
  id: string;
  en: string;
  he: string;
}
interface PolygonZone extends ZoneBase {
  polygon: readonly LatLng[];
}
interface BufferZone extends ZoneBase {
  line: readonly LatLng[];
  halfWidthM: number;
}
type DenyZone = PolygonZone | BufferZone;

/**
 * Tight allowed areas (deny by default outside them). Hand-simplified and drawn
 * INSIDE Israel pre-1967 plus the coastal plain: west edge is open sea, north
 * stops ~3 km short of the Lebanon border, east stops at lon 34.95 (west of the
 * Green Line) south of lat 32.6, the Negev east edge is lon 35.10 (well inside
 * the Arava border), and the south-west edge is a diagonal ~10 km inside the
 * Egypt border.
 */
const ALLOWED_AREAS: readonly LatLng[][] = [
  [
    [33.03, 34.85],
    [33.03, 35.55],
    [32.62, 35.55],
    [32.6, 34.95],
    [31.25, 34.95],
    [31.25, 35.1],
    [30.0, 35.1],
    [30.0, 34.9],
    [31.0, 34.5],
    [31.3, 34.5],
    [31.7, 34.55],
  ],
  // Core of western / central West Jerusalem only (Rehavia, Givat Ram, Ein
  // Kerem, Mevaseret side). East edge deliberately short of the seam line.
  [
    [31.795, 35.14],
    [31.795, 35.215],
    [31.755, 35.215],
    [31.755, 35.14],
  ],
];

const DENY_ZONES: readonly DenyZone[] = [
  {
    id: "gaza-strip",
    en: "Gaza Strip",
    he: "רצועת עזה",
    polygon: [
      [31.62, 34.2],
      [31.62, 34.62],
      [31.2, 34.4],
      [31.2, 34.2],
    ],
  },
  {
    id: "gaza-envelope",
    en: "Gaza border envelope (about 7 km)",
    he: "עוטף עזה (כ-7 ק״מ)",
    // Line runs on the fence itself (Erez, Nahal Oz, Kissufim, Kerem Shalom) and
    // the half width is 9 km so the stated 7 km holds with 2 km of slack
    // (Sderot and Netivot are denied: accepted false positives).
    line: [
      [31.59, 34.54],
      [31.56, 34.56],
      [31.47, 34.49],
      [31.37, 34.42],
      [31.23, 34.28],
    ],
    halfWidthM: 9000,
  },
  {
    id: "lebanon-border",
    en: "Lebanon border strip",
    he: "רצועת גבול לבנון",
    line: [
      [33.09, 35.1],
      [33.08, 35.25],
      [33.085, 35.4],
      [33.098, 35.509],
      [33.14, 35.535],
      [33.21, 35.57],
      [33.28, 35.6],
    ],
    halfWidthM: 5000,
  },
  {
    id: "golan-yarmouk",
    en: "Golan, Syria and Yarmouk border (everything north of 32.9 east of 35.55, and east of 35.62 down to 32.6)",
    he: "גולן, סוריה וגבול הירמוך",
    polygon: [
      [33.5, 35.55],
      [33.5, 36.2],
      [32.6, 36.2],
      [32.6, 35.62],
      [32.9, 35.62],
      [32.9, 35.55],
    ],
  },
  {
    id: "hermon",
    en: "Mount Hermon (military area)",
    he: "החרמון (אזור צבאי)",
    polygon: [
      [33.4, 35.65],
      [33.4, 35.95],
      [33.18, 35.95],
      [33.18, 35.65],
    ],
  },
  {
    id: "jordan-valley-east",
    en: "Jordan river line and Jordan Valley (east of lon 35.45, 32.7 to 31.3)",
    he: "קו הירדן ובקעת הירדן",
    polygon: [
      [32.7, 35.45],
      [32.7, 36.2],
      [31.3, 36.2],
      [31.3, 35.45],
    ],
  },
  {
    id: "jordan-border",
    en: "Jordan Valley / Arava border strip",
    he: "רצועת גבול ירדן, בקעת הירדן והערבה",
    line: [
      [32.7, 35.57],
      [32.4, 35.55],
      [32.1, 35.55],
      [31.75, 35.54],
      [31.5, 35.47],
      [31.2, 35.42],
      [30.8, 35.17],
      [30.0, 35.08],
      [29.55, 34.98],
    ],
    halfWidthM: 3000,
  },
  {
    id: "arava-dead-sea",
    en: "Arava and Dead Sea south (everything east of lon 35.10 south of lat 31.3)",
    he: "הערבה וים המלח דרום (מזרחית לקו אורך 35.10)",
    polygon: [
      [31.3, 35.1],
      [31.3, 36.2],
      [29.0, 36.2],
      [29.0, 35.1],
    ],
  },
  {
    id: "egypt-border",
    en: "Egypt border strip",
    he: "רצועת גבול מצרים",
    line: [
      [31.22, 34.27],
      [30.87, 34.43],
      [30.5, 34.62],
      [30.0, 34.8],
      [29.5, 34.9],
    ],
    halfWidthM: 8000,
  },
  {
    id: "egypt-west",
    en: "Sinai side and Egypt border (west of lon 34.40 south of lat 31.0)",
    he: "סיני וגבול מצרים (מערבית ל-34.40 מדרום ל-31.0)",
    polygon: [
      [31.0, 33.5],
      [31.0, 34.4],
      [29.0, 34.4],
      [29.0, 33.5],
    ],
  },
  {
    id: "eilat-aqaba",
    en: "Eilat / Aqaba area (everything south of lat 30.0 east of lon 34.95; Eilat denial is an accepted false positive)",
    he: "אזור אילת-עקבה (מדרום ל-30.0 ומזרחית ל-34.95; אילת נחסמת במכוון)",
    polygon: [
      [30.0, 34.95],
      [30.0, 36.2],
      [29.0, 36.2],
      [29.0, 34.95],
    ],
  },
  {
    id: "lebanon-panhandle",
    en: "Galilee panhandle and everything north of lat 33.03 (Metula, Kiryat Shmona, Malkia, Rosh HaNikra)",
    he: "אצבע הגליל וכל מה שצפונית ל-33.03",
    polygon: [
      [33.6, 34.8],
      [33.6, 35.6],
      [33.03, 35.6],
      [33.03, 34.8],
    ],
  },
  {
    id: "far-south",
    en: "South of lat 29.55 (Eilat / Aqaba / Taba borders)",
    he: "מדרום לקו רוחב 29.55 (אילת, עקבה, טאבה)",
    polygon: [
      [29.55, 34.0],
      [29.55, 36.2],
      [29.0, 36.2],
      [29.0, 34.0],
    ],
  },
  {
    id: "west-bank-north",
    en: "Judea & Samaria (West Bank), north",
    he: "יהודה ושומרון, צפון",
    polygon: [
      [32.58, 34.93],
      [32.58, 35.62],
      [31.86, 35.62],
      [31.86, 34.93],
    ],
  },
  {
    id: "west-bank-south",
    en: "Judea & Samaria (West Bank), south",
    he: "יהודה ושומרון, דרום",
    polygon: [
      [31.72, 34.88],
      [31.72, 35.62],
      [31.3, 35.62],
      [31.3, 34.88],
    ],
  },
  {
    id: "west-bank-east-of-jerusalem",
    en: "Judean Desert east of Jerusalem",
    he: "מדבר יהודה, מזרח ירושלים",
    polygon: [
      [31.86, 35.3],
      [31.86, 35.62],
      [31.72, 35.62],
      [31.72, 35.3],
    ],
  },
  {
    id: "green-line-west-strip",
    en: "5 km strip west of the Green Line (lon 34.95 to 35.12, lat 31.2 to 32.6)",
    he: "רצועה של 5 ק״מ ממערב לקו הירוק",
    polygon: [
      [32.6, 34.95],
      [32.6, 35.12],
      [31.2, 35.12],
      [31.2, 34.95],
    ],
  },
  {
    id: "jerusalem-west-approach",
    en: "Approaches west of Jerusalem (Qatanna, Beit Anan, Biddu, Beit Iksa)",
    he: "גישות מערב ירושלים (קטנה, בית ענן, בידו, בית איקסא)",
    polygon: [
      [31.86, 34.95],
      [31.86, 35.14],
      [31.72, 35.14],
      [31.72, 34.95],
    ],
  },
];

function inRing(p: Coordinates, ring: readonly LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [yi, xi] = ring[i];
    const [yj, xj] = ring[j];
    if (
      yi > p.lat !== yj > p.lat &&
      p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

function inZone(p: Coordinates, zone: DenyZone): boolean {
  if ("polygon" in zone) return inRing(p, zone.polygon);
  return (
    distanceToPath(
      p,
      zone.line.map(([lat, lng]) => ({ lat, lng })),
    ) <= zone.halfWidthM
  );
}

export type SafetyVerdict =
  | { status: "denied"; zones: string[] }
  | { status: "mixed"; zones: string[] }
  | { status: "allowed"; zones: string[] };

/** Verdict for one point. Deny by default: allowed only inside a tight allowed area and outside every deny zone. */
export function classifyPoint(p: Coordinates): SafetyVerdict {
  if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) {
    return { status: "denied", zones: ["invalid-coordinate"] };
  }
  const zones = DENY_ZONES.filter((z) => inZone(p, z)).map((z) => z.id);
  if (!ALLOWED_AREAS.some((ring) => inRing(p, ring))) zones.unshift("outside-allowed-area");
  if (zones.length > 0) return { status: "denied", zones };
  return { status: "allowed", zones: [] };
}

/**
 * Verdict for a patch: the centroid, its four bbox corners and the four edge
 * midpoints must all be allowed (any denied sample denies the patch).
 */
export function classifyArea(centroid: Coordinates, bbox: Bbox): SafetyVerdict {
  const midLat = (bbox.south + bbox.north) / 2;
  const midLng = (bbox.west + bbox.east) / 2;
  const samples: Coordinates[] = [
    centroid,
    { lat: bbox.south, lng: bbox.west },
    { lat: bbox.south, lng: bbox.east },
    { lat: bbox.north, lng: bbox.west },
    { lat: bbox.north, lng: bbox.east },
    { lat: midLat, lng: bbox.west },
    { lat: midLat, lng: bbox.east },
    { lat: bbox.south, lng: midLng },
    { lat: bbox.north, lng: midLng },
  ];
  const verdicts = samples.map(classifyPoint);
  const denied = verdicts.filter((v) => v.status === "denied");
  if (denied.length > 0) {
    return {
      status: "denied",
      zones: [...new Set(denied.flatMap((v) => v.zones))],
    };
  }
  const mixed = verdicts.filter((v) => v.status === "mixed");
  if (mixed.length > 0) {
    return {
      status: "mixed",
      zones: [...new Set(mixed.flatMap((v) => v.zones))],
    };
  }
  return { status: "allowed", zones: [] };
}

export const SAFETY_ZONE_IDS = DENY_ZONES.map((z) => z.id);
