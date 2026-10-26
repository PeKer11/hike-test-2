import type { Coordinates } from "@/lib/types";

/** Public transport itineraries from Transitous (community GTFS feeds, MOTIS). Free, best-effort, no realtime guarantee. */
const BASE = "https://api.transitous.org/api/v1/plan";
export const TRANSIT_ATTRIBUTION = "Transit data: Transitous (community GTFS feeds)";

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

/** Fastest-arrival ride from one point to another, leaving at or after `departMs`. Null when no service; throws when the service is down. */
export async function planTransit(from: Coordinates, to: Coordinates, departMs: number, contact = process.env.APP_CONTACT ?? "traike"): Promise<TransitLeg | null> {
  const url = `${BASE}?fromPlace=${from.lat},${from.lng}&toPlace=${to.lat},${to.lng}&time=${new Date(departMs).toISOString()}&numItineraries=1`;
  const res = await fetch(url, { headers: { "User-Agent": `Traike (${contact})` }, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Transitous ${res.status}`);
  return parseItinerary(await res.json());
}
