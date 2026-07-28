(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/Documents/test/hiking-route-planner/src/app/tsp-debug/TspMap.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>TspMap
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$leaflet$2d$defaulticon$2d$compatibility$2f$src$2f$Icon$2e$Default$2e$compatibility$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/leaflet-defaulticon-compatibility/src/Icon.Default.compatibility.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$MapContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/react-leaflet/lib/MapContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$TileLayer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/react-leaflet/lib/TileLayer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/react-leaflet/lib/hooks.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
function TspLayers({ nodes, matrix, nnTour, optimizedTour, view }) {
    _s();
    const map = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMap"])();
    const layersRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])([]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "TspLayers.useEffect": ()=>{
            // Clear previous layers
            layersRef.current.forEach({
                "TspLayers.useEffect": (l)=>map.removeLayer(l)
            }["TspLayers.useEffect"]);
            layersRef.current = [];
            const add = {
                "TspLayers.useEffect.add": (layer)=>{
                    layer.addTo(map);
                    layersRef.current.push(layer);
                }
            }["TspLayers.useEffect.add"];
            if (nodes.length === 0) return;
            // Helper: index → latlng
            const ll = {
                "TspLayers.useEffect.ll": (i)=>[
                        nodes[i].coordinates.lat,
                        nodes[i].coordinates.lng
                    ]
            }["TspLayers.useEffect.ll"];
            // ── Full graph ──────────────────────────────────────────────────────────
            if (view === "graph") {
                for(let i = 0; i < nodes.length; i++){
                    for(let j = i + 1; j < nodes.length; j++){
                        const dist = matrix[i]?.[j] ?? 0;
                        add(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].polyline([
                            ll(i),
                            ll(j)
                        ], {
                            color: "#94a3b8",
                            weight: 1,
                            opacity: 0.4
                        }).bindPopup(`${nodes[i].label} ↔ ${nodes[j].label}<br>${Math.round(dist)}m`));
                    }
                }
            }
            // ── Nearest Neighbor tour ───────────────────────────────────────────────
            if (view === "nn") {
                const path = [
                    0,
                    ...nnTour
                ];
                for(let k = 0; k < path.length - 1; k++){
                    add(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].polyline([
                        ll(path[k]),
                        ll(path[k + 1])
                    ], {
                        color: "#f97316",
                        weight: 3,
                        dashArray: "6 4"
                    }));
                }
            }
            // ── 2-opt optimized tour ────────────────────────────────────────────────
            if (view === "optimized") {
                const path = [
                    0,
                    ...optimizedTour
                ];
                for(let k = 0; k < path.length - 1; k++){
                    add(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].polyline([
                        ll(path[k]),
                        ll(path[k + 1])
                    ], {
                        color: "#16a34a",
                        weight: 4
                    }));
                }
            }
            // ── Nodes (always shown) ────────────────────────────────────────────────
            nodes.forEach({
                "TspLayers.useEffect": (node, i)=>{
                    const isOrigin = i === 0;
                    const marker = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].circleMarker([
                        node.coordinates.lat,
                        node.coordinates.lng
                    ], {
                        radius: isOrigin ? 10 : 7,
                        color: isOrigin ? "#dc2626" : "#2563eb",
                        fillColor: isOrigin ? "#dc2626" : "#93c5fd",
                        fillOpacity: 1,
                        weight: 2
                    }).bindPopup(`<strong>${isOrigin ? "📍 Start" : `#${i} ${node.label}`}</strong>`);
                    add(marker);
                }
            }["TspLayers.useEffect"]);
            // Fit bounds
            const lls = nodes.map({
                "TspLayers.useEffect.lls": (n)=>[
                        n.coordinates.lat,
                        n.coordinates.lng
                    ]
            }["TspLayers.useEffect.lls"]);
            map.fitBounds(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].latLngBounds(lls), {
                padding: [
                    30,
                    30
                ]
            });
        }
    }["TspLayers.useEffect"], [
        nodes,
        matrix,
        nnTour,
        optimizedTour,
        view,
        map
    ]);
    return null;
}
_s(TspLayers, "dTPTdXAJjGp24OlSOzXTLmY5lxQ=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMap"]
    ];
});
_c = TspLayers;
function TspMap(props) {
    const center = props.nodes[0] ? [
        props.nodes[0].coordinates.lat,
        props.nodes[0].coordinates.lng
    ] : [
        32.0853,
        34.7818
    ];
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$MapContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MapContainer"], {
        center: center,
        zoom: 14,
        className: "h-full w-full",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$TileLayer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TileLayer"], {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/app/tsp-debug/TspMap.tsx",
                lineNumber: 105,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(TspLayers, {
                ...props
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/app/tsp-debug/TspMap.tsx",
                lineNumber: 109,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/app/tsp-debug/TspMap.tsx",
        lineNumber: 104,
        columnNumber: 5
    }, this);
}
_c1 = TspMap;
var _c, _c1;
__turbopack_context__.k.register(_c, "TspLayers");
__turbopack_context__.k.register(_c1, "TspMap");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/Documents/test/hiking-route-planner/src/app/tsp-debug/TspMap.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/app/tsp-debug/TspMap.tsx [app-client] (ecmascript)"));
}),
]);

//# sourceMappingURL=Documents_test_hiking-route-planner_src_app_tsp-debug_TspMap_tsx_d0ed5195._.js.map