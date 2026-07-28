(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/src/components/map/MapView.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>MapView
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2d$defaulticon$2d$compatibility$2f$src$2f$Icon$2e$Default$2e$compatibility$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet-defaulticon-compatibility/src/Icon.Default.compatibility.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$MapContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-leaflet/lib/MapContainer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$TileLayer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-leaflet/lib/TileLayer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/react-leaflet/lib/hooks.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$map$2f$MapClickHandler$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/map/MapClickHandler.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$map$2f$MapMarkers$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/map/MapMarkers.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$map$2f$RoutePolyline$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/components/map/RoutePolyline.tsx [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
function MapViewport({ center, zoom }) {
    _s();
    const map = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMap"])();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MapViewport.useEffect": ()=>{
            map.setView([
                center.lat,
                center.lng
            ], zoom);
        }
    }["MapViewport.useEffect"], [
        map,
        center.lat,
        center.lng,
        zoom
    ]);
    return null;
}
_s(MapViewport, "IoceErwr5KVGS9kN4RQ1bOkYMAg=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$hooks$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useMap"]
    ];
});
_c = MapViewport;
function MapView({ waypoints, routeGeometry, center, zoom, onMapClick }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$MapContainer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MapContainer"], {
        center: [
            center.lat,
            center.lng
        ],
        zoom: zoom,
        className: "h-full w-full",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$react$2d$leaflet$2f$lib$2f$TileLayer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TileLayer"], {
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            }, void 0, false, {
                fileName: "[project]/src/components/map/MapView.tsx",
                lineNumber: 42,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(MapViewport, {
                center: center,
                zoom: zoom
            }, void 0, false, {
                fileName: "[project]/src/components/map/MapView.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$map$2f$MapMarkers$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MapMarkers"], {
                waypoints: waypoints
            }, void 0, false, {
                fileName: "[project]/src/components/map/MapView.tsx",
                lineNumber: 47,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$map$2f$RoutePolyline$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["RoutePolyline"], {
                geometry: routeGeometry
            }, void 0, false, {
                fileName: "[project]/src/components/map/MapView.tsx",
                lineNumber: 48,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$components$2f$map$2f$MapClickHandler$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["MapClickHandler"], {
                onMapClick: onMapClick
            }, void 0, false, {
                fileName: "[project]/src/components/map/MapView.tsx",
                lineNumber: 49,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/src/components/map/MapView.tsx",
        lineNumber: 41,
        columnNumber: 5
    }, this);
}
_c1 = MapView;
var _c, _c1;
__turbopack_context__.k.register(_c, "MapViewport");
__turbopack_context__.k.register(_c1, "MapView");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/src/components/map/MapView.tsx [app-client] (ecmascript, next/dynamic entry)", ((__turbopack_context__) => {

__turbopack_context__.n(__turbopack_context__.i("[project]/src/components/map/MapView.tsx [app-client] (ecmascript)"));
}),
"[project]/node_modules/leaflet-defaulticon-compatibility/src/Icon.Default.compatibility.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript)");
;
__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"].Default.mergeOptions({
    // Erase default options, so that they can be overridden by _initializeOptions if not supplied.
    iconUrl: null,
    iconRetinaUrl: null,
    shadowUrl: null,
    iconSize: null,
    iconAnchor: null,
    popupAnchor: null,
    tooltipAnchor: null,
    shadowSize: null,
    // @option classNamePrefix: String = 'leaflet-default-icon-'
    // Prefix for the classes defined in CSS that contain the Icon options.
    // See the leaflet-defaulticon-compatibility.css file as a starter.
    // Expected suffixes are "icon", "shadow", "popup" and "tooltip".
    classNamePrefix: 'leaflet-default-icon-'
});
__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"].Default.include({
    _needsInit: true,
    // Override to make sure options are retrieved from CSS.
    _getIconUrl: function(name) {
        // @option imagePath: String
        // `Icon.Default` will try to auto-detect the location of
        // the blue icon images. If you are placing these images in a
        // non-standard way, set this option to point to the right
        // path, before any marker is added to a map.
        // Caution: do not use this option with inline base64 image(s).
        var imagePath = this.options.imagePath || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"].Default.imagePath || '';
        // Deprecated (IconDefault.imagePath), backwards-compatibility only
        if (this._needsInit) {
            // Modifying imagePath option after _getIconUrl has been called
            // once in this instance of IconDefault will no longer have any
            // effect.
            this._initializeOptions(imagePath);
        }
        return imagePath + __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Icon"].prototype._getIconUrl.call(this, name);
    },
    // Initialize all necessary options for this instance.
    _initializeOptions: function(imagePath) {
        this._setOptions('icon', _detectIconOptions, imagePath);
        this._setOptions('shadow', _detectIconOptions, imagePath);
        this._setOptions('popup', _detectDivOverlayOptions);
        this._setOptions('tooltip', _detectDivOverlayOptions);
        this._needsInit = false;
    },
    // Retrieve values from CSS and assign to this instance options.
    _setOptions: function(name, detectorFn, imagePath) {
        var options = this.options, prefix = options.classNamePrefix, optionValues = detectorFn(prefix + name, imagePath);
        for(var optionName in optionValues){
            options[name + optionName] = options[name + optionName] || optionValues[optionName];
        }
    }
});
// Retrieve icon option values from CSS (icon or shadow).
function _detectIconOptions(className, imagePath) {
    var el = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DomUtil"].create('div', className, document.body), urlsContainer = _getBkgImageOrCursor(el), urls = _extractUrls(urlsContainer, imagePath), iconX = _getStyleInt(el, 'width'), iconY = _getStyleInt(el, 'height'), anchorNX = _getStyleInt(el, 'margin-left'), anchorNY = _getStyleInt(el, 'margin-top');
    el.parentNode.removeChild(el);
    return {
        Url: urls[0],
        RetinaUrl: urls[1],
        Size: [
            iconX,
            iconY
        ],
        Anchor: [
            -anchorNX,
            -anchorNY
        ]
    };
}
// Retrieve anchor option values from CSS (popup or tooltip).
function _detectDivOverlayOptions(className) {
    var el = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DomUtil"].create('div', className, document.body), anchorX = _getStyleInt(el, 'margin-left'), anchorY = _getStyleInt(el, 'margin-top');
    el.parentNode.removeChild(el);
    return {
        Anchor: [
            anchorX,
            anchorY
        ]
    };
}
// Read the CSS url (could be path or inline base64), may be multiple.
// First: normal icon
// Second: Retina icon
function _extractUrls(urlsContainer, imagePath) {
    var re = /url\(['"]?([^"']*?)['"]?\)/gi, urls = [], m = re.exec(urlsContainer);
    while(m){
        // Keep the entire URL from CSS rule, so that each image can have its own full URL.
        // Except in the case imagePath is provided: remove the path part (i.e. keep only the file name).
        urls.push(imagePath ? _stripPath(m[1]) : m[1]);
        m = re.exec(urlsContainer);
    }
    return urls;
}
// Remove anything before the last slash (/) occurrence (inclusive).
// Caution: will give unexpected result if url is inline base64 data
// => do not specify imagePath in that case!
function _stripPath(url) {
    return url.substr(url.lastIndexOf('/') + 1);
}
function _getStyleInt(el, style) {
    return parseInt(_getStyle(el, style), 10);
}
// Factorize style reading fallback for IE8.
function _getStyle(el, style) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DomUtil"].getStyle(el, style) || __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DomUtil"].getStyle(el, _kebabToCamelCase(style));
}
// When Firefox high contrast (colours override) option is enabled,
// "background-image" is overridden by the browser as "none".
// In that case, fallback to "cursor". But keep "background-image"
// as primary source because IE expects cursor URL as relative to HTML page
// instead of relative to CSS file.
function _getBkgImageOrCursor(el) {
    var bkgImage = _getStyle(el, 'background-image');
    return bkgImage && bkgImage !== 'none' ? bkgImage : _getStyle(el, 'cursor');
}
// Convert kebab-case CSS property name to camelCase for IE currentStyle.
function _kebabToCamelCase(prop) {
    return prop.replace(/-(\w)/g, function(str, w) {
        return w.toUpperCase();
    });
}
}),
"[project]/node_modules/react-leaflet/lib/MapContainer.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MapContainer",
    ()=>MapContainer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$context$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@react-leaflet/core/lib/context.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
;
;
;
function MapContainerComponent({ bounds, boundsOptions, center, children, className, id, placeholder, style, whenReady, zoom, ...options }, forwardedRef) {
    const [props] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])({
        className,
        id,
        style
    });
    const [context, setContext] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const mapInstanceRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRef"])(undefined);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useImperativeHandle"])(forwardedRef, {
        "MapContainerComponent.useImperativeHandle": ()=>context?.map ?? null
    }["MapContainerComponent.useImperativeHandle"], [
        context
    ]);
    // biome-ignore lint/correctness/useExhaustiveDependencies: ref callback
    const mapRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "MapContainerComponent.useCallback[mapRef]": (node)=>{
            if (node !== null && !mapInstanceRef.current) {
                const map = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["Map"](node, options);
                mapInstanceRef.current = map;
                if (center != null && zoom != null) {
                    map.setView(center, zoom);
                } else if (bounds != null) {
                    map.fitBounds(bounds, boundsOptions);
                }
                if (whenReady != null) {
                    map.whenReady(whenReady);
                }
                setContext((0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$context$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createLeafletContext"])(map));
            }
        }
    }["MapContainerComponent.useCallback[mapRef]"], []);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "MapContainerComponent.useEffect": ()=>{
            return ({
                "MapContainerComponent.useEffect": ()=>{
                    context?.map.remove();
                }
            })["MapContainerComponent.useEffect"];
        }
    }["MapContainerComponent.useEffect"], [
        context
    ]);
    const contents = context ? /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$context$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["LeafletContext"], {
        value: context
    }, children) : placeholder ?? null;
    return /*#__PURE__*/ __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].createElement("div", {
        ...props,
        ref: mapRef
    }, contents);
}
const MapContainer = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["forwardRef"])(MapContainerComponent);
}),
"[project]/node_modules/@react-leaflet/core/lib/grid-layer.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "updateGridLayer",
    ()=>updateGridLayer
]);
function updateGridLayer(layer, props, prevProps) {
    const { opacity, zIndex } = props;
    if (opacity != null && opacity !== prevProps.opacity) {
        layer.setOpacity(opacity);
    }
    if (zIndex != null && zIndex !== prevProps.zIndex) {
        layer.setZIndex(zIndex);
    }
}
}),
"[project]/node_modules/react-leaflet/lib/TileLayer.js [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TileLayer",
    ()=>TileLayer
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$element$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@react-leaflet/core/lib/element.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$generic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@react-leaflet/core/lib/generic.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$grid$2d$layer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@react-leaflet/core/lib/grid-layer.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$pane$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@react-leaflet/core/lib/pane.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/leaflet/dist/leaflet-src.js [app-client] (ecmascript)");
;
;
const TileLayer = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$generic$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createTileLayerComponent"])(function createTileLayer({ url, ...options }, context) {
    const layer = new __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$leaflet$2f$dist$2f$leaflet$2d$src$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["TileLayer"](url, (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$pane$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["withPane"])(options, context));
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$element$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createElementObject"])(layer, context);
}, function updateTileLayer(layer, props, prevProps) {
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$react$2d$leaflet$2f$core$2f$lib$2f$grid$2d$layer$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["updateGridLayer"])(layer, props, prevProps);
    const { url } = props;
    if (url != null && url !== prevProps.url) {
        layer.setUrl(url);
    }
});
}),
]);

//# sourceMappingURL=_5f345c0e._.js.map