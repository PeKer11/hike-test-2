import type {
  CalculatedRoute,
  Coordinates,
  TrailBriefingItem,
  TrailBriefingLevel,
  TrailBriefingSourceNote,
  TrailIntelligenceInput,
  TrailIntelligenceReport,
} from "@/lib/types";
import { haversineDistance } from "@/lib/utils/geo";
import { formatDuration } from "@/lib/utils/time";

const SUMMER_MONTHS = new Set([5, 6, 7, 8, 9]);
const WINTER_MONTHS = new Set([11, 0, 1]);

function averageCoordinate(points: Coordinates[]): Coordinates | null {
  if (points.length === 0) {
    return null;
  }

  const total = points.reduce(
    (acc, point) => ({
      lat: acc.lat + point.lat,
      lng: acc.lng + point.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / points.length,
    lng: total.lng / points.length,
  };
}

function inferRegionLabel(center: Coordinates | null): string {
  if (!center) {
    return "Unknown region";
  }

  if (center.lat > 32.7) {
    return "Northern Israel";
  }

  if (center.lat > 31.6 && center.lng > 35.05) {
    return "Jerusalem hills";
  }

  if (center.lat < 31.2) {
    return "Southern Israel";
  }

  if (center.lng < 34.95) {
    return "Coastal and lowland region";
  }

  return "Central Israel";
}

function inferTerrain(route: CalculatedRoute, regionLabel: string): string {
  if (route.source === "rtg") {
    return "trail-guided hiking route with likely off-road or park access sections";
  }

  if (regionLabel === "Jerusalem hills") {
    return "mixed urban-edge and hillside walking terrain";
  }

  if (regionLabel === "Northern Israel") {
    return "rolling and potentially steeper terrain";
  }

  return "mixed walking terrain with road or path connections";
}

function estimateExposureLevel(route: CalculatedRoute): TrailBriefingLevel {
  if (route.totalDistanceMeters >= 18_000 || route.totalDurationSeconds >= 5 * 3600) {
    return "no-go";
  }

  if (route.totalDistanceMeters >= 10_000 || route.totalDurationSeconds >= 3 * 3600) {
    return "caution";
  }

  return "go";
}

function buildRouteSummary(
  route: CalculatedRoute,
  regionLabel: string,
): TrailBriefingItem {
  const terrain = inferTerrain(route, regionLabel);
  const routeType =
    route.source === "rtg"
      ? route.sourceLabel?.toLowerCase().includes("curated")
        ? "RTG-guided route using curated RTG-style trail data with ORS path generation"
        : "RTG-guided route using RTG trail references with ORS path generation"
      : "fallback route generated from the current waypoint plan";

  return {
    title: "Trail description",
    summary: `${routeType} in ${regionLabel}. Expect ${terrain}.`,
    details: [
      `${route.orderedWaypoints.length} stops across ${route.segments.length} route segment(s).`,
      `Estimated moving time: ${formatDuration(route.totalDurationSeconds)}.`,
      route.warnings.length > 0
        ? "Existing routing warnings should be reviewed before departure."
        : "No route-generation warnings are currently attached to this path.",
    ],
    sourceStatus: "heuristic",
  };
}

function buildBestTime(
  route: CalculatedRoute,
  now: Date,
): TrailBriefingItem {
  const hour = now.getHours();
  const month = now.getMonth();
  const inSummer = SUMMER_MONTHS.has(month);
  const inWinter = WINTER_MONTHS.has(month);
  const longRoute = route.totalDurationSeconds >= 3 * 3600;
  const details: string[] = [];
  let summary = "Early morning is the safest default start window for this route.";
  let level: TrailBriefingLevel = "go";

  if (inSummer) {
    summary =
      "Start early or near sunset. Midday heat can turn this route from manageable to unsafe.";
    details.push("Avoid starting between 11:00 and 16:00 in warm months.");
    if (hour >= 11 && hour <= 16 && longRoute) {
      level = "no-go";
    } else if (hour >= 10 && hour <= 17) {
      level = "caution";
    }
  } else if (inWinter) {
    summary =
      "Aim for daylight hours and allow margin before sunset, especially on longer routes.";
    details.push("Short daylight windows increase risk of finishing in the dark.");
    if (hour >= 15 && longRoute) {
      level = "caution";
    }
  } else {
    details.push("Morning starts usually provide the best temperature and daylight margin.");
  }

  details.push(
    route.totalDurationSeconds >= 4 * 3600
      ? "This is a longer outing, so start earlier than you think you need."
      : "This route is short enough that a flexible start time is possible if conditions stay mild.",
  );

  return {
    title: "Best time recommendation",
    summary,
    details,
    level,
    sourceStatus: "heuristic",
  };
}

function buildCurrentConditions(
  route: CalculatedRoute,
  now: Date,
): TrailBriefingItem {
  const hour = now.getHours();
  const month = now.getMonth();
  const details: string[] = [];
  let summary = "No live weather feed is configured, so this is a route-based field estimate.";
  let level: TrailBriefingLevel = "caution";

  if (SUMMER_MONTHS.has(month)) {
    details.push("Warm-season assumption: heat exposure is the main risk driver.");
    if (hour >= 11 && hour <= 16) {
      summary = "Likely hot part of the day for hiking in Israel. Conditions are probably unfavorable.";
      level = route.totalDurationSeconds >= 2 * 3600 ? "no-go" : "caution";
    } else {
      summary = "Likely manageable if you start soon, hydrate well, and keep daylight margin.";
      level = "caution";
    }
  } else if (WINTER_MONTHS.has(month)) {
    details.push("Cool-season assumption: daylight and wet footing are the main risk drivers.");
    summary = hour >= 16
      ? "Late-day winter conditions can become unfavorable quickly."
      : "Conditions may be reasonable, but check actual rain and ground conditions before departure.";
    level = hour >= 16 ? "caution" : "go";
  } else {
    details.push("Transitional-season assumption: moderate weather but still check local conditions.");
    summary = "Conditions may be suitable, but this is still a heuristic estimate.";
    level = "go";
  }

  if (route.warnings.length > 0) {
    details.push("Routing warnings exist, which lowers confidence in the overall route quality.");
    if (level === "go") {
      level = "caution";
    }
  }

  return {
    title: "Current conditions",
    summary,
    details,
    level,
    sourceStatus: "heuristic",
  };
}

function routeSpreadMeters(route: CalculatedRoute): number {
  if (route.geometry.length < 2) {
    return 0;
  }

  const start = route.geometry[0];
  const end = route.geometry[route.geometry.length - 1];
  return haversineDistance(start, end);
}

function buildSafety(route: CalculatedRoute): TrailBriefingItem {
  const details: string[] = [];
  let level = estimateExposureLevel(route);
  let summary =
    "No live official alert feed is configured. Safety recommendation is based on route length, duration, and routing quality.";

  if (route.source === "rtg") {
    details.push(
      "This route is guided by RTG trail points, but the displayed path is generated by ORS and may diverge from the marked trail.",
    );
    if (level === "go") {
      level = "caution";
    }
  }

  if (route.warnings.length > 0) {
    details.push("Routing warnings are present. Treat the path as needing manual verification.");
    level = "caution";
  }

  const spread = routeSpreadMeters(route);
  details.push(
    spread >= 8_000
      ? "The route covers a broad area, so bail-out logistics may be more complex."
      : "The route footprint is relatively compact, which can make retreat simpler if conditions change.",
  );

  if (level === "no-go") {
    summary = "This route is currently high-risk based on duration/exposure heuristics and should be reconsidered.";
  } else if (level === "caution") {
    summary = "Proceed only after checking local conditions, water, daylight, and trail access manually.";
  }

  return {
    title: "Safety briefing",
    summary,
    details,
    level,
    sourceStatus: "heuristic",
  };
}

function combineRecommendation(
  route: CalculatedRoute,
  bestTime: TrailBriefingItem,
  currentConditions: TrailBriefingItem,
  safety: TrailBriefingItem,
): TrailIntelligenceReport["recommendation"] {
  const levels = [bestTime.level, currentConditions.level, safety.level];
  const hasNoGo = levels.includes("no-go");
  const hasCaution = levels.includes("caution");

  const level: TrailBriefingLevel = hasNoGo ? "no-go" : hasCaution ? "caution" : "go";
  const reasons = [
    bestTime.summary,
    currentConditions.summary,
    safety.summary,
  ];

  if (route.warnings.length > 0) {
    reasons.push("Route-generation warnings exist and should be checked before trusting this path.");
  }

  if (level === "no-go") {
    return {
      level,
      title: "No-Go",
      summary: "This route should not be treated as ready-to-walk without additional verification.",
      reasons,
    };
  }

  if (level === "caution") {
    return {
      level,
      title: "Caution",
      summary: "This route may be workable, but it still needs manual validation before departure.",
      reasons,
    };
  }

  return {
    level,
    title: "Go",
    summary: "No major heuristic blockers were found, but local checks are still recommended.",
    reasons,
  };
}

export function buildTrailIntelligenceReport(
  input: TrailIntelligenceInput,
): TrailIntelligenceReport {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const now = new Date(generatedAt);
  const center = averageCoordinate(input.route.geometry);
  const regionLabel = inferRegionLabel(center);
  const routeSummary = buildRouteSummary(input.route, regionLabel);
  const bestTime = buildBestTime(input.route, now);
  const currentConditions = buildCurrentConditions(input.route, now);
  const safety = buildSafety(input.route);

  const sourceNotes: TrailBriefingSourceNote[] = [
    {
      source: "Israel Meteorological Service",
      status: "unavailable",
      summary: "Live IMS weather data is not configured in this app, so weather guidance is heuristic.",
    },
    {
      source: "Israel Nature and Parks Authority",
      status: "unavailable",
      summary: "No live RTG closure feed is configured, so trail status still requires manual checking.",
    },
    {
      source: "Home Front Command",
      status: "unavailable",
      summary: "No live Home Front alert feed is configured, so security guidance is not source-verified.",
    },
  ];

  return {
    generatedAt,
    regionLabel,
    routeSummary,
    bestTime,
    currentConditions,
    safety,
    recommendation: combineRecommendation(
      input.route,
      bestTime,
      currentConditions,
      safety,
    ),
    sourceNotes,
  };
}
