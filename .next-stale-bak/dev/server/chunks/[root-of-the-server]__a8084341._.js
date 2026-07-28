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
"[project]/src/lib/attractions/overpass-client.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fetchAttractions",
    ()=>fetchAttractions
]);
// Primary + mirror — tried in order if the previous one times out or fails
const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];
// How long a visitor typically spends at each category (minutes)
const AVG_VISIT_MINUTES = {
    landmark: 20,
    museum: 60,
    park: 30,
    food: 45,
    viewpoint: 15,
    religious: 20,
    shopping: 30,
    entertainment: 60,
    nature: 40,
    other: 15
};
// OSM tag → category mapping
function inferCategory(tags) {
    const { tourism, amenity, leisure, historic, natural, shop } = tags;
    if (tourism === "museum") return "museum";
    if (tourism === "viewpoint") return "viewpoint";
    if (tourism === "attraction" || tourism === "artwork" || tourism === "theme_park" || tourism === "zoo" || tourism === "aquarium") return "landmark";
    if (historic) return "landmark";
    if (amenity === "place_of_worship") return "religious";
    if (amenity === "restaurant" || amenity === "cafe" || amenity === "bar") return "food";
    if (amenity === "theatre" || amenity === "cinema") return "entertainment";
    if (leisure === "park" || leisure === "garden") return "park";
    if (leisure === "miniature_golf" || leisure === "water_park" || leisure === "amusement_arcade" || leisure === "escape_game" || leisure === "bowling_alley") return "entertainment";
    if (natural === "peak" || natural === "waterfall" || natural === "cave_entrance") return "nature";
    if (shop) return "shopping";
    return "other";
}
function buildOverpassQuery(center, radiusMeters) {
    const { lat, lng } = center;
    const r = radiusMeters;
    // Query for the most relevant tourism/cultural POI types within radius
    return `
[out:json][timeout:25];
(
  node["tourism"~"museum|attraction|viewpoint|artwork|gallery|theme_park|zoo|aquarium"](around:${r},${lat},${lng});
  node["historic"](around:${r},${lat},${lng});
  node["amenity"~"place_of_worship|theatre|cinema|restaurant|cafe"](around:${r},${lat},${lng});
  node["leisure"~"park|garden|miniature_golf|water_park|amusement_arcade|escape_game|bowling_alley"](around:${r},${lat},${lng});
  node["natural"~"peak|waterfall|cave_entrance"](around:${r},${lat},${lng});
  way["tourism"~"museum|attraction|viewpoint|theme_park|zoo|aquarium"](around:${r},${lat},${lng});
  way["historic"](around:${r},${lat},${lng});
  way["leisure"~"park|garden|miniature_golf|water_park|amusement_arcade|escape_game|bowling_alley"](around:${r},${lat},${lng});
);
out center;
`.trim();
}
function elementToAttraction(el) {
    const tags = el.tags ?? {};
    const name = tags.name ?? tags["name:en"] ?? tags["name:he"];
    if (!name) return null;
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (lat === undefined || lng === undefined) return null;
    const category = inferCategory(tags);
    return {
        id: `osm-${el.type}-${el.id}`,
        name,
        coordinates: {
            lat,
            lng
        },
        category,
        avgVisitMinutes: AVG_VISIT_MINUTES[category],
        tags
    };
}
async function fetchAttractions(center, radiusMeters) {
    const query = buildOverpassQuery(center, radiusMeters);
    const body = `data=${encodeURIComponent(query)}`;
    let lastError = new Error("Overpass API unavailable.");
    for (const endpoint of OVERPASS_ENDPOINTS){
        try {
            const controller = new AbortController();
            const timeout = setTimeout(()=>controller.abort(), 20_000);
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body,
                signal: controller.signal
            });
            clearTimeout(timeout);
            if (!response.ok) {
                lastError = new Error(`Overpass API error: ${response.status} ${response.statusText}`);
                continue; // try next mirror
            }
            const data = await response.json();
            const attractions = [];
            const seenIds = new Set();
            for (const el of data.elements){
                const attraction = elementToAttraction(el);
                if (!attraction) continue;
                if (seenIds.has(attraction.id)) continue;
                seenIds.add(attraction.id);
                attractions.push(attraction);
            }
            return attractions;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error("Overpass request failed.");
        // try next mirror
        }
    }
    throw lastError;
}
}),
"[project]/src/lib/utils/geo.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "formatDistance",
    ()=>formatDistance,
    "fromOrsCoord",
    ()=>fromOrsCoord,
    "haversineDistance",
    ()=>haversineDistance,
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
"[project]/src/lib/attractions/attraction-ranker.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "rankAttractions",
    ()=>rankAttractions,
    "selectFeasibleAttractions",
    ()=>selectFeasibleAttractions
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/geo.ts [app-route] (ecmascript)");
;
// Higher = more broadly interesting to most people
const CATEGORY_BASE_SCORE = {
    viewpoint: 10,
    landmark: 9,
    museum: 8,
    park: 7,
    nature: 7,
    religious: 6,
    entertainment: 6,
    food: 5,
    shopping: 4,
    other: 3
};
// Bonus for tags that indicate well-known or notable places
function notabilityBonus(tags) {
    let bonus = 0;
    if (tags.wikidata) bonus += 3;
    if (tags.wikipedia) bonus += 2;
    if (tags["heritage"]) bonus += 2;
    if (tags["star_rating"]) bonus += 1;
    return bonus;
}
function rankAttractions(attractions, options) {
    const { origin, preferredCategories, availableMinutes, walkingPaceMinPerKm } = options;
    // Maximum walk distance that could fit in the available time (rough upper bound)
    const maxReachableMeters = availableMinutes / walkingPaceMinPerKm * 1000 * 0.5; // use half the time for walking
    const scored = [];
    for (const a of attractions){
        const distanceMeters = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["haversineDistance"])(origin, a.coordinates);
        if (distanceMeters > maxReachableMeters) continue;
        let score = CATEGORY_BASE_SCORE[a.category] ?? 3;
        score += notabilityBonus(a.tags);
        if (preferredCategories?.includes(a.category)) score += 4;
        score -= distanceMeters / 1000;
        scored.push({
            ...a,
            distanceFromOriginMeters: distanceMeters,
            score
        });
    }
    scored.sort((a, b)=>b.score - a.score);
    return scored;
}
function selectFeasibleAttractions(ranked, availableMinutes, walkingPaceMinPerKm, maxAttractions = 8) {
    const selected = [];
    const dropped = [];
    let usedMinutes = 0;
    for (const attraction of ranked){
        if (selected.length >= maxAttractions) {
            dropped.push(attraction);
            continue;
        }
        // Rough walking time from previous stop (or origin) to this attraction
        // This is a heuristic — TSP planner will compute exact order + times later
        const walkingMinutes = (attraction.distanceFromOriginMeters ?? 0) / 1000 / walkingPaceMinPerKm;
        const totalCost = walkingMinutes + attraction.avgVisitMinutes;
        if (usedMinutes + totalCost <= availableMinutes) {
            selected.push(attraction);
            usedMinutes += totalCost;
        } else {
            dropped.push(attraction);
        }
    }
    return {
        selected,
        dropped
    };
}
}),
"[project]/src/lib/api/ors-client.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getDirections",
    ()=>getDirections,
    "optimizeRoute",
    ()=>optimizeRoute
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
;
const ORS_BASE_URL = "https://api.openrouteservice.org";
function parseOrsError(errorText, status) {
    let normalizedError = errorText.toLowerCase();
    try {
        const parsedError = JSON.parse(errorText);
        const errorMessage = parsedError.error?.message ?? parsedError.message;
        if (errorMessage) {
            normalizedError = errorMessage.toLowerCase();
        }
    } catch  {
    // Fall back to plain-text matching when ORS does not return structured JSON.
    }
    if (status === 401 || status === 403) {
        return "API key is missing or invalid.";
    }
    if (status === 404) {
        return "Routing service endpoint not found.";
    }
    if (normalizedError.includes("not routable") || normalizedError.includes("could not find routable point") || normalizedError.includes("could not find routable") || normalizedError.includes("no routable point")) {
        return "One or more waypoints are too far from a walkable road or trail. Move them closer to a path and try again.";
    }
    if (normalizedError.includes("no solution")) {
        return "No valid route could be found with these constraints. Try relaxing the constraints.";
    }
    return "Routing service error. Please try again.";
}
function getApiKey() {
    const key = process.env.ORS_API_KEY;
    if (!key) {
        throw new Error("ORS_API_KEY is not configured.");
    }
    return key;
}
async function fetchOrs(url, body, init) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: getApiKey(),
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
        ...init
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(parseOrsError(errorText, response.status));
    }
    return await response.json();
}
async function getDirections(request) {
    const profile = request.profile ?? "foot-walking";
    return fetchOrs(`${ORS_BASE_URL}/v2/directions/${profile}/json`, {
        coordinates: request.coordinates,
        instructions: request.instructions ?? true
    }, {
        cache: "no-store"
    });
}
async function optimizeRoute(request) {
    return fetchOrs(`${ORS_BASE_URL}/optimization`, request, {
        cache: "no-store"
    });
}
}),
"[project]/src/lib/optimization/tsp-planner.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildWalkPlan",
    ()=>buildWalkPlan,
    "planWalkOrder",
    ()=>planWalkOrder
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/geo.ts [app-route] (ecmascript)");
;
function distBetween(a, b) {
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["haversineDistance"])(a.coordinates, b.coordinates);
}
function buildMatrix(origin, attractions) {
    const nodes = [
        origin,
        ...attractions
    ];
    const n = nodes.length;
    const matrix = Array.from({
        length: n
    }, ()=>new Array(n).fill(0));
    for(let i = 0; i < n; i++){
        for(let j = i + 1; j < n; j++){
            const d = distBetween(nodes[i], nodes[j]);
            matrix[i][j] = d;
            matrix[j][i] = d;
        }
    }
    return matrix;
}
// ---------------------------------------------------------------------------
// Nearest Neighbor heuristic (index 0 = origin, always fixed as start)
// ---------------------------------------------------------------------------
function nearestNeighbor(matrix, n) {
    // Returns order of indices 1..n-1 (attractions only, origin excluded)
    const visited = new Array(n).fill(false);
    visited[0] = true;
    const tour = [];
    let current = 0;
    for(let step = 0; step < n - 1; step++){
        let nearest = -1;
        let nearestDist = Infinity;
        for(let j = 1; j < n; j++){
            if (!visited[j] && matrix[current][j] < nearestDist) {
                nearest = j;
                nearestDist = matrix[current][j];
            }
        }
        visited[nearest] = true;
        tour.push(nearest);
        current = nearest;
    }
    return tour; // indices into [origin, ...attractions]
}
// ---------------------------------------------------------------------------
// 2-opt improvement (operates only on the attraction sub-tour, not origin)
// ---------------------------------------------------------------------------
function twoOpt(tour, matrix, originIndex) {
    let improved = true;
    let best = [
        ...tour
    ];
    while(improved){
        improved = false;
        for(let i = 0; i < best.length - 1; i++){
            for(let j = i + 1; j < best.length; j++){
                const prev_i = i === 0 ? originIndex : best[i - 1];
                const prev_j = best[j - 1]; // always valid since j > i >= 0
                const before = matrix[prev_i][best[i]] + (j + 1 < best.length ? matrix[best[j]][best[j + 1]] : 0);
                const after = matrix[prev_i][best[j]] + (j + 1 < best.length ? matrix[best[i]][best[j + 1]] : 0);
                if (after < before - 0.1) {
                    // Reverse the segment between i and j (inclusive)
                    const newTour = [
                        ...best.slice(0, i),
                        ...best.slice(i, j + 1).reverse(),
                        ...best.slice(j + 1)
                    ];
                    best = newTour;
                    improved = true;
                }
            }
        }
    }
    return best;
}
function planWalkOrder(request, candidates) {
    const { origin, availableMinutes, walkingPaceMinPerKm } = request;
    const originPoint = {
        coordinates: origin
    };
    if (candidates.length === 0) {
        return {
            orderedAttractions: [],
            segments: [],
            totalDistanceMeters: 0,
            totalWalkingMinutes: 0,
            totalVisitMinutes: 0,
            feasible: false,
            droppedAttractions: []
        };
    }
    // Build distance matrix: index 0 = origin, 1..n = attractions
    const matrix = buildMatrix(originPoint, candidates);
    const n = matrix.length; // 1 (origin) + candidates.length
    // Get initial order via Nearest Neighbor
    let tourIndices = nearestNeighbor(matrix, n);
    // Improve with 2-opt
    tourIndices = twoOpt(tourIndices, matrix, 0);
    // tourIndices are 1-based indices into [origin, ...candidates]
    const ordered = tourIndices.map((i)=>candidates[i - 1]);
    // Build segments and check feasibility
    const segments = [];
    let totalDistanceMeters = 0;
    let totalWalkingMinutes = 0;
    let totalVisitMinutes = 0;
    const droppedAttractions = [];
    const feasibleAttractions = [];
    let prevPoint = originPoint;
    let prevLabel = {
        name: "origin",
        coordinates: origin
    };
    for (const attraction of ordered){
        const segDistMeters = distBetween(prevPoint, attraction);
        const segWalkMinutes = segDistMeters / 1000 * walkingPaceMinPerKm;
        const cost = segWalkMinutes + attraction.avgVisitMinutes;
        if (totalWalkingMinutes + totalVisitMinutes + cost > availableMinutes) {
            droppedAttractions.push(attraction);
            continue;
        }
        const segment = {
            from: prevLabel,
            to: attraction,
            distanceMeters: segDistMeters,
            walkingMinutes: segWalkMinutes
        };
        segments.push(segment);
        totalDistanceMeters += segDistMeters;
        totalWalkingMinutes += segWalkMinutes;
        totalVisitMinutes += attraction.avgVisitMinutes;
        feasibleAttractions.push(attraction);
        prevPoint = attraction;
        prevLabel = attraction;
    }
    return {
        orderedAttractions: feasibleAttractions,
        segments,
        totalDistanceMeters,
        totalWalkingMinutes,
        totalVisitMinutes,
        feasible: feasibleAttractions.length > 0,
        droppedAttractions
    };
}
function buildWalkPlan(request, candidates) {
    const tsp = planWalkOrder(request, candidates);
    return {
        orderedAttractions: tsp.orderedAttractions,
        segments: tsp.segments,
        totalDistanceMeters: tsp.totalDistanceMeters,
        totalMinutes: tsp.totalWalkingMinutes + tsp.totalVisitMinutes,
        feasible: tsp.feasible,
        droppedAttractions: tsp.droppedAttractions
    };
}
}),
"[project]/src/lib/utils/polyline.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "decodePolyline",
    ()=>decodePolyline
]);
function decodePolyline(encoded, precision = 5) {
    const factor = 10 ** precision;
    const coordinates = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    while(index < encoded.length){
        let byte;
        let shift = 0;
        let result = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        }while (byte >= 0x20)
        const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
        lat += deltaLat;
        shift = 0;
        result = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        }while (byte >= 0x20)
        const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
        lng += deltaLng;
        coordinates.push({
            lat: lat / factor,
            lng: lng / factor
        });
    }
    return coordinates;
}
}),
"[project]/src/app/api/walk-plan/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$attractions$2f$overpass$2d$client$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/attractions/overpass-client.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$attractions$2f$attraction$2d$ranker$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/attractions/attraction-ranker.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$ors$2d$client$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api/ors-client.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$optimization$2f$tsp$2d$planner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/optimization/tsp-planner.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/geo.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$polyline$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/utils/polyline.ts [app-route] (ecmascript)");
;
;
;
;
;
;
;
async function POST(request) {
    try {
        const body = await request.json();
        const { lat, lng, availableMinutes } = body;
        if (typeof lat !== "number" || typeof lng !== "number" || typeof availableMinutes !== "number" || availableMinutes <= 0) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "lat, lng, and availableMinutes (> 0) are required."
            }, {
                status: 400
            });
        }
        const origin = {
            lat,
            lng
        };
        const walkingPaceMinPerKm = body.walkingPaceMinPerKm ?? 15;
        const radiusMeters = body.radiusMeters ?? 2000;
        // 1. Fetch raw attractions from Overpass
        const raw = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$attractions$2f$overpass$2d$client$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["fetchAttractions"])(origin, radiusMeters);
        // 2. Rank and pre-filter by time budget
        const ranked = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$attractions$2f$attraction$2d$ranker$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["rankAttractions"])(raw, {
            origin,
            preferredCategories: body.preferredCategories,
            availableMinutes,
            walkingPaceMinPerKm
        });
        const { selected } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$attractions$2f$attraction$2d$ranker$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["selectFeasibleAttractions"])(ranked, availableMinutes, walkingPaceMinPerKm);
        // 3. Build walk plan with TSP ordering
        const planRequest = {
            origin,
            availableMinutes,
            walkingPaceMinPerKm,
            radiusMeters,
            preferredCategories: body.preferredCategories
        };
        const plan = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$optimization$2f$tsp$2d$planner$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["buildWalkPlan"])(planRequest, selected);
        // 4. Fetch ORS geometry for the ordered route (origin → attraction 1 → 2 → ...)
        let geometry;
        if (plan.orderedAttractions.length > 0 && process.env.ORS_API_KEY) {
            try {
                const waypoints = [
                    origin,
                    ...plan.orderedAttractions.map((a)=>a.coordinates)
                ];
                const orsRes = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$ors$2d$client$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDirections"])({
                    coordinates: waypoints.map(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["toOrsCoord"]),
                    profile: "foot-walking",
                    instructions: false
                });
                const encoded = orsRes.routes[0]?.geometry;
                if (encoded) {
                    geometry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$utils$2f$polyline$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["decodePolyline"])(encoded);
                }
            } catch  {
            // Geometry is optional — don't fail the whole plan if ORS is unavailable
            }
        }
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            ...plan,
            geometry
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to build walk plan.";
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: message
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__a8084341._.js.map