import type { Coordinates } from "@/lib/types";

/** Public transport itineraries from Transitous (community GTFS feeds, MOTIS). Free, best-effort, no realtime guarantee. */
const BASE = "https://api.transitous.org/api/v1/plan";
export const TRANSIT_ATTRIBUTION = process.env.TRANSIT_PROVIDER === "google" ? "Transit data: Google" : "Transit data: Transitous (community GTFS feeds)";

export interface TransitLeg {
  departMs: number;
  arriveMs: number;
  /** Line names ridden, in order ("125", "82"). */
  lines: string[];
  transfers: number;
}

interface RawLeg {
  mode?: string;
  routeShortName?: string;
  displayName?: string;
}
interface RawItinerary {
  startTime?: string;
  endTime?: string;
  transfers?: number;
  legs?: RawLeg[];
}

/** First itinerary of a Transitous answer, or null when there is none. Pure. */
export function parseItinerary(json: unknown): TransitLeg | null {
  const it = (json as { itineraries?: RawItinerary[] } | null)?.itineraries?.[0];
  if (!it?.startTime || !it.endTime) return null;
  const departMs = Date.parse(it.startTime);
  const arriveMs = Date.parse(it.endTime);
  if (!Number.isFinite(departMs) || !Number.isFinite(arriveMs) || arriveMs < departMs) return null;
  const lines = (it.legs ?? []).filter((l) => l.mode && l.mode !== "WALK").map((l) => l.routeShortName || l.displayName || l.mode || "").filter(Boolean);
  return { departMs, arriveMs, lines, transfers: it.transfers ?? 0 };
}

/**
 * Transitous' usage policy (transitous.org/api, read 2026-10-26) allows only open-source, non-commercial apps and says
 * commercial use is not allowed. Traike is a product, so the live call stays off until a data source with commercial
 * terms replaces it (or Transitous agrees in writing); set TRANSIT_ENABLED=1 only for local development.
 */
export class TransitDisabledError extends Error {}

interface RawGoogleStep {
  transitDetails?: {
    stopDetails?: { departureTime?: string; arrivalTime?: string };
    transitLine?: { nameShort?: string; name?: string };
  };
}

/** First route of a Google Routes API (TRANSIT) answer: first boarding to last alighting. Pure. */
export function parseGoogleRoute(json: unknown): TransitLeg | null {
  const steps = ((json as { routes?: { legs?: { steps?: RawGoogleStep[] }[] }[] } | null)?.routes?.[0]?.legs?.[0]?.steps ?? []).filter((st) => st.transitDetails);
  if (!steps.length) return null;
  const departMs = Date.parse(steps[0].transitDetails?.stopDetails?.departureTime ?? "");
  const arriveMs = Date.parse(steps[steps.length - 1].transitDetails?.stopDetails?.arrivalTime ?? "");
  if (!Number.isFinite(departMs) || !Number.isFinite(arriveMs) || arriveMs < departMs) return null;
  const lines = steps.map((st) => st.transitDetails?.transitLine?.nameShort || st.transitDetails?.transitLine?.name || "").filter(Boolean);
  return { departMs, arriveMs, lines, transfers: steps.length - 1 };
}

const DEFAULT_TRANSIT_DAILY_CAP = 200;
let usageDay = "";
let usageCount = 0;

/** Paid Routes calls per server process per day (TRANSIT_DAILY_CAP overrides the default). */
function transitCapReached(): boolean {
  const raw = Number(process.env.TRANSIT_DAILY_CAP);
  const cap = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TRANSIT_DAILY_CAP;
  const today = new Date().toISOString().slice(0, 10);
  if (today !== usageDay) {
    usageDay = today;
    usageCount = 0;
  }
  return usageCount >= cap;
}

async function planGoogleTransit(from: Coordinates, to: Coordinates, departMs: number): Promise<TransitLeg | null> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("no Google key");
  if (transitCapReached()) throw new Error("transit daily cap reached");
  usageCount += 1;
  const point = (c: Coordinates) => ({ location: { latLng: { latitude: c.lat, longitude: c.lng } } });
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "routes.legs.steps.transitDetails" },
    body: JSON.stringify({ origin: point(from), destination: point(to), travelMode: "TRANSIT", departureTime: new Date(departMs).toISOString() }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Google Routes ${res.status}`);
  return parseGoogleRoute(await res.json());
}

/** Fastest-arrival ride from one point to another, leaving at or after `departMs`. Null when no service; throws when the service is down. */
export async function planTransit(from: Coordinates, to: Coordinates, departMs: number, contact = process.env.APP_CONTACT ?? "traike"): Promise<TransitLeg | null> {
  if (process.env.TRANSIT_PROVIDER === "google") return planGoogleTransit(from, to, departMs);
  if (process.env.TRANSIT_ENABLED !== "1") throw new TransitDisabledError("public transport lookups are switched off");
  const url = `${BASE}?fromPlace=${from.lat},${from.lng}&toPlace=${to.lat},${to.lng}&time=${new Date(departMs).toISOString()}&numItineraries=1`;
  const res = await fetch(url, { headers: { "User-Agent": `Traike (${contact})` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Transitous ${res.status}`);
  return parseItinerary(await res.json());
}
