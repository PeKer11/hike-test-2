module.exports = [
"[externals]/next/dist/compiled/next-server/app-route-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-route-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-route-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/@opentelemetry/api [external] (next/dist/compiled/@opentelemetry/api, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/@opentelemetry/api", () => require("next/dist/compiled/@opentelemetry/api"));

module.exports = mod;
}),
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-unit-async-storage.external.js [external] (next/dist/server/app-render/work-unit-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-unit-async-storage.external.js", () => require("next/dist/server/app-render/work-unit-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/shared/lib/no-fallback-error.external.js [external] (next/dist/shared/lib/no-fallback-error.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/shared/lib/no-fallback-error.external.js", () => require("next/dist/shared/lib/no-fallback-error.external.js"));

module.exports = mod;
}),
"[externals]/next/dist/server/app-render/after-task-async-storage.external.js [external] (next/dist/server/app-render/after-task-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/after-task-async-storage.external.js", () => require("next/dist/server/app-render/after-task-async-storage.external.js"));

module.exports = mod;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "closestPointOnSegment",
    ()=>closestPointOnSegment,
    "formatDistance",
    ()=>formatDistance,
    "fromOrsCoord",
    ()=>fromOrsCoord,
    "haversineDistance",
    ()=>haversineDistance,
    "routeDistanceBetween",
    ()=>routeDistanceBetween,
    "toOrsCoord",
    ()=>toOrsCoord
]);
const EARTH_RADIUS_METERS = 6371000;
function toRadians(degrees) {
    return degrees * Math.PI / 180;
}
function haversineDistance(a, b) {
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const deltaLat = toRadians(b.lat - a.lat);
    const deltaLng = toRadians(b.lng - a.lng);
    const hav = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(hav));
}
function toOrsCoord(coord) {
    return [
        coord.lng,
        coord.lat
    ];
}
function fromOrsCoord(coord) {
    return {
        lat: coord[1],
        lng: coord[0]
    };
}
function closestPointOnSegment(p, a, b) {
    const dx = b.lng - a.lng;
    const dy = b.lat - a.lat;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return a;
    const t = Math.max(0, Math.min(1, ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / lenSq));
    return {
        lat: a.lat + t * dy,
        lng: a.lng + t * dx
    };
}
function positionAlongRoute(point, geometry) {
    let minDist = Infinity;
    let bestPos = 0;
    let cumDist = 0;
    for(let i = 0; i < geometry.length - 1; i++){
        const proj = closestPointOnSegment(point, geometry[i], geometry[i + 1]);
        const dist = haversineDistance(point, proj);
        if (dist < minDist) {
            minDist = dist;
            bestPos = cumDist + haversineDistance(geometry[i], proj);
        }
        cumDist += haversineDistance(geometry[i], geometry[i + 1]);
    }
    return bestPos;
}
function routeDistanceBetween(geometry, from, to) {
    if (geometry.length < 2) return haversineDistance(from, to);
    const fromPos = positionAlongRoute(from, geometry);
    const toPos = positionAlongRoute(to, geometry);
    return Math.max(0, toPos - fromPos);
}
function formatDistance(meters) {
    if (!Number.isFinite(meters)) {
        return "Unknown distance";
    }
    if (meters < 1000) {
        return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/utils/time.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "formatDuration",
    ()=>formatDuration,
    "secondsToTime",
    ()=>secondsToTime,
    "timeToSeconds",
    ()=>timeToSeconds
]);
function timeToSeconds(time) {
    const parts = time.split(":").map(Number);
    const [hours, minutes] = parts;
    if (parts.length < 2 || Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        return null;
    }
    const seconds = parts[2] ?? 0;
    return hours * 3600 + minutes * 60 + (Number.isNaN(seconds) ? 0 : seconds);
}
function secondsToTime(totalSeconds) {
    const clampedSeconds = Math.max(0, Math.floor(totalSeconds));
    const hours = Math.floor(clampedSeconds / 3600).toString().padStart(2, "0");
    const minutes = Math.floor(clampedSeconds % 3600 / 60).toString().padStart(2, "0");
    return `${hours}:${minutes}`;
}
function formatDuration(totalSeconds) {
    if (!Number.isFinite(totalSeconds)) {
        return "Unknown duration";
    }
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.round(totalSeconds % 3600 / 60);
    if (hours === 0) {
        return `${minutes} min`;
    }
    if (minutes === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${minutes}m`;
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/trail-intelligence/build-briefing.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildTrailIntelligenceReport",
    ()=>buildTrailIntelligenceReport
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$time$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/time.ts [app-route] (ecmascript)");
;
;
const SUMMER_MONTHS = new Set([
    5,
    6,
    7,
    8,
    9
]);
const WINTER_MONTHS = new Set([
    11,
    0,
    1
]);
function averageCoordinate(points) {
    if (points.length === 0) {
        return null;
    }
    const total = points.reduce((acc, point)=>({
            lat: acc.lat + point.lat,
            lng: acc.lng + point.lng
        }), {
        lat: 0,
        lng: 0
    });
    return {
        lat: total.lat / points.length,
        lng: total.lng / points.length
    };
}
function inferRegionLabel(center) {
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
function inferTerrain(route, regionLabel) {
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
function estimateExposureLevel(route) {
    if (route.totalDistanceMeters >= 18_000 || route.totalDurationSeconds >= 5 * 3600) {
        return "no-go";
    }
    if (route.totalDistanceMeters >= 10_000 || route.totalDurationSeconds >= 3 * 3600) {
        return "caution";
    }
    return "go";
}
function buildRouteSummary(route, regionLabel) {
    const terrain = inferTerrain(route, regionLabel);
    const routeType = route.source === "rtg" ? route.sourceLabel?.toLowerCase().includes("curated") ? "RTG-guided route using curated RTG-style trail data with ORS path generation" : "RTG-guided route using RTG trail references with ORS path generation" : "fallback route generated from the current waypoint plan";
    return {
        title: "Trail description",
        summary: `${routeType} in ${regionLabel}. Expect ${terrain}.`,
        details: [
            `${route.orderedWaypoints.length} stops across ${route.segments.length} route segment(s).`,
            `Estimated moving time: ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$time$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["formatDuration"])(route.totalDurationSeconds)}.`,
            route.warnings.length > 0 ? "Existing routing warnings should be reviewed before departure." : "No route-generation warnings are currently attached to this path."
        ],
        sourceStatus: "heuristic"
    };
}
function buildBestTime(route, now) {
    const hour = now.getHours();
    const month = now.getMonth();
    const inSummer = SUMMER_MONTHS.has(month);
    const inWinter = WINTER_MONTHS.has(month);
    const longRoute = route.totalDurationSeconds >= 3 * 3600;
    const details = [];
    let summary = "Early morning is the safest default start window for this route.";
    let level = "go";
    if (inSummer) {
        summary = "Start early or near sunset. Midday heat can turn this route from manageable to unsafe.";
        details.push("Avoid starting between 11:00 and 16:00 in warm months.");
        if (hour >= 11 && hour <= 16 && longRoute) {
            level = "no-go";
        } else if (hour >= 10 && hour <= 17) {
            level = "caution";
        }
    } else if (inWinter) {
        summary = "Aim for daylight hours and allow margin before sunset, especially on longer routes.";
        details.push("Short daylight windows increase risk of finishing in the dark.");
        if (hour >= 15 && longRoute) {
            level = "caution";
        }
    } else {
        details.push("Morning starts usually provide the best temperature and daylight margin.");
    }
    details.push(route.totalDurationSeconds >= 4 * 3600 ? "This is a longer outing, so start earlier than you think you need." : "This route is short enough that a flexible start time is possible if conditions stay mild.");
    return {
        title: "Best time recommendation",
        summary,
        details,
        level,
        sourceStatus: "heuristic"
    };
}
function buildCurrentConditions(route, now) {
    const hour = now.getHours();
    const month = now.getMonth();
    const details = [];
    let summary = "No live weather feed is configured, so this is a route-based field estimate.";
    let level = "caution";
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
        summary = hour >= 16 ? "Late-day winter conditions can become unfavorable quickly." : "Conditions may be reasonable, but check actual rain and ground conditions before departure.";
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
        sourceStatus: "heuristic"
    };
}
function routeSpreadMeters(route) {
    if (route.geometry.length < 2) {
        return 0;
    }
    const start = route.geometry[0];
    const end = route.geometry[route.geometry.length - 1];
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["haversineDistance"])(start, end);
}
function buildSafety(route) {
    const details = [];
    let level = estimateExposureLevel(route);
    let summary = "No live official alert feed is configured. Safety recommendation is based on route length, duration, and routing quality.";
    if (route.source === "rtg") {
        details.push("This route is guided by RTG trail points, but the displayed path is generated by ORS and may diverge from the marked trail.");
        if (level === "go") {
            level = "caution";
        }
    }
    if (route.warnings.length > 0) {
        details.push("Routing warnings are present. Treat the path as needing manual verification.");
        level = "caution";
    }
    const spread = routeSpreadMeters(route);
    details.push(spread >= 8_000 ? "The route covers a broad area, so bail-out logistics may be more complex." : "The route footprint is relatively compact, which can make retreat simpler if conditions change.");
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
        sourceStatus: "heuristic"
    };
}
function combineRecommendation(route, bestTime, currentConditions, safety) {
    const levels = [
        bestTime.level,
        currentConditions.level,
        safety.level
    ];
    const hasNoGo = levels.includes("no-go");
    const hasCaution = levels.includes("caution");
    const level = hasNoGo ? "no-go" : hasCaution ? "caution" : "go";
    const reasons = [
        bestTime.summary,
        currentConditions.summary,
        safety.summary
    ];
    if (route.warnings.length > 0) {
        reasons.push("Route-generation warnings exist and should be checked before trusting this path.");
    }
    if (level === "no-go") {
        return {
            level,
            title: "No-Go",
            summary: "This route should not be treated as ready-to-walk without additional verification.",
            reasons
        };
    }
    if (level === "caution") {
        return {
            level,
            title: "Caution",
            summary: "This route may be workable, but it still needs manual validation before departure.",
            reasons
        };
    }
    return {
        level,
        title: "Go",
        summary: "No major heuristic blockers were found, but local checks are still recommended.",
        reasons
    };
}
function buildTrailIntelligenceReport(input) {
    const generatedAt = input.generatedAt ?? new Date().toISOString();
    const now = new Date(generatedAt);
    const center = averageCoordinate(input.route.geometry);
    const regionLabel = inferRegionLabel(center);
    const routeSummary = buildRouteSummary(input.route, regionLabel);
    const bestTime = buildBestTime(input.route, now);
    const currentConditions = buildCurrentConditions(input.route, now);
    const safety = buildSafety(input.route);
    const sourceNotes = [
        {
            source: "Israel Meteorological Service",
            status: "unavailable",
            summary: "Live IMS weather data is not configured in this app, so weather guidance is heuristic."
        },
        {
            source: "Israel Nature and Parks Authority",
            status: "unavailable",
            summary: "No live RTG closure feed is configured, so trail status still requires manual checking."
        },
        {
            source: "Home Front Command",
            status: "unavailable",
            summary: "No live Home Front alert feed is configured, so security guidance is not source-verified."
        }
    ];
    return {
        generatedAt,
        regionLabel,
        routeSummary,
        bestTime,
        currentConditions,
        safety,
        recommendation: combineRecommendation(input.route, bestTime, currentConditions, safety),
        sourceNotes
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/app/api/trail-intelligence/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$trail$2d$intelligence$2f$build$2d$briefing$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/trail-intelligence/build-briefing.ts [app-route] (ecmascript)");
;
;
function isValidCoordinate(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const candidate = value;
    return Number.isFinite(candidate.lat) && candidate.lat >= -90 && candidate.lat <= 90 && Number.isFinite(candidate.lng) && candidate.lng >= -180 && candidate.lng <= 180;
}
function isValidRoute(route) {
    if (!route) {
        return false;
    }
    return Array.isArray(route.orderedWaypoints) && Array.isArray(route.segments) && Array.isArray(route.geometry) && Number.isFinite(route.totalDistanceMeters) && Number.isFinite(route.totalDurationSeconds) && Array.isArray(route.warnings);
}
async function POST(request) {
    try {
        const payload = await request.json();
        if (!isValidRoute(payload.route)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "A valid calculated route is required."
            }, {
                status: 400
            });
        }
        if (payload.userLocation && !isValidCoordinate(payload.userLocation)) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "User location must be a valid coordinate pair."
            }, {
                status: 400
            });
        }
        const report = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$trail$2d$intelligence$2f$build$2d$briefing$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildTrailIntelligenceReport"])({
            route: payload.route,
            userLocation: payload.userLocation
        });
        return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(report);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to generate trail briefing.";
        return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: message
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__f2808c43._.js.map