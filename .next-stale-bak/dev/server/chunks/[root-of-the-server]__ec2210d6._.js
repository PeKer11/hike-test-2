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
"[project]/src/app/api/directions/route.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "POST",
    ()=>POST
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/server.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$ors$2d$client$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/api/ors-client.ts [app-route] (ecmascript)");
;
;
async function POST(request) {
    try {
        const payload = await request.json();
        if (!Array.isArray(payload.coordinates) || payload.coordinates.length < 2) {
            return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
                error: "At least two coordinates are required."
            }, {
                status: 400
            });
        }
        const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$api$2f$ors$2d$client$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getDirections"])(payload);
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch directions.";
        return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$server$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__["NextResponse"].json({
            error: message
        }, {
            status: 500
        });
    }
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__ec2210d6._.js.map