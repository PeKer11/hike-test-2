import type { AttractionCategory, Coordinates, NearbyPlace } from "@/lib/types";
import { relatePlace, type Relation } from "@/lib/walk/poi-relation";
import {
  ANNOUNCE_CATEGORY_COOLDOWN_MS,
  ANNOUNCE_EXPIRE_BEHIND_M,
  ANNOUNCE_EXPIRE_MS,
  ANNOUNCE_GLOBAL_GAP_MS,
  ANNOUNCE_MAX_ACTIVE,
  ANNOUNCE_MAX_DISTANCE_M,
  SCENERY_COOLDOWN_MS,
} from "@/lib/walk/walk-cadence";

/** Where a place is relative to the walker, when something better than a heading knows. */
export type FrameOf = (placeId: string) => { relation: Relation; distanceM: number } | null;

export interface CheckOptions {
  /**
   * The candidates were already vetted by `eligibleForCallout` (level budgets,
   * lateral limits, quiet zones): skip this class's own gap / cooldown /
   * distance rules and just take the first. The two-on-screen cap still holds.
   */
  trusted?: boolean;
  /** On route: relation from the route frame (cross-track), not from a heading. */
  frameOf?: FrameOf;
}

export interface Announcement {
  place: NearbyPlace;
  /** Where it is now — refreshed on every check while the callout is up. */
  relation: Relation;
  distanceM: number;
  /** Fix-clock time the callout first appeared. */
  announcedAt: number;
  isPlanStop: boolean;
}

function cooldownKey(place: NearbyPlace): string {
  return place.kind === "scenery" ? "scenery" : place.category;
}

function cooldownMs(place: NearbyPlace): number {
  return place.kind === "scenery" ? SCENERY_COOLDOWN_MS : ANNOUNCE_CATEGORY_COOLDOWN_MS;
}

/**
 * Decides which nearby place, if any, deserves a callout right now. Evaluated on
 * every fix against places already in memory — it makes no network call.
 *
 * Quiet by construction: at most one new callout per 90 s, at most two on screen,
 * each place once per walk (the memory survives re-plans), and a category is not
 * repeated for 10 minutes. Time is the fix clock, never `Date.now()`.
 */
export class PoiAnnouncer {
  private readonly announcedIds = new Set<string>();
  private readonly lastByCategory = new Map<string, number>();
  private lastAnnouncedAt = Number.NEGATIVE_INFINITY;
  private activeList: Announcement[] = [];

  constructor(private readonly preferredCategories: AttractionCategory[] = []) {}

  /**
   * Refreshes the on-screen callouts (dropping expired ones), maybe adds one, and
   * returns what should be showing. `planStopIds` are stops of the walk itself —
   * they rank first and are not held back by the category cooldown.
   */
  check(
    pos: Coordinates,
    headingDeg: number | null,
    routeDirDeg: number | null,
    places: NearbyPlace[],
    planStopIds: ReadonlySet<string>,
    now: number,
    options: CheckOptions = {},
  ): Announcement[] {
    const relate = (place: NearbyPlace) =>
      options.frameOf?.(place.id) ??
      relatePlace(pos, headingDeg, routeDirDeg, place.coordinates);

    // Refresh and expire what is already up.
    this.activeList = this.activeList.flatMap((a) => {
      const { relation, distanceM } = relate(a.place);
      const behindAndGone = relation === "behind" && distanceM > ANNOUNCE_EXPIRE_BEHIND_M;
      if (behindAndGone || now - a.announcedAt > ANNOUNCE_EXPIRE_MS) return [];
      return [{ ...a, relation, distanceM }];
    });

    if (this.activeList.length >= ANNOUNCE_MAX_ACTIVE) return this.activeList;
    if (!options.trusted && now - this.lastAnnouncedAt < ANNOUNCE_GLOBAL_GAP_MS) {
      return this.activeList;
    }

    const preferred = new Set(this.preferredCategories);
    const candidates: Array<{ place: NearbyPlace; relation: Relation; distanceM: number; isPlanStop: boolean }> = [];
    for (const place of places) {
      if (this.announcedIds.has(place.id)) continue;
      const { relation, distanceM } = relate(place);
      if (!options.trusted && (relation === "behind" || distanceM > ANNOUNCE_MAX_DISTANCE_M)) {
        continue;
      }
      const isPlanStop = planStopIds.has(place.id);
      if (!isPlanStop && !options.trusted) {
        const last = this.lastByCategory.get(cooldownKey(place));
        if (last !== undefined && now - last < cooldownMs(place)) continue;
      }
      candidates.push({ place, relation, distanceM, isPlanStop });
    }
    if (candidates.length === 0) return this.activeList;

    const notable = (p: NearbyPlace) => (p.tags.wikidata || p.tags.wikipedia ? 1 : 0);
    candidates.sort(
      (a, b) =>
        Number(b.isPlanStop) - Number(a.isPlanStop) ||
        Number(a.place.kind === "scenery") - Number(b.place.kind === "scenery") ||
        Number(preferred.has(b.place.category)) - Number(preferred.has(a.place.category)) ||
        notable(b.place) - notable(a.place) ||
        a.distanceM - b.distanceM,
    );

    const top = candidates[0];
    this.announcedIds.add(top.place.id);
    this.lastByCategory.set(cooldownKey(top.place), now);
    this.lastAnnouncedAt = now;
    this.activeList = [...this.activeList, { ...top, announcedAt: now }];
    return this.activeList;
  }

  /** The walker tapped "Not now" / dismissed it: it stays announced, just not shown. */
  dismiss(placeId: string): void {
    this.announcedIds.add(placeId);
    this.activeList = this.activeList.filter((a) => a.place.id !== placeId);
  }

  /** Time-only expiry for when no fix arrives (stalled GPS); returns what is still up. */
  expire(now: number): Announcement[] {
    this.activeList = this.activeList.filter((a) => now - a.announcedAt <= ANNOUNCE_EXPIRE_MS);
    return this.activeList;
  }

  active(): Announcement[] {
    return this.activeList;
  }

  /** New walk. (A re-plan must NOT call this: what was seen stays seen.) */
  reset(): void {
    this.announcedIds.clear();
    this.lastByCategory.clear();
    this.lastAnnouncedAt = Number.NEGATIVE_INFINITY;
    this.activeList = [];
  }
}
