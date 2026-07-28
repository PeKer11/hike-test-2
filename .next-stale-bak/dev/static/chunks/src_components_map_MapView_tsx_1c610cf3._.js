(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/map/MapView.tsx [app-client] (ecmascript, next/dynamic entry, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  {
    "path": "static/chunks/node_modules_fe3b6aaa._.css",
    "included": [
      "[project]/node_modules/leaflet/dist/leaflet.css [app-client] (css)",
      "[project]/node_modules/leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css [app-client] (css)"
    ],
    "moduleChunks": [
      "static/chunks/node_modules_leaflet_dist_leaflet_css_bad6b30c._.single.css",
      "static/chunks/f9455_et-defaulticon-compatibility_dist_leaflet-defaulticon-compatibility_css_bad6b30c._.single.css"
    ]
  },
  "static/chunks/node_modules_31147b53._.js",
  "static/chunks/src_components_map_174a5c9c._.js",
  "static/chunks/src_components_map_MapView_tsx_d5a1d713._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/src/components/map/MapView.tsx [app-client] (ecmascript, next/dynamic entry)");
    });
});
}),
]);