import { haversineDistance } from "@/lib/utils/geo";

import { presenceEnabled } from "./flag";

export const HEARTBEAT_MS = 5 * 60_000;
export const CELL_CHANGE_MIN_MS = 60_000;
export const QUIET_START_MS = 10 * 60_000;
export const HOME_RADIUS_M = 800;
export const MAX_ACCURACY_M = 100;
export const HIDDEN_CLEAR_MS = 5 * 60_000;

export interface Point {
  lat: number;
  lng: number;
}

export interface PublishInput {
  nowMs: number;
  walking: boolean;
  startedAtMs: number;
  startPoint: Point | null;
  position: Point | null;
  accuracyM: number | null;
  pageVisible: boolean;
  /** When the page went to the background, if it is there now. */
  hiddenSinceMs: number | null;
  /** The walker hid themselves ("ghost") for this walk. */
  ghost: boolean;
  audience: "off" | "friends" | "public";
  /** classifyPoint(position) is "allowed" (not a deny zone, inside the supported area). */
  zoneAllowed: boolean;
}

export interface PublishState {
  published: boolean;
  lastPublishAtMs: number | null;
  lastCell: string | null;
}

export type PublishDecision = { action: "clear" } | { action: "wait" } | { action: "publish"; newWalk: boolean };

/** The ~1 km grid cell, the same arithmetic the database stores (floor(lat*100), floor(lng*100)). */
export const cellOf = (p: Point): string => `${Math.floor(p.lat * 100)},${Math.floor(p.lng * 100)}`;

/** What to do on this tick. Pure: no clock, no network. */
export function decidePresence(input: PublishInput, state: PublishState): PublishDecision {
  if (
    !input.walking ||
    input.ghost ||
    input.audience === "off" ||
    !input.zoneAllowed ||
    (input.hiddenSinceMs !== null && input.nowMs - input.hiddenSinceMs > HIDDEN_CLEAR_MS)
  ) {
    return { action: "clear" };
  }
  if (!input.pageVisible || !input.position || !input.startPoint) return { action: "wait" };
  if (input.accuracyM !== null && input.accuracyM > MAX_ACCURACY_M) return { action: "wait" };
  // Home protection: nothing in the first 10 minutes, nor within 800 m of where the walk began.
  if (input.nowMs - input.startedAtMs < QUIET_START_MS) return { action: "wait" };
  if (haversineDistance(input.position, input.startPoint) < HOME_RADIUS_M) return { action: "wait" };
  if (!state.published || state.lastPublishAtMs === null) return { action: "publish", newWalk: true };
  const since = input.nowMs - state.lastPublishAtMs;
  if (since >= HEARTBEAT_MS) return { action: "publish", newWalk: false };
  if (cellOf(input.position) !== state.lastCell && since >= CELL_CHANGE_MIN_MS) return { action: "publish", newWalk: false };
  return { action: "wait" };
}

type Doer = typeof fetch;

/**
 * Drives the decision above with an injected clock and fetch. Nothing is sent when the presence flag is off.
 * The position goes only to our own route, which reduces it to a cell; it is never stored or logged.
 */
export class PresencePublisher {
  private state: PublishState = { published: false, lastPublishAtMs: null, lastCell: null };
  private inFlight = false;

  constructor(
    private readonly doFetch: Doer = (...a) => fetch(...a),
    private readonly now: () => number = () => Date.now(),
    private readonly enabled: () => boolean = presenceEnabled,
  ) {}

  /** Whether a position is currently shared (the HUD chip shows only then). */
  get sharing(): boolean {
    return this.state.published;
  }

  async tick(input: Omit<PublishInput, "nowMs">): Promise<PublishDecision> {
    if (!this.enabled()) return { action: "wait" };
    const full = { ...input, nowMs: this.now() };
    const decision = decidePresence(full, this.state);
    if (decision.action === "clear") {
      await this.clear();
    } else if (decision.action === "publish" && !this.inFlight && input.position) {
      this.inFlight = true;
      try {
        const res = await this.doFetch("/api/social/presence", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lat: input.position.lat, lng: input.position.lng, newWalk: decision.newWalk }),
        });
        const body = res.ok ? ((await res.json()) as { shared?: boolean }) : null;
        if (body?.shared) {
          this.state = { published: true, lastPublishAtMs: full.nowMs, lastCell: cellOf(input.position) };
        } else if (this.state.published) {
          this.state = { published: false, lastPublishAtMs: null, lastCell: null };
        }
      } catch {
        // Offline: the next tick tries again; the row expires by itself.
      } finally {
        this.inFlight = false;
      }
    }
    return decision;
  }

  /** End of walk, ghost, unmount: remove the row if one was published. */
  async clear(): Promise<void> {
    if (!this.enabled() || !this.state.published) return;
    this.state = { published: false, lastPublishAtMs: null, lastCell: null };
    try {
      await this.doFetch("/api/social/presence", { method: "DELETE" });
    } catch {
      // The row expires in 20 minutes at the latest.
    }
  }
}
