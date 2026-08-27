import { NextResponse } from "next/server";

import { fetchAttractions } from "@/lib/attractions/overpass-client";
import {
  MAX_WALK_STOPS,
  rankAttractions,
  selectFeasibleAttractions,
} from "@/lib/attractions/attraction-ranker";
import { getDirections } from "@/lib/api/ors-client";
import { buildWalkPlan } from "@/lib/optimization/tsp-planner";
import {
  getDownvotedCategories,
  getDownvotedPoiKeys,
  getPreferredCategoryWeights,
  getTrendingCategoryCounts,
  getUpvotedCategories,
  recordWalkSession,
} from "@/lib/preferences/preference-store";
import { createClient } from "@/lib/supabase/server";
import { haversineDistance, toOrsCoord } from "@/lib/utils/geo";
import { decodePolyline } from "@/lib/utils/polyline";
import type {
  Attraction,
  AttractionCategory,
  Coordinates,
  WalkPlan,
  WalkPlanRequest,
} from "@/lib/types";

interface WalkPlanApiRequest {
  lat: number;
  lng: number;
  availableMinutes: number;
  walkingPaceMinPerKm?: number;
  radiusMeters?: number;
  // Optional "don't strand me far from the start" constraint. Nothing to do
  // with `radiusMeters`, which only bounds where candidates are searched for.
  maxEndDistanceFromOriginMeters?: number;
  // Where that constraint is measured from when it is not `lat`/`lng` — set by
  // a mid-walk rebuild, whose origin is the walker's current position while the
  // place they want to finish near has not moved.
  endAnchor?: Coordinates;
  preferredCategories?: AttractionCategory[];
  // Set by the automatic pace-triggered rebuild: re-time the walk the user is
  // already on instead of discovering a whole new set of POIs.
  explicitAttractions?: Attraction[];
  pinnedAttractionIds?: string[];
  /**
   * How many stops the walker asked for in words ("bring me 3 famous places").
   * Caps the discovery selection on top of the time budget, never instead of
   * it: three stops that do not fit in the time available are still three stops
   * too many.
   */
  stopCount?: number;
  /** The walker asked for famous places — see `RankerOptions.notableOnly`. */
  notableOnly?: boolean;
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
  /** What the walker ticked for THIS walk. Flat boost, never explored away from. */
  preferredCategories: AttractionCategory[] | undefined;
  /** Standing tastes with their decayed weight — see `activeCategoryWeights`. */
  preferredCategoryWeights: Map<AttractionCategory, number> | undefined;
  /** Each downvoted category with how many times it has been voted down. */
  downvotedCategories: Map<AttractionCategory, number> | undefined;
  /** Each upvoted category with how many times it has been voted up. */
  upvotedCategories: Map<AttractionCategory, number> | undefined;
  /**
   * What every other walker has voted up — read only for a walker with no
   * personal signal of any kind, and undefined for everyone else.
   */
  trendingCategories: Map<AttractionCategory, number> | undefined;
  /** `poi_key` identities of specific places voted down, excluded outright. */
  downvotedPoiKeys: Set<string> | undefined;
  /**
   * The signed-in walker, or null. Carried out of here rather than looked up a
   * second time because this is the only place on the request that pays for a
   * session lookup, and the session counter needs to know whether there is
   * anybody to count the walk for.
   */
  userId: string | null;
}

/**
 * What the walker has told us over time, alongside what they ticked for this
 * particular walk. The "Interests" boxes say what they are in the mood for
 * today, the profile says who they are, and neither is allowed to silently
 * erase the other. They used to be unioned into one flat array; they are kept
 * apart since 2026-08-23 because they are no longer the same kind of value —
 * today's tick is worth a flat `PREFERRED_CATEGORY_BOOST`, while a standing
 * taste is worth whatever it has decayed to. The ranker takes the larger of the
 * two, which is exactly what the union produced back when both were flat.
 *
 * The standing up- and downvotes only ever come from the profile — the form has
 * no "not this" box, and no way to say a category has worked out well before.
 *
 * The fourth read is not about categories at all: `getDownvotedPoiKeys` names
 * specific places the walker rejected, which the ranker drops outright instead
 * of scoring down. It rides along here because it needs the same session.
 *
 * All four reads share the one session lookup, and each is best effort. Runs only
 * when we are about to rank discovered POIs, so a pace-triggered rebuild of a
 * walk already in progress still costs no Supabase round trip. Signed out,
 * unconfigured, or a failed read all mean "nothing standing on file" — never a
 * failed walk plan.
 */
async function withProfilePreferences(
  fromBody: AttractionCategory[] | undefined,
): Promise<ProfileCategories> {
  const body = Array.isArray(fromBody) ? fromBody : [];
  let userId: string | null = null;
  let weights: Map<AttractionCategory, number> = new Map();
  let downvoted: Map<AttractionCategory, number> = new Map();
  let upvoted: Map<AttractionCategory, number> = new Map();
  let trending: Map<AttractionCategory, number> = new Map();
  let downvotedPois: Set<string> = new Set();

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      userId = user.id;
      // Caught per read, not just by the outer try: one of the four blowing up
      // must not throw away what the others already found.
      [weights, downvoted, upvoted, downvotedPois] = await Promise.all([
        getPreferredCategoryWeights(supabase, user.id).catch(
          () => new Map<AttractionCategory, number>(),
        ),
        getDownvotedCategories(supabase, user.id).catch(
          () => new Map<AttractionCategory, number>(),
        ),
        getUpvotedCategories(supabase, user.id).catch(
          () => new Map<AttractionCategory, number>(),
        ),
        getDownvotedPoiKeys(supabase, user.id).catch(() => new Set<string>()),
      ]);

      // A fifth read, and only for a walker we know nothing about: no category
      // ticked for this walk, no standing taste still counting, and no category
      // ever tapped up or down. Sequential rather than in the Promise.all above
      // because the condition is the whole point — a walker with any signal at
      // all must never pay a round trip for a guess that would then be ignored.
      //
      // A stated DISLIKE counts as signal: it is a key in the weight map with a
      // negative value, and "no shopping streets" is something the walker told
      // us. A DECAYED taste does not, because it is absent from the map
      // entirely — which is the second of the two cases the TODO named. A walker
      // whose every preference has faded is unknown again, and gets the
      // cold-start signal again, on the same threshold the ranker and the
      // exploration slot already use.
      //
      // `downvotedPois` is deliberately not in the condition. It names places,
      // not kinds of place, and leaves the category question as open as it was.
      if (
        body.length === 0 &&
        weights.size === 0 &&
        downvoted.size === 0 &&
        upvoted.size === 0
      ) {
        trending = await getTrendingCategoryCounts(supabase).catch(
          () => new Map<AttractionCategory, number>(),
        );
      }
    }
  } catch {
    // Supabase not configured, no session, or a failed read — body only.
  }

  return {
    userId,
    preferredCategories: body.length > 0 ? body : undefined,
    preferredCategoryWeights: weights.size > 0 ? weights : undefined,
    downvotedCategories: downvoted.size > 0 ? downvoted : undefined,
    upvotedCategories: upvoted.size > 0 ? upvoted : undefined,
    trendingCategories: trending.size > 0 ? trending : undefined,
    downvotedPoiKeys: downvotedPois.size > 0 ? downvotedPois : undefined,
  };
}

/**
 * How many times a single request may build a plan, the first pass included.
 *
 * Bounded rather than "loop until good enough" because every attempt is one
 * Overpass call and one ORS matrix call against shared, rate-limited public
 * APIs — an unbounded loop on a request nobody can satisfy (a 20-minute budget
 * in an empty suburb) would burn the daily quota for every other walker. Three
 * is the smallest number that lets the ladder below actually finish: one pass on
 * what the walker asked for, one on a wider search, one with the end-distance
 * constraint out of the way.
 */
const MAX_PLAN_ATTEMPTS = 3;

/**
 * Below this share of the requested time actually spent walking and visiting,
 * a plan counts as a failed attempt worth retrying. Someone who asked for 90
 * minutes and got a 30-minute walk did not get what they asked for, even though
 * nothing about that plan is infeasible.
 *
 * Half, not something stricter: the budget is an upper bound the walker chose,
 * and a genuinely quiet area will never fill it however wide the search goes.
 * The point is to catch the plan that collapsed, not to chase the last minute.
 */
const MIN_TIME_COVERAGE = 0.5;

/** What a single plan attempt is allowed to vary. */
interface PlanAttemptParams {
  radiusMeters: number;
  maxEndDistanceFromOriginMeters: number | undefined;
}

/**
 * The retry ladder, loosest-last. Index 0 is the walker's own request, so the
 * common case — a good first plan — never pays for any of this.
 *
 * Order is deliberate. Widening the search area first only adds candidates and
 * changes nothing the walker explicitly asked for, so it is the cheap fix for
 * the usual cause of a collapsed plan (too few POIs nearby). Dropping
 * `maxEndDistanceFromOriginMeters` comes last because it overrides a constraint
 * the walker typed in, and it is the only remaining lever when the candidates
 * exist but the planner keeps dropping them for finishing too far out. When a
 * relaxed attempt is the one that wins, the response says so in `warnings` —
 * quietly ignoring "finish near my car" is not something to do silently.
 */
const RELAXATIONS: ReadonlyArray<{
  describe: (params: PlanAttemptParams) => string;
  apply: (base: PlanAttemptParams) => PlanAttemptParams;
}> = [
  {
    describe: (p) =>
      `searched a wider ${Math.round(p.radiusMeters)} m area than requested`,
    apply: (base) => ({
      ...base,
      // Same 10 km ceiling the request validation applies — a relaxation must
      // not be able to produce a query the clamp would have rejected.
      radiusMeters: Math.min(base.radiusMeters * 2, 10_000),
    }),
  },
  {
    describe: (p) =>
      `searched a wider ${Math.round(p.radiusMeters)} m area and ignored the "finish near the start" limit`,
    apply: (base) => ({
      radiusMeters: Math.min(base.radiusMeters * 2, 10_000),
      maxEndDistanceFromOriginMeters: undefined,
    }),
  },
];

function sameParams(a: PlanAttemptParams, b: PlanAttemptParams): boolean {
  return (
    a.radiusMeters === b.radiusMeters &&
    a.maxEndDistanceFromOriginMeters === b.maxEndDistanceFromOriginMeters
  );
}

/**
 * How well a finished plan answers the request, in [0, 1], so attempts can be
 * compared and the best one returned rather than the last one — a retry that
 * comes back worse must not be able to overwrite a decent first plan.
 *
 * Built only from numbers the plan already reports: how much of the budget it
 * fills, and whether the planner called it feasible. An infeasible plan is
 * halved rather than zeroed because it is still a walk — it just overruns —
 * and one real walk beats an empty result.
 */
function planQuality(plan: WalkPlan, availableMinutes: number): number {
  if (plan.orderedAttractions.length === 0) return 0;
  const coverage = Math.min(plan.totalMinutes / availableMinutes, 1);
  return plan.feasible ? coverage : coverage * 0.5;
}

/** Whether a plan is good enough to stop retrying on. */
function isGoodEnough(plan: WalkPlan, availableMinutes: number): boolean {
  return (
    plan.feasible &&
    plan.orderedAttractions.length > 0 &&
    plan.totalMinutes >= availableMinutes * MIN_TIME_COVERAGE
  );
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

    // Blank in the form means "no constraint", so anything that is not a
    // usable positive number is treated as absent rather than as zero — a zero
    // limit would silently empty every walk.
    const requestedEndDistance = body.maxEndDistanceFromOriginMeters;
    const maxEndDistanceFromOriginMeters =
      typeof requestedEndDistance === "number" &&
      Number.isFinite(requestedEndDistance) &&
      requestedEndDistance > 0
        ? Math.min(requestedEndDistance, 50_000)
        : undefined;

    // Same "not a usable number means absent" rule as everything else here: a
    // half-parsed anchor would silently move the constraint somewhere nobody
    // asked for, where falling back to the origin is at least the old behaviour.
    const requestedAnchor = body.endAnchor;
    const endAnchor =
      requestedAnchor &&
      Number.isFinite(requestedAnchor.lat) &&
      Number.isFinite(requestedAnchor.lng)
        ? { lat: requestedAnchor.lat, lng: requestedAnchor.lng }
        : undefined;

    const explicitAttractions = Array.isArray(body.explicitAttractions)
      ? body.explicitAttractions
      : undefined;

    // Same "absent unless it is a usable number" rule as every other optional
    // field here, clamped to the planner's own stop ceiling so a client cannot
    // ask for more stops than a walk holds.
    const requestedStopCount = body.stopCount;
    const stopCount =
      typeof requestedStopCount === "number" &&
      Number.isFinite(requestedStopCount) &&
      requestedStopCount >= 1
        ? Math.min(Math.round(requestedStopCount), MAX_WALK_STOPS)
        : undefined;

    const notableOnly = body.notableOnly === true;

    // Raw Overpass results keyed by the radius they were fetched at, so a retry
    // that only loosens the end-distance constraint costs no second POI fetch.
    const rawByRadius = new Map<number, Attraction[]>();
    const fetchRaw = async (radius: number): Promise<Attraction[]> => {
      const cached = rawByRadius.get(radius);
      if (cached) return cached;
      const fetched = await fetchAttractions(origin, radius);
      rawByRadius.set(radius, fetched);
      return fetched;
    };

    // The profile describes the walker, not the attempt — read once and reused,
    // so retrying never multiplies the Supabase round trips.
    let profilePromise: Promise<ProfileCategories> | undefined;
    const profilePreferences = (): Promise<ProfileCategories> => {
      profilePromise ??= withProfilePreferences(body.preferredCategories);
      return profilePromise;
    };

    /**
     * One full pass: discover, rank, pre-filter, order. Everything that varies
     * between retries arrives in `params`; everything else is fixed by the
     * request.
     */
    const attemptPlan = async (
      params: PlanAttemptParams,
    ): Promise<{ plan: WalkPlan; planRequest: WalkPlanRequest }> => {
      // 1 + 2. Fetch raw attractions from Overpass, then rank and pre-filter by
      // time budget — skipped entirely when the caller already knows which
      // attractions the walk must keep.
      let selected: Attraction[];
      let pinnedAttractionIds = body.pinnedAttractionIds;
      // Topped up from the profile only on the branches that actually rank.
      let preferredCategories = body.preferredCategories;
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
          const raw = await fetchRaw(params.radiusMeters);
          const profile = await profilePreferences();
          preferredCategories = profile.preferredCategories;

          const ranked = rankAttractions(raw, {
            origin,
            preferredCategories,
            preferredCategoryWeights: profile.preferredCategoryWeights,
            downvotedCategories: profile.downvotedCategories,
            upvotedCategories: profile.upvotedCategories,
            trendingCategories: profile.trendingCategories,
            downvotedPoiKeys: profile.downvotedPoiKeys,
            availableMinutes,
            walkingPaceMinPerKm,
            allowExploration: true,
            notableOnly,
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

          // The named places are charged to the budget up front and the filler
          // only gets what they leave behind, rather than the two competing in one
          // pre-filter pass. They cannot compete fairly: `selectFeasibleAttractions`
          // re-sorts what is left after every acceptance on the ranker's score, and
          // a named place has never been through the ranker — it scores 0 and sinks
          // below every discovered candidate, so the filler would spend the whole
          // budget and the named stops (re-added unconditionally below either way)
          // would land on top of it.
          const fillerBudget = Math.max(0, availableMinutes - explicitMinutes);
          // A stated count is a count of the whole walk, so the named stops
          // come off it before the filler gets a ceiling.
          const stopCeiling = stopCount ?? MAX_WALK_STOPS;
          const feasible = selectFeasibleAttractions(
            filler,
            fillerBudget,
            walkingPaceMinPerKm,
            Math.max(0, stopCeiling - explicitAttractions.length),
          ).selected;

          // Every named place stays in, whatever the pre-filter decided; only the
          // filler is allowed to be trimmed here (and later by the planner).
          selected = [...explicitAttractions, ...feasible];
          pinnedAttractionIds = Array.from(
            new Set([...(body.pinnedAttractionIds ?? []), ...explicitIds]),
          );
        }
      } else {
        const raw = await fetchRaw(params.radiusMeters);
        const profile = await profilePreferences();
        preferredCategories = profile.preferredCategories;

        const ranked = rankAttractions(raw, {
          origin,
          preferredCategories,
          preferredCategoryWeights: profile.preferredCategoryWeights,
          downvotedCategories: profile.downvotedCategories,
          upvotedCategories: profile.upvotedCategories,
          trendingCategories: profile.trendingCategories,
          downvotedPoiKeys: profile.downvotedPoiKeys,
          availableMinutes,
          walkingPaceMinPerKm,
          allowExploration: true,
          notableOnly,
        });

        selected = selectFeasibleAttractions(
          ranked,
          availableMinutes,
          walkingPaceMinPerKm,
          // On top of the time budget, not instead of it: three stops that do
          // not fit in the time available are still three stops too many.
          stopCount ?? MAX_WALK_STOPS,
        ).selected;
      }

      // 3. Build walk plan with TSP ordering
      const planRequest: WalkPlanRequest = {
        origin,
        availableMinutes,
        walkingPaceMinPerKm,
        radiusMeters: params.radiusMeters,
        maxEndDistanceFromOriginMeters: params.maxEndDistanceFromOriginMeters,
        endAnchor,
        preferredCategories,
        explicitAttractions,
        pinnedAttractionIds,
      };

      return { plan: await buildWalkPlan(planRequest, selected), planRequest };
    };

    const baseParams: PlanAttemptParams = {
      radiusMeters,
      maxEndDistanceFromOriginMeters,
    };

    // A pace-triggered rebuild ("re-time exactly these stops") is the one mode
    // with nothing to relax: no POIs are discovered, so a wider radius changes
    // nothing, and dropping the end-distance limit there would override a
    // constraint on a walk the user is already partway through. Single pass.
    const canRetry = !(
      explicitAttractions &&
      explicitAttractions.length > 0 &&
      body.fillRemainingTime !== true
    );

    const warnings: string[] = [];

    const hasExplicit = Boolean(
      explicitAttractions && explicitAttractions.length > 0,
    );

    /**
     * An unsatisfactory plan is only worth retrying if a relaxation could
     * plausibly fix it. The exception is a plan built around places the walker
     * named that came back infeasible: it overruns because of *their* stops,
     * which are never dropped, and every relaxation here only offers the filler
     * more candidates — widening the search cannot shorten an overrun the named
     * places caused, it can only lengthen it.
     */
    const worthRetrying = (plan: WalkPlan): boolean =>
      !isGoodEnough(plan, availableMinutes) && !(hasExplicit && !plan.feasible);

    let best = await attemptPlan(baseParams);
    let bestQuality = planQuality(best.plan, availableMinutes);
    let bestParams = baseParams;
    let attempts = 1;

    if (canRetry && worthRetrying(best.plan)) {
      for (const relaxation of RELAXATIONS) {
        if (attempts >= MAX_PLAN_ATTEMPTS) break;
        const params = relaxation.apply(baseParams);
        // Nothing left to loosen — the radius is already at the clamp and there
        // was no end-distance constraint to drop. Another identical attempt
        // would spend an Overpass call to get the same answer back.
        if (sameParams(params, bestParams) || sameParams(params, baseParams)) {
          continue;
        }

        attempts += 1;
        const candidate = await attemptPlan(params);
        const quality = planQuality(candidate.plan, availableMinutes);
        // Strictly better, so a retry that ties keeps the walker's own settings.
        if (quality > bestQuality) {
          best = candidate;
          bestQuality = quality;
          bestParams = params;
        }
        if (isGoodEnough(candidate.plan, availableMinutes)) break;
      }

      if (!sameParams(bestParams, baseParams)) {
        const relaxation = RELAXATIONS.find((r) =>
          sameParams(r.apply(baseParams), bestParams),
        );
        warnings.push(
          `No good walk fit your original settings, so this one ${relaxation?.describe(bestParams) ?? "used relaxed settings"}.`,
        );
      }
    }

    const plan = best.plan;

    // 4. Fetch ORS geometry for the ordered route (origin → attraction 1 → 2 → ...)
    let geometry: Coordinates[] | undefined;

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

    // 5. Count this as one of the walker's sessions — the clock every stored
    // category preference decays on (`categoryPreferenceWeight`).
    //
    // Here, and not on every POST, because `profilePromise` is only created on
    // the branches that actually discover and rank POIs. The pace-triggered
    // rebuild re-times a walk the walker is already on, arriving with
    // `explicitAttractions` and no ranking, and it can fire several times during
    // one walk — counting those would burn a walker's whole decay budget on a
    // single afternoon, which is the opposite of what a usage clock is for.
    //
    // After the plan is built, so a request that failed to produce one does not
    // age anything, and awaited rather than left dangling because a serverless
    // invocation ends at the response. Best effort: an uncounted session costs
    // one step of decay, and nothing about that is worth a failed walk.
    if (profilePromise) {
      const { userId } = await profilePromise;
      if (userId) {
        try {
          await recordWalkSession(await createClient());
        } catch {
          // Never let counting a walk cost the walk.
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
