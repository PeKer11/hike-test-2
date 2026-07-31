import { NextResponse } from "next/server";

import { fetchAttractions } from "@/lib/attractions/overpass-client";
import {
  rankAttractions,
  selectFeasibleAttractions,
} from "@/lib/attractions/attraction-ranker";
import { getDirections } from "@/lib/api/ors-client";
import { buildWalkPlan } from "@/lib/optimization/tsp-planner";
import {
  getDownvotedCategories,
  getPreferredCategories,
} from "@/lib/preferences/preference-store";
import { createClient } from "@/lib/supabase/server";
import { haversineDistance, toOrsCoord } from "@/lib/utils/geo";
import { decodePolyline } from "@/lib/utils/polyline";
import type {
  Attraction,
  AttractionCategory,
  Coordinates,
  WalkPlanRequest,
} from "@/lib/types";

interface WalkPlanApiRequest {
  lat: number;
  lng: number;
  availableMinutes: number;
  walkingPaceMinPerKm?: number;
  radiusMeters?: number;
  preferredCategories?: AttractionCategory[];
  // Set by the automatic pace-triggered rebuild: re-time the walk the user is
  // already on instead of discovering a whole new set of POIs.
  explicitAttractions?: Attraction[];
  pinnedAttractionIds?: string[];
  // Set by the "Name your own stops" flow: the named places are a starting point,
  // not the whole walk — top up the leftover time with discovered POIs. Off by
  // default so the pace-triggered rebuild keeps meaning "only these".
  fillRemainingTime?: boolean;
}

// A discovered POI this close to a named place is the same place under another
// OSM id — keep it out of the filler so the stop isn't listed twice.
const DUPLICATE_RADIUS_METERS = 50;

// Below this much of the budget spent, the named places leave enough room that
// discovering filler is worth an Overpass call.
const FILL_THRESHOLD = 0.9;

interface ProfileCategories {
  preferredCategories: AttractionCategory[] | undefined;
  downvotedCategories: AttractionCategory[] | undefined;
}

/**
 * What the walker has told us over time, folded into what they ticked for this
 * particular walk. The likes are a union, not a fallback: the "Interests" boxes
 * say what they are in the mood for today, the profile says who they are, and
 * neither is allowed to silently erase the other. The dislikes only ever come
 * from the profile — there is no "not this" box on the form.
 *
 * Both reads share the one session lookup, and both are best effort. Runs only
 * when we are about to rank discovered POIs, so a pace-triggered rebuild of a
 * walk already in progress still costs no Supabase round trip. Signed out,
 * unconfigured, or a failed read all mean "nothing standing on file" — never a
 * failed walk plan.
 */
async function withProfilePreferences(
  fromBody: AttractionCategory[] | undefined,
): Promise<ProfileCategories> {
  const body = Array.isArray(fromBody) ? fromBody : [];
  let preferred: AttractionCategory[] = [];
  let downvoted: AttractionCategory[] = [];

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      // Caught per read, not just by the outer try: one of the two blowing up
      // must not throw away what the other already found.
      [preferred, downvoted] = await Promise.all([
        getPreferredCategories(supabase, user.id).catch(() => []),
        getDownvotedCategories(supabase, user.id).catch(() => []),
      ]);
    }
  } catch {
    // Supabase not configured, no session, or a failed read — body only.
  }

  const merged = Array.from(new Set([...body, ...preferred]));
  return {
    preferredCategories: merged.length > 0 ? merged : undefined,
    downvotedCategories: downvoted.length > 0 ? downvoted : undefined,
  };
}

// Same heuristic `selectFeasibleAttractions` uses: walk from the origin to each
// stop plus its visit time. Rough on purpose — the planner does the real math.
function estimateMinutes(
  origin: Coordinates,
  attractions: Attraction[],
  walkingPaceMinPerKm: number,
): number {
  return attractions.reduce(
    (sum, a) =>
      sum +
      (haversineDistance(origin, a.coordinates) / 1000) * walkingPaceMinPerKm +
      a.avgVisitMinutes,
    0,
  );
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as WalkPlanApiRequest;

    const { lat, lng, availableMinutes } = body;

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180 ||
      !Number.isFinite(availableMinutes) ||
      availableMinutes <= 0
    ) {
      return NextResponse.json(
        { error: "lat, lng, and availableMinutes (> 0) are required." },
        { status: 400 },
      );
    }

    const origin = { lat, lng };
    const requestedPace = body.walkingPaceMinPerKm ?? 15;
    const walkingPaceMinPerKm =
      Number.isFinite(requestedPace) && requestedPace > 0 ? requestedPace : 15;
    // Clamp the Overpass search radius — an unbounded value from the client
    // turns into an enormous query against a shared public API.
    const requestedRadius = body.radiusMeters ?? 2000;
    const radiusMeters = Number.isFinite(requestedRadius)
      ? Math.min(Math.max(requestedRadius, 100), 10_000)
      : 2000;

    const explicitAttractions = Array.isArray(body.explicitAttractions)
      ? body.explicitAttractions
      : undefined;

    // 1 + 2. Fetch raw attractions from Overpass, then rank and pre-filter by
    // time budget — skipped entirely when the caller already knows which
    // attractions the walk must keep.
    let selected: Attraction[];
    let pinnedAttractionIds = body.pinnedAttractionIds;
    // Topped up from the profile only on the branches that actually rank.
    let preferredCategories = body.preferredCategories;
    let downvotedCategories: AttractionCategory[] | undefined;
    if (explicitAttractions && explicitAttractions.length > 0) {
      selected = explicitAttractions;

      const explicitMinutes = estimateMinutes(
        origin,
        explicitAttractions,
        walkingPaceMinPerKm,
      );

      // The named places barely dent the budget — fill the rest the same way an
      // open-mode walk is built, but never at the cost of a place the user named.
      if (
        body.fillRemainingTime === true &&
        explicitMinutes < availableMinutes * FILL_THRESHOLD
      ) {
        const raw = await fetchAttractions(origin, radiusMeters);
        ({ preferredCategories, downvotedCategories } =
          await withProfilePreferences(body.preferredCategories));

        const ranked = rankAttractions(raw, {
          origin,
          preferredCategories,
          downvotedCategories,
          availableMinutes,
          walkingPaceMinPerKm,
          allowExploration: true,
        });

        const explicitIds = new Set(explicitAttractions.map((a) => a.id));
        const filler = ranked.filter(
          (candidate) =>
            !explicitIds.has(candidate.id) &&
            !explicitAttractions.some(
              (e) =>
                haversineDistance(e.coordinates, candidate.coordinates) <=
                DUPLICATE_RADIUS_METERS,
            ),
        );

        const feasible = selectFeasibleAttractions(
          [...explicitAttractions, ...filler],
          availableMinutes,
          walkingPaceMinPerKm,
        ).selected;

        // Every named place stays in, whatever the pre-filter decided; only the
        // filler is allowed to be trimmed here (and later by the planner).
        selected = [
          ...explicitAttractions,
          ...feasible.filter((a) => !explicitIds.has(a.id)),
        ];
        pinnedAttractionIds = Array.from(
          new Set([...(body.pinnedAttractionIds ?? []), ...explicitIds]),
        );
      }
    } else {
      const raw = await fetchAttractions(origin, radiusMeters);
      ({ preferredCategories, downvotedCategories } =
        await withProfilePreferences(body.preferredCategories));

      const ranked = rankAttractions(raw, {
        origin,
        preferredCategories,
        downvotedCategories,
        availableMinutes,
        walkingPaceMinPerKm,
        allowExploration: true,
      });

      selected = selectFeasibleAttractions(
        ranked,
        availableMinutes,
        walkingPaceMinPerKm,
      ).selected;
    }

    // 3. Build walk plan with TSP ordering
    const planRequest: WalkPlanRequest = {
      origin,
      availableMinutes,
      walkingPaceMinPerKm,
      radiusMeters,
      preferredCategories,
      explicitAttractions,
      pinnedAttractionIds,
    };

    const plan = buildWalkPlan(planRequest, selected);

    // 4. Fetch ORS geometry for the ordered route (origin → attraction 1 → 2 → ...)
    let geometry: Coordinates[] | undefined;
    const warnings: string[] = [];

    if (plan.orderedAttractions.length > 0) {
      if (!process.env.ORS_API_KEY) {
        warnings.push(
          "No ORS_API_KEY configured — route geometry is unavailable. Start Walk is disabled until geometry is present.",
        );
      } else {
        try {
          const waypoints: Coordinates[] = [
            origin,
            ...plan.orderedAttractions.map((a) => a.coordinates),
          ];
          const orsRes = await getDirections({
            coordinates: waypoints.map(toOrsCoord),
            profile: "foot-walking",
            instructions: false,
          });
          const encoded = orsRes.routes[0]?.geometry;
          if (encoded) {
            geometry = decodePolyline(encoded);
          }
        } catch {
          // Geometry is optional — don't fail the whole plan if ORS is unavailable
          warnings.push(
            "Could not fetch route geometry from ORS. Start Walk is disabled.",
          );
        }
      }
    }

    return NextResponse.json({ ...plan, geometry, warnings });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to build walk plan.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
