module.exports = [
"[externals]/next/dist/compiled/next-server/app-page-turbo.runtime.dev.js [external] (next/dist/compiled/next-server/app-page-turbo.runtime.dev.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js", () => require("next/dist/compiled/next-server/app-page-turbo.runtime.dev.js"));

module.exports = mod;
}),
"[project]/Documents/test/hiking-route-planner/src/components/ui/Button.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Button",
    ()=>Button
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
const variantClasses = {
    primary: "bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-emerald-300",
    secondary: "bg-slate-200 text-slate-900 hover:bg-slate-300 disabled:bg-slate-100",
    ghost: "bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
    danger: "bg-rose-600 text-white hover:bg-rose-500 disabled:bg-rose-300"
};
function Button({ variant = "primary", fullWidth = false, className = "", children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
        className: `inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`,
        ...props,
        children: children
    }, void 0, false, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/ui/Button.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Card",
    ()=>Card
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function Card({ className = "", children, ...props }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: `rounded-lg border border-slate-200 bg-white p-4 shadow-sm ${className}`,
        ...props,
        children: children
    }, void 0, false, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx",
        lineNumber: 7,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/ui/LoadingSpinner.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "LoadingSpinner",
    ()=>LoadingSpinner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function LoadingSpinner({ size = "md" }) {
    const dimensions = size === "sm" ? "h-4 w-4" : "h-6 w-6";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
        className: `${dimensions} inline-block animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600`,
        "aria-label": "Loading"
    }, void 0, false, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/ui/LoadingSpinner.tsx",
        lineNumber: 9,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/ui/Slider.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Slider",
    ()=>Slider
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function Slider({ min, max, step = 1, value, onChange }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
        type: "range",
        min: min,
        max: max,
        step: step,
        value: value,
        onChange: (event)=>onChange(Number(event.target.value)),
        className: "h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600"
    }, void 0, false, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/ui/Slider.tsx",
        lineNumber: 11,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/ui/Toggle.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "Toggle",
    ()=>Toggle
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function Toggle({ checked, onChange, label }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
        className: "flex cursor-pointer items-center justify-between gap-3 text-sm",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                className: "text-slate-700",
                children: label
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/ui/Toggle.tsx",
                lineNumber: 10,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                className: `relative h-6 w-11 rounded-full transition ${checked ? "bg-emerald-600" : "bg-slate-300"}`,
                onClick: ()=>onChange(!checked),
                "aria-pressed": checked,
                "aria-label": label,
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: `absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-5" : "left-0.5"}`
                }, void 0, false, {
                    fileName: "[project]/Documents/test/hiking-route-planner/src/components/ui/Toggle.tsx",
                    lineNumber: 20,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/ui/Toggle.tsx",
                lineNumber: 11,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/ui/Toggle.tsx",
        lineNumber: 9,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$LoadingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/LoadingSpinner.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Slider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Slider.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Toggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Toggle.tsx [app-ssr] (ecmascript)");
;
;
;
;
;
}),
"[project]/Documents/test/hiking-route-planner/src/components/constraints/MaxDistanceInput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "MaxDistanceInput",
    ()=>MaxDistanceInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Slider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Slider.tsx [app-ssr] (ecmascript)");
"use client";
;
;
function MaxDistanceInput({ value, onChange }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between text-sm",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "text-slate-600",
                        children: "Max distance"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/MaxDistanceInput.tsx",
                        lineNumber: 14,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "font-semibold text-slate-900",
                        children: [
                            value,
                            " km"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/MaxDistanceInput.tsx",
                        lineNumber: 15,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/MaxDistanceInput.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Slider$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Slider"], {
                min: 1,
                max: 60,
                step: 1,
                value: value,
                onChange: onChange
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/MaxDistanceInput.tsx",
                lineNumber: 17,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/MaxDistanceInput.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/constraints/TimeWindowInput.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TimeWindowInput",
    ()=>TimeWindowInput
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
"use client";
;
function TimeWindowInput({ value, onChange }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "space-y-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-sm text-slate-600",
                children: "Default time window"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/TimeWindowInput.tsx",
                lineNumber: 13,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "time",
                        value: value?.start ?? "",
                        onChange: (event)=>onChange({
                                start: event.target.value,
                                end: value?.end ?? event.target.value
                            }),
                        className: "rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/TimeWindowInput.tsx",
                        lineNumber: 15,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "time",
                        value: value?.end ?? "",
                        onChange: (event)=>onChange({
                                start: value?.start ?? event.target.value,
                                end: event.target.value
                            }),
                        className: "rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/TimeWindowInput.tsx",
                        lineNumber: 26,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/TimeWindowInput.tsx",
                lineNumber: 14,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                type: "button",
                onClick: ()=>onChange(undefined),
                className: "text-xs text-slate-500 underline underline-offset-2",
                children: "Clear default window"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/TimeWindowInput.tsx",
                lineNumber: 38,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/TimeWindowInput.tsx",
        lineNumber: 12,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "ConstraintPanel",
    ()=>ConstraintPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$LoadingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/LoadingSpinner.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Toggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Toggle.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$MaxDistanceInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/constraints/MaxDistanceInput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$TimeWindowInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/constraints/TimeWindowInput.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function ConstraintPanel({ constraints, isCalculating, onToggleMaxDistance, onSetMaxDistanceKm, onToggleTimeWindows, onSetDefaultTimeWindow, onToggleFixedStartEnd, onCalculateRoute }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "space-y-4",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-base font-semibold text-slate-900",
                        children: "Constraints"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                        lineNumber: 33,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-slate-500",
                        children: "Configure optimization conditions before route calculation."
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                        lineNumber: 34,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                lineNumber: 32,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Toggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Toggle"], {
                        checked: constraints.maxDistance.enabled,
                        onChange: onToggleMaxDistance,
                        label: "Enable max distance"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this),
                    constraints.maxDistance.enabled && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$MaxDistanceInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["MaxDistanceInput"], {
                        value: constraints.maxDistance.maxKm,
                        onChange: onSetMaxDistanceKm
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                        lineNumber: 46,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                lineNumber: 39,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Toggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Toggle"], {
                        checked: constraints.timeWindows.enabled,
                        onChange: onToggleTimeWindows,
                        label: "Enable time windows"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                        lineNumber: 54,
                        columnNumber: 9
                    }, this),
                    constraints.timeWindows.enabled && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$TimeWindowInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TimeWindowInput"], {
                        value: constraints.timeWindows.defaultWindow,
                        onChange: onSetDefaultTimeWindow
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                        lineNumber: 60,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                lineNumber: 53,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Toggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Toggle"], {
                checked: constraints.fixedStartEnd.enabled,
                onChange: onToggleFixedStartEnd,
                label: "Respect Start/End markers"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                lineNumber: 67,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                onClick: onCalculateRoute,
                fullWidth: true,
                disabled: isCalculating,
                children: isCalculating ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "inline-flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$LoadingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LoadingSpinner"], {
                            size: "sm"
                        }, void 0, false, {
                            fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                            lineNumber: 76,
                            columnNumber: 13
                        }, this),
                        "Calculating..."
                    ]
                }, void 0, true, {
                    fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                    lineNumber: 75,
                    columnNumber: 11
                }, this) : "Calculate Route"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
                lineNumber: 73,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx",
        lineNumber: 31,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/constraints/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$ConstraintPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$MaxDistanceInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/constraints/MaxDistanceInput.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$TimeWindowInput$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/constraints/TimeWindowInput.tsx [app-ssr] (ecmascript)");
;
;
;
}),
"[externals]/next/dist/server/app-render/work-async-storage.external.js [external] (next/dist/server/app-render/work-async-storage.external.js, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("next/dist/server/app-render/work-async-storage.external.js", () => require("next/dist/server/app-render/work-async-storage.external.js"));

module.exports = mod;
}),
"[project]/Documents/test/hiking-route-planner/src/components/map/DynamicMap.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DynamicMap",
    ()=>DynamicMap
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/shared/lib/app-dynamic.js [app-ssr] (ecmascript)");
;
;
;
const DynamicMap = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$shared$2f$lib$2f$app$2d$dynamic$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["default"])(async ()=>{}, {
    loadableGenerated: {
        modules: [
            "[project]/Documents/test/hiking-route-planner/src/components/map/MapView.tsx [app-client] (ecmascript, next/dynamic entry)"
        ]
    },
    ssr: false,
    loading: ()=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex h-full w-full items-center justify-center bg-slate-100 text-slate-500",
            children: "Loading map..."
        }, void 0, false, {
            fileName: "[project]/Documents/test/hiking-route-planner/src/components/map/DynamicMap.tsx",
            lineNumber: 6,
            columnNumber: 5
        }, ("TURBOPACK compile-time value", void 0))
});
;
}),
"[project]/Documents/test/hiking-route-planner/src/components/map/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$map$2f$DynamicMap$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/map/DynamicMap.tsx [app-ssr] (ecmascript)");
;
}),
"[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "HikeSearchPanel",
    ()=>HikeSearchPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$LoadingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/LoadingSpinner.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Toggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Toggle.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function parseCoordinate(value) {
    const normalized = value.trim();
    if (normalized === "") {
        return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}
function isValidLatitude(value) {
    return value >= -90 && value <= 90;
}
function isValidLongitude(value) {
    return value >= -180 && value <= 180;
}
function HikeSearchPanel({ isSearching, originLatValue, originLngValue, onOriginInputChange, useMapClickForOrigin, onUseMapClickForOriginChange, onFindHike }) {
    const [endpointLat, setEndpointLat] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [endpointLng, setEndpointLng] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [maxDistanceKm, setMaxDistanceKm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [maxStartDistanceKm, setMaxStartDistanceKm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [maxFinishDistanceFromOriginKm, setMaxFinishDistanceFromOriginKm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [desiredRouteCount, setDesiredRouteCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("1");
    const [originLatError, setOriginLatError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [originLngError, setOriginLngError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [endpointLatError, setEndpointLatError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [endpointLngError, setEndpointLngError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [maxDistanceError, setMaxDistanceError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [maxStartDistanceError, setMaxStartDistanceError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [maxFinishDistanceFromOriginError, setMaxFinishDistanceFromOriginError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [desiredRouteCountError, setDesiredRouteCountError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [summaryError, setSummaryError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [locationError, setLocationError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isDetectingLocation, setIsDetectingLocation] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const detectMyLocation = ()=>{
        setLocationError(null);
        if (typeof navigator === "undefined" || !navigator.geolocation) {
            setLocationError("Location is not supported on this device/browser.");
            return;
        }
        setIsDetectingLocation(true);
        navigator.geolocation.getCurrentPosition((position)=>{
            onOriginInputChange({
                lat: position.coords.latitude.toFixed(6),
                lng: position.coords.longitude.toFixed(6)
            });
            setIsDetectingLocation(false);
        }, (error)=>{
            const message = error.code === error.PERMISSION_DENIED ? "Location permission was denied. Enable location access and try again." : "Could not detect your location. Please try again or enter coordinates manually.";
            setLocationError(message);
            setIsDetectingLocation(false);
        }, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        });
    };
    const submit = ()=>{
        setOriginLatError(null);
        setOriginLngError(null);
        setEndpointLatError(null);
        setEndpointLngError(null);
        setMaxDistanceError(null);
        setMaxStartDistanceError(null);
        setMaxFinishDistanceFromOriginError(null);
        setDesiredRouteCountError(null);
        setSummaryError(null);
        const parsedOriginLat = parseCoordinate(originLatValue);
        const parsedOriginLng = parseCoordinate(originLngValue);
        let hasError = false;
        if (parsedOriginLat === null) {
            setOriginLatError("Origin latitude is required.");
            hasError = true;
        } else if (!isValidLatitude(parsedOriginLat)) {
            setOriginLatError("Latitude must be between -90 and 90.");
            hasError = true;
        }
        if (parsedOriginLng === null) {
            setOriginLngError("Origin longitude is required.");
            hasError = true;
        } else if (!isValidLongitude(parsedOriginLng)) {
            setOriginLngError("Longitude must be between -180 and 180.");
            hasError = true;
        }
        const hasEndpoint = endpointLat.trim() !== "" || endpointLng.trim() !== "";
        const parsedEndpointLat = parseCoordinate(endpointLat);
        const parsedEndpointLng = parseCoordinate(endpointLng);
        if (hasEndpoint && parsedEndpointLat === null) {
            setEndpointLatError("Endpoint latitude is required.");
            hasError = true;
        } else if (hasEndpoint && parsedEndpointLat !== null && !isValidLatitude(parsedEndpointLat)) {
            setEndpointLatError("Latitude must be between -90 and 90.");
            hasError = true;
        }
        if (hasEndpoint && parsedEndpointLng === null) {
            setEndpointLngError("Endpoint longitude is required.");
            hasError = true;
        } else if (hasEndpoint && parsedEndpointLng !== null && !isValidLongitude(parsedEndpointLng)) {
            setEndpointLngError("Longitude must be between -180 and 180.");
            hasError = true;
        }
        const parsedMaxDistance = parseCoordinate(maxDistanceKm);
        if (maxDistanceKm.trim() !== "" && parsedMaxDistance === null) {
            setMaxDistanceError("Max distance must be a valid number.");
            hasError = true;
        } else if (parsedMaxDistance !== null && parsedMaxDistance <= 0) {
            setMaxDistanceError("Max distance must be greater than 0.");
            hasError = true;
        }
        const parsedMaxStartDistance = parseCoordinate(maxStartDistanceKm);
        if (maxStartDistanceKm.trim() !== "" && parsedMaxStartDistance === null) {
            setMaxStartDistanceError("Max start distance must be a valid number.");
            hasError = true;
        } else if (parsedMaxStartDistance !== null && parsedMaxStartDistance <= 0) {
            setMaxStartDistanceError("Max start distance must be greater than 0.");
            hasError = true;
        }
        const parsedMaxFinishDistanceFromOrigin = parseCoordinate(maxFinishDistanceFromOriginKm);
        if (maxFinishDistanceFromOriginKm.trim() !== "" && parsedMaxFinishDistanceFromOrigin === null) {
            setMaxFinishDistanceFromOriginError("Max finish distance must be a valid number.");
            hasError = true;
        } else if (parsedMaxFinishDistanceFromOrigin !== null && parsedMaxFinishDistanceFromOrigin <= 0) {
            setMaxFinishDistanceFromOriginError("Max finish distance must be greater than 0.");
            hasError = true;
        }
        const normalizedRouteCount = desiredRouteCount.trim();
        const parsedDesiredRouteCount = Number(normalizedRouteCount);
        if (normalizedRouteCount === "" || !Number.isInteger(parsedDesiredRouteCount)) {
            setDesiredRouteCountError("Nearby route count must be a whole number.");
            hasError = true;
        } else if (parsedDesiredRouteCount <= 0) {
            setDesiredRouteCountError("Nearby route count must be at least 1.");
            hasError = true;
        } else if (parsedDesiredRouteCount > 5) {
            setDesiredRouteCountError("Nearby route count must be 5 or less.");
            hasError = true;
        }
        if (hasError) {
            setSummaryError("Please fix highlighted fields.");
            return;
        }
        onFindHike({
            origin: {
                lat: parsedOriginLat,
                lng: parsedOriginLng
            },
            endpoint: hasEndpoint && parsedEndpointLat !== null && parsedEndpointLng !== null ? {
                lat: parsedEndpointLat,
                lng: parsedEndpointLng
            } : undefined,
            maxDistanceKm: parsedMaxDistance ?? undefined,
            maxStartDistanceKm: parsedMaxStartDistance ?? undefined,
            maxFinishDistanceFromOriginKm: parsedMaxFinishDistanceFromOrigin ?? undefined,
            desiredRouteCount: Number(desiredRouteCount)
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-base font-semibold text-slate-900",
                        children: "Find me a hike"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 235,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-slate-500",
                        children: "RTG-first trail search with automatic fallback routing."
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 236,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Toggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Toggle"], {
                                checked: useMapClickForOrigin,
                                onChange: onUseMapClickForOriginChange,
                                label: "Map click sets origin"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                                lineNumber: 240,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 text-[11px] text-slate-500",
                                children: useMapClickForOrigin ? "Click on the map to update origin coordinates." : "Enable this to pick origin by clicking on the map."
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                                lineNumber: 245,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 239,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                variant: "secondary",
                                onClick: detectMyLocation,
                                disabled: isSearching || isDetectingLocation,
                                fullWidth: true,
                                children: isDetectingLocation ? "Detecting location..." : "Use my current location"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                                lineNumber: 252,
                                columnNumber: 11
                            }, this),
                            locationError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 text-xs text-rose-700",
                                children: locationError
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                                lineNumber: 260,
                                columnNumber: 29
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 251,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 234,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "text",
                        value: originLatValue,
                        onChange: (event)=>{
                            onOriginInputChange({
                                lat: event.target.value,
                                lng: originLngValue
                            });
                        },
                        placeholder: "Origin lat",
                        className: "rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 265,
                        columnNumber: 9
                    }, this),
                    originLatError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-rose-700",
                        children: originLatError
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 277,
                        columnNumber: 28
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "text",
                        value: originLngValue,
                        onChange: (event)=>{
                            onOriginInputChange({
                                lat: originLatValue,
                                lng: event.target.value
                            });
                        },
                        placeholder: "Origin lng",
                        className: "rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 278,
                        columnNumber: 9
                    }, this),
                    originLngError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-rose-700",
                        children: originLngError
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 290,
                        columnNumber: 28
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 264,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "text",
                        value: endpointLat,
                        onChange: (event)=>setEndpointLat(event.target.value),
                        placeholder: "Endpoint lat (optional)",
                        className: "rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 294,
                        columnNumber: 9
                    }, this),
                    endpointLatError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-rose-700",
                        children: endpointLatError
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 301,
                        columnNumber: 30
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "text",
                        value: endpointLng,
                        onChange: (event)=>setEndpointLng(event.target.value),
                        placeholder: "Endpoint lng (optional)",
                        className: "rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 302,
                        columnNumber: 9
                    }, this),
                    endpointLngError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-rose-700",
                        children: endpointLngError
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                        lineNumber: 309,
                        columnNumber: 30
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 293,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "text",
                value: maxDistanceKm,
                onChange: (event)=>setMaxDistanceKm(event.target.value),
                placeholder: "Max distance km (optional)",
                className: "w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 312,
                columnNumber: 7
            }, this),
            maxDistanceError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-rose-700",
                children: maxDistanceError
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 319,
                columnNumber: 28
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "text",
                value: maxStartDistanceKm,
                onChange: (event)=>setMaxStartDistanceKm(event.target.value),
                placeholder: "Max start distance km (optional)",
                className: "w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 321,
                columnNumber: 7
            }, this),
            maxStartDistanceError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-rose-700",
                children: maxStartDistanceError
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 329,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "text",
                value: maxFinishDistanceFromOriginKm,
                onChange: (event)=>setMaxFinishDistanceFromOriginKm(event.target.value),
                placeholder: "Max finish distance from origin km (optional)",
                className: "w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 332,
                columnNumber: 7
            }, this),
            maxFinishDistanceFromOriginError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-rose-700",
                children: maxFinishDistanceFromOriginError
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 340,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "text",
                value: desiredRouteCount,
                onChange: (event)=>setDesiredRouteCount(event.target.value),
                placeholder: "Nearby route count (default 1)",
                className: "w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 343,
                columnNumber: 7
            }, this),
            desiredRouteCountError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-xs text-rose-700",
                children: desiredRouteCountError
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 351,
                columnNumber: 9
            }, this),
            summaryError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "rounded-md bg-rose-50 p-2 text-xs text-rose-700",
                children: summaryError
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 355,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                onClick: submit,
                disabled: isSearching,
                fullWidth: true,
                children: isSearching ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "inline-flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$LoadingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LoadingSpinner"], {
                            size: "sm"
                        }, void 0, false, {
                            fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                            lineNumber: 361,
                            columnNumber: 13
                        }, this),
                        "Searching..."
                    ]
                }, void 0, true, {
                    fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                    lineNumber: 360,
                    columnNumber: 11
                }, this) : "Find Best Hike"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
                lineNumber: 358,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx",
        lineNumber: 233,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/Documents/test/hiking-route-planner/src/lib/utils/time.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RouteStats",
    ()=>RouteStats
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$time$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/time.ts [app-ssr] (ecmascript)");
;
;
;
;
function RouteStats({ totalDistanceMeters, totalDurationSeconds, stopsCount }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "grid grid-cols-3 gap-2",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                className: "p-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-slate-500",
                        children: "Distance"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
                        lineNumber: 19,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm font-semibold text-slate-900",
                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatDistance"])(totalDistanceMeters)
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
                        lineNumber: 20,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
                lineNumber: 18,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                className: "p-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-slate-500",
                        children: "Duration"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
                        lineNumber: 25,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm font-semibold text-slate-900",
                        children: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$time$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatDuration"])(totalDurationSeconds)
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
                        lineNumber: 26,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
                lineNumber: 24,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                className: "p-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs text-slate-500",
                        children: "Stops"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
                        lineNumber: 31,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-sm font-semibold text-slate-900",
                        children: stopsCount
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
                        lineNumber: 32,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
                lineNumber: 30,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx",
        lineNumber: 17,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "RouteResults",
    ()=>RouteResults
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$time$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/time.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$RouteStats$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx [app-ssr] (ecmascript)");
;
;
;
;
;
function RouteResults({ route, error }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-base font-semibold text-slate-900",
                        children: "Route Results"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                        lineNumber: 17,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-slate-500",
                        children: "Calculated path and stop sequence"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                        lineNumber: 18,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                lineNumber: 16,
                columnNumber: 7
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-md bg-rose-50 p-2 text-sm text-rose-700",
                children: error
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                lineNumber: 21,
                columnNumber: 17
            }, this),
            !route && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "rounded-md bg-slate-50 p-2 text-sm text-slate-500",
                children: "Calculate a route to see results."
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                lineNumber: 24,
                columnNumber: 9
            }, this),
            route && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    route.sourceLabel && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "inline-flex rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700",
                        children: route.sourceLabel
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                        lineNumber: 32,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$RouteStats$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RouteStats"], {
                        totalDistanceMeters: route.totalDistanceMeters,
                        totalDurationSeconds: route.totalDurationSeconds,
                        stopsCount: route.orderedWaypoints.length
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                        lineNumber: 37,
                        columnNumber: 11
                    }, this),
                    route.warnings.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                        className: "space-y-1 rounded-md bg-amber-50 p-2 text-xs text-amber-700",
                        children: route.warnings.map((warning)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                children: warning
                            }, warning, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                                lineNumber: 46,
                                columnNumber: 17
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                        lineNumber: 44,
                        columnNumber: 13
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "text-sm font-semibold text-slate-700",
                                children: "Stop order"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                                lineNumber: 52,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                                className: "space-y-1",
                                children: route.orderedWaypoints.map((waypoint, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        className: "rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700",
                                        children: [
                                            index + 1,
                                            ". ",
                                            waypoint.name
                                        ]
                                    }, waypoint.id, true, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                                        lineNumber: 55,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                                lineNumber: 53,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                        lineNumber: 51,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "space-y-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "text-sm font-semibold text-slate-700",
                                children: "Segments"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                                lineNumber: 66,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: "space-y-1 text-xs text-slate-600",
                                children: route.segments.map((segment)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: [
                                            segment.from.name,
                                            " → ",
                                            segment.to.name,
                                            " (",
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatDistance"])(segment.distanceMeters),
                                            ", ",
                                            (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$time$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatDuration"])(segment.durationSeconds),
                                            ")"
                                        ]
                                    }, `${segment.from.id}-${segment.to.id}`, true, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                                        lineNumber: 69,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                                lineNumber: 67,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                        lineNumber: 65,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
                lineNumber: 30,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "TrailIntelligencePanel",
    ()=>TrailIntelligencePanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
;
;
const levelClasses = {
    go: "bg-emerald-50 text-emerald-700 border-emerald-200",
    caution: "bg-amber-50 text-amber-700 border-amber-200",
    "no-go": "bg-rose-50 text-rose-700 border-rose-200"
};
function ItemSection({ item }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "space-y-2 rounded-lg border border-slate-200 p-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                        className: "text-sm font-semibold text-slate-800",
                        children: item.title
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 24,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-600",
                        children: item.sourceStatus
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 25,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                lineNumber: 23,
                columnNumber: 7
            }, this),
            item.level && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: `inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${levelClasses[item.level]}`,
                children: item.level
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                lineNumber: 30,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm text-slate-700",
                children: item.summary
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                lineNumber: 36,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "space-y-1 text-xs text-slate-600",
                children: item.details.map((detail)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: detail
                    }, detail, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 39,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                lineNumber: 37,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
        lineNumber: 22,
        columnNumber: 5
    }, this);
}
function TrailIntelligencePanel({ report, isLoading, error }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-base font-semibold text-slate-900",
                        children: "Trail Briefing"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 54,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-slate-500",
                        children: "Route context, timing guidance, and safety confidence."
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 55,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                lineNumber: 53,
                columnNumber: 7
            }, this),
            isLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "rounded-md bg-slate-50 p-3 text-sm text-slate-500",
                children: "Building route briefing..."
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                lineNumber: 61,
                columnNumber: 9
            }, this),
            error && !isLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-md bg-rose-50 p-3 text-sm text-rose-700",
                children: error
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                lineNumber: 67,
                columnNumber: 9
            }, this),
            !report && !isLoading && !error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "rounded-md bg-slate-50 p-3 text-sm text-slate-500",
                children: "Select or calculate a route to see the trail briefing."
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                lineNumber: 71,
                columnNumber: 9
            }, this),
            report && !isLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-3",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: `rounded-lg border p-3 ${levelClasses[report.recommendation.level]}`,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center justify-between gap-2",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                        className: "text-sm font-semibold",
                                        children: report.recommendation.title
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                        lineNumber: 80,
                                        columnNumber: 15
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-[11px] uppercase tracking-wide",
                                        children: report.regionLabel
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                        lineNumber: 81,
                                        columnNumber: 15
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                lineNumber: 79,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                className: "mt-1 text-sm",
                                children: report.recommendation.summary
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                lineNumber: 85,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: "mt-2 space-y-1 text-xs",
                                children: report.recommendation.reasons.map((reason)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        children: reason
                                    }, reason, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                        lineNumber: 88,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                lineNumber: 86,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 78,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ItemSection, {
                        item: report.routeSummary
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 93,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ItemSection, {
                        item: report.bestTime
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 94,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ItemSection, {
                        item: report.currentConditions
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 95,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(ItemSection, {
                        item: report.safety
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 96,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "space-y-2 rounded-lg border border-slate-200 p-3",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h3", {
                                className: "text-sm font-semibold text-slate-800",
                                children: "Source coverage"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                lineNumber: 99,
                                columnNumber: 13
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                className: "space-y-2 text-xs text-slate-600",
                                children: report.sourceNotes.map((note)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                                        className: "rounded-md bg-slate-50 p-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "font-medium text-slate-700",
                                                children: [
                                                    note.source,
                                                    " ",
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-slate-400",
                                                        children: [
                                                            "(",
                                                            note.status,
                                                            ")"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                                        lineNumber: 104,
                                                        columnNumber: 35
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                                lineNumber: 103,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                children: note.summary
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                                lineNumber: 106,
                                                columnNumber: 19
                                            }, this)
                                        ]
                                    }, note.source, true, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                        lineNumber: 102,
                                        columnNumber: 17
                                    }, this))
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                                lineNumber: 100,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                        lineNumber: 98,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
                lineNumber: 77,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx",
        lineNumber: 52,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/WalkSettingsPanel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalkSettingsPanel",
    ()=>WalkSettingsPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function WalkSettingsPanel({ settings, onChange }) {
    const intervalSeconds = Math.round(settings.paceCheckIntervalMs / 1000);
    const handleIntervalChange = (event)=>{
        const seconds = Number(event.target.value);
        if (Number.isNaN(seconds)) {
            return;
        }
        onChange({
            paceCheckIntervalMs: seconds * 1000
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "flex items-center justify-between gap-3 text-sm text-slate-700",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: "Auto re-route on slow pace"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkSettingsPanel.tsx",
                        lineNumber: 29,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "checkbox",
                        checked: settings.paceCheckEnabled,
                        onChange: (event)=>onChange({
                                paceCheckEnabled: event.target.checked
                            }),
                        className: "h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkSettingsPanel.tsx",
                        lineNumber: 30,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkSettingsPanel.tsx",
                lineNumber: 28,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                className: "space-y-1 text-sm text-slate-700",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "block",
                        children: "Check interval (min 30s)"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkSettingsPanel.tsx",
                        lineNumber: 39,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "number",
                        min: 30,
                        value: intervalSeconds,
                        onChange: handleIntervalChange,
                        className: "w-full rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 outline-none ring-emerald-500 transition focus:ring-2 sm:text-sm"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkSettingsPanel.tsx",
                        lineNumber: 40,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkSettingsPanel.tsx",
                lineNumber: 38,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkSettingsPanel.tsx",
        lineNumber: 27,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalkCompanionPanel",
    ()=>WalkCompanionPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$LoadingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/LoadingSpinner.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$WalkSettingsPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/WalkSettingsPanel.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
const PACE_OPTIONS = [
    {
        label: "Slow (20 min/km)",
        value: 20
    },
    {
        label: "Normal (15 min/km)",
        value: 15
    },
    {
        label: "Brisk (12 min/km)",
        value: 12
    }
];
const CATEGORY_OPTIONS = [
    {
        label: "Landmarks",
        value: "landmark"
    },
    {
        label: "Museums",
        value: "museum"
    },
    {
        label: "Parks",
        value: "park"
    },
    {
        label: "Food & Cafes",
        value: "food"
    },
    {
        label: "Viewpoints",
        value: "viewpoint"
    },
    {
        label: "Religious sites",
        value: "religious"
    },
    {
        label: "Nature",
        value: "nature"
    },
    {
        label: "Entertainment",
        value: "entertainment"
    }
];
function WalkCompanionPanel({ isLoading, onBuildWalk, walkSettings, onWalkSettingsChange, mapClickedCoords, onLocationDetected, onStartWalk, onStopWalk, walkPlanReady = false, isWalking = false }) {
    const [lat, setLat] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [lng, setLng] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [availableMinutes, setAvailableMinutes] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("90");
    const [pace, setPace] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(15);
    const [radiusKm, setRadiusKm] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("2");
    const [selectedCategories, setSelectedCategories] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isDetecting, setIsDetecting] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [locationError, setLocationError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [formError, setFormError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (!mapClickedCoords) {
            return;
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLat(mapClickedCoords.lat.toFixed(6));
        setLng(mapClickedCoords.lng.toFixed(6));
    }, [
        mapClickedCoords
    ]);
    const detectLocation = ()=>{
        setLocationError(null);
        if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
        ;
        if (!navigator.geolocation) {
            setLocationError("Geolocation not supported on this device.");
            return;
        }
        setIsDetecting(true);
        navigator.geolocation.getCurrentPosition((pos)=>{
            const coords = {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            };
            setLat(coords.lat.toFixed(6));
            setLng(coords.lng.toFixed(6));
            onLocationDetected?.(coords);
            setIsDetecting(false);
        }, ()=>{
            setLocationError("Could not detect location. Enter coordinates manually.");
            setIsDetecting(false);
        }, {
            enableHighAccuracy: true,
            timeout: 10000
        });
    };
    const toggleCategory = (cat)=>{
        setSelectedCategories((prev)=>prev.includes(cat) ? prev.filter((c)=>c !== cat) : [
                ...prev,
                cat
            ]);
    };
    const submit = ()=>{
        setFormError(null);
        const parsedLat = parseFloat(lat);
        const parsedLng = parseFloat(lng);
        const parsedMinutes = parseInt(availableMinutes, 10);
        const parsedRadiusKm = parseFloat(radiusKm);
        if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
            setFormError("Enter a valid latitude (-90 to 90).");
            return;
        }
        if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
            setFormError("Enter a valid longitude (-180 to 180).");
            return;
        }
        if (!Number.isFinite(parsedMinutes) || parsedMinutes <= 0) {
            setFormError("Enter a valid duration (minutes > 0).");
            return;
        }
        if (!Number.isFinite(parsedRadiusKm) || parsedRadiusKm <= 0) {
            setFormError("Enter a valid search radius (km > 0).");
            return;
        }
        onBuildWalk({
            origin: {
                lat: parsedLat,
                lng: parsedLng
            },
            availableMinutes: parsedMinutes,
            walkingPaceMinPerKm: pace,
            radiusMeters: parsedRadiusKm * 1000,
            preferredCategories: selectedCategories.length > 0 ? selectedCategories : undefined
        });
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-base font-semibold text-slate-900",
                        children: "City Walk Companion"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 162,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-slate-500",
                        children: "Tell us where you are and how long you have — we'll build a smart walk."
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 163,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 161,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                        variant: "secondary",
                        fullWidth: true,
                        onClick: detectLocation,
                        disabled: isDetecting || isLoading,
                        children: isDetecting ? "Detecting…" : "Use my current location"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 170,
                        columnNumber: 9
                    }, this),
                    locationError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-rose-700",
                        children: locationError
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 179,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-2 gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "text",
                                value: lat,
                                onChange: (e)=>setLat(e.target.value),
                                placeholder: "Latitude",
                                className: "rounded-md border border-slate-300 px-2 py-2 text-base sm:text-sm focus:border-emerald-500 focus:outline-none"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                                lineNumber: 182,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "text",
                                value: lng,
                                onChange: (e)=>setLng(e.target.value),
                                placeholder: "Longitude",
                                className: "rounded-md border border-slate-300 px-2 py-2 text-base sm:text-sm focus:border-emerald-500 focus:outline-none"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                                lineNumber: 189,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 181,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 169,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "text-xs font-medium text-slate-700",
                        children: "Time available (minutes)"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 201,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "number",
                        min: 15,
                        max: 480,
                        value: availableMinutes,
                        onChange: (e)=>setAvailableMinutes(e.target.value),
                        className: "w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 204,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 200,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "text-xs font-medium text-slate-700",
                        children: "Search radius (km)"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 216,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                        type: "number",
                        min: 0.5,
                        max: 10,
                        step: 0.5,
                        value: radiusKm,
                        onChange: (e)=>setRadiusKm(e.target.value),
                        className: "w-full rounded-md border border-slate-300 px-2 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 219,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 215,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "text-xs font-medium text-slate-700",
                        children: "Walking pace"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 232,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-3 gap-1",
                        children: PACE_OPTIONS.map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>setPace(opt.value),
                                className: `rounded-md border px-2 py-3 text-xs font-medium transition sm:py-1.5 ${pace === opt.value ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`,
                                children: opt.label
                            }, opt.value, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                                lineNumber: 235,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 233,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 231,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                        className: "text-xs font-medium text-slate-700",
                        children: [
                            "Interests",
                            " ",
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "font-normal text-slate-400",
                                children: "(optional)"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                                lineNumber: 254,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 252,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-wrap gap-1",
                        children: CATEGORY_OPTIONS.map((opt)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                onClick: ()=>toggleCategory(opt.value),
                                className: `rounded-full border px-3 py-2 text-xs transition sm:px-2 sm:py-1 ${selectedCategories.includes(opt.value) ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"}`,
                                children: opt.label
                            }, opt.value, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                                lineNumber: 258,
                                columnNumber: 13
                            }, this))
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                        lineNumber: 256,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 251,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$WalkSettingsPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WalkSettingsPanel"], {
                settings: walkSettings,
                onChange: onWalkSettingsChange
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 274,
                columnNumber: 7
            }, this),
            formError && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "rounded-md bg-rose-50 p-2 text-xs text-rose-700",
                children: formError
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 277,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                onClick: submit,
                disabled: isLoading,
                fullWidth: true,
                children: isLoading ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "inline-flex items-center gap-2",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$LoadingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LoadingSpinner"], {
                            size: "sm"
                        }, void 0, false, {
                            fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                            lineNumber: 285,
                            columnNumber: 13
                        }, this),
                        "Building walk…"
                    ]
                }, void 0, true, {
                    fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                    lineNumber: 284,
                    columnNumber: 11
                }, this) : "Build My Walk"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 282,
                columnNumber: 7
            }, this),
            isWalking ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                onClick: ()=>onStopWalk?.(),
                variant: "danger",
                fullWidth: true,
                children: "End Walk"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 293,
                columnNumber: 9
            }, this) : walkPlanReady ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                onClick: ()=>onStartWalk?.(),
                disabled: isLoading,
                fullWidth: true,
                children: "Start Walk"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
                lineNumber: 301,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx",
        lineNumber: 160,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/constants/categories.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "CATEGORY_EMOJI",
    ()=>CATEGORY_EMOJI
]);
const CATEGORY_EMOJI = {
    landmark: "🏛",
    museum: "🖼",
    park: "🌳",
    food: "☕",
    viewpoint: "👁",
    religious: "🕍",
    shopping: "🛍",
    entertainment: "🎭",
    nature: "🌿",
    other: "📍"
};
}),
"[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalkPlanResults",
    ()=>WalkPlanResults
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$constants$2f$categories$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/constants/categories.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function WalkPlanResults({ plan, error, walkOrigin, walkMinutes, walkRadius }) {
    if (error) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm text-rose-700",
                children: error
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                lineNumber: 20,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
            lineNumber: 19,
            columnNumber: 7
        }, this);
    }
    if (!plan) return null;
    if (!plan.feasible || plan.orderedAttractions.length === 0) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "text-sm text-slate-600",
                children: "No attractions found in this area for your time budget. Try increasing the search radius or available time."
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                lineNumber: 30,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
            lineNumber: 29,
            columnNumber: 7
        }, this);
    }
    const walkingMinutes = plan.segments.reduce((sum, s)=>sum + s.walkingMinutes, 0);
    const visitMinutes = plan.orderedAttractions.reduce((sum, a)=>sum + a.avgVisitMinutes, 0);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-base font-semibold text-slate-900",
                        children: "Your Walk Plan"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                        lineNumber: 50,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "mt-1 flex gap-3 text-xs text-slate-500",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    "🕐 ",
                                    Math.round(plan.totalMinutes),
                                    " min total"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 52,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    "🚶 ",
                                    Math.round(walkingMinutes),
                                    " min walking"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 53,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    "📍 ",
                                    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatDistance"])(plan.totalDistanceMeters)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 54,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                        lineNumber: 51,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                lineNumber: 49,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ol", {
                className: "space-y-2",
                children: plan.orderedAttractions.map((attraction, index)=>{
                    const segment = plan.segments[index];
                    const emoji = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$constants$2f$categories$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CATEGORY_EMOJI"][attraction.category] ?? "📍";
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: "flex gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700",
                                children: index + 1
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 66,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-sm font-medium text-slate-900",
                                        children: [
                                            emoji,
                                            " ",
                                            attraction.name
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                        lineNumber: 70,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs text-slate-500",
                                        children: [
                                            attraction.avgVisitMinutes,
                                            " min visit",
                                            segment ? ` · ${Math.round(segment.walkingMinutes)} min walk · ${(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatDistance"])(segment.distanceMeters)}` : ""
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                        lineNumber: 73,
                                        columnNumber: 17
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 69,
                                columnNumber: 15
                            }, this)
                        ]
                    }, attraction.id, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                        lineNumber: 65,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                lineNumber: 59,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "rounded-md bg-slate-50 p-2 text-xs text-slate-600 space-y-0.5",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Walking time"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 88,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    Math.round(walkingMinutes),
                                    " min"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 89,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                        lineNumber: 87,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex justify-between",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Visit time"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 92,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    Math.round(visitMinutes),
                                    " min"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 93,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                        lineNumber: 91,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex justify-between font-semibold text-slate-900",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: "Total"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 96,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                children: [
                                    Math.round(plan.totalMinutes),
                                    " min"
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                                lineNumber: 97,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                        lineNumber: 95,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                lineNumber: 86,
                columnNumber: 7
            }, this),
            walkOrigin && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                href: `/tsp-debug?lat=${walkOrigin.lat}&lng=${walkOrigin.lng}&minutes=${walkMinutes ?? 90}&radius=${walkRadius ?? 2000}`,
                target: "_blank",
                rel: "noopener noreferrer",
                className: "inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50",
                children: "🔬 View TSP Graph"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                lineNumber: 103,
                columnNumber: 9
            }, this),
            plan.droppedAttractions.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-xs text-slate-500",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "font-medium text-slate-700",
                        children: "Didn't fit in time budget:"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                        lineNumber: 116,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        children: plan.droppedAttractions.map((a)=>a.name).join(", ")
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                        lineNumber: 119,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
                lineNumber: 115,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx",
        lineNumber: 48,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/route/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$HikeSearchPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$RouteResults$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$RouteStats$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/RouteStats.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$TrailIntelligencePanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$WalkCompanionPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$WalkPlanResults$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx [app-ssr] (ecmascript)");
;
;
;
;
;
;
}),
"[project]/Documents/test/hiking-route-planner/src/components/walk/OffRouteNotification.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OffRouteNotification",
    ()=>OffRouteNotification
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
;
function OffRouteNotification({ visible, deviationMeters }) {
    if (!visible) {
        return null;
    }
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "fixed top-4 left-1/2 z-50 -translate-x-1/2 animate-pulse rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg",
        children: [
            "Off route - ",
            deviationMeters,
            "m from path"
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/OffRouteNotification.tsx",
        lineNumber: 15,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PlaceSearch",
    ()=>PlaceSearch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$LoadingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/LoadingSpinner.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
function PlaceSearch({ onSelectPlace }) {
    const [query, setQuery] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("");
    const [results, setResults] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }
        const controller = new AbortController();
        const timeout = window.setTimeout(async ()=>{
            try {
                setIsLoading(true);
                setError(null);
                const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}&limit=5`, {
                    signal: controller.signal
                });
                if (!response.ok) {
                    const payload = await response.json().catch(()=>({}));
                    throw new Error(payload.error ?? "Failed to search places.");
                }
                const places = await response.json();
                setResults(places.map((place)=>{
                    const lat = Number(place.lat);
                    const lng = Number(place.lon);
                    if (Number.isNaN(lat) || Number.isNaN(lng)) {
                        return null;
                    }
                    return {
                        id: place.place_id,
                        name: place.display_name,
                        coordinates: {
                            lat,
                            lng
                        }
                    };
                }).filter((place)=>place !== null));
            } catch (searchError) {
                if (searchError instanceof DOMException && searchError.name === "AbortError") {
                    return;
                }
                setError(searchError instanceof Error ? searchError.message : "Failed to search places.");
            } finally{
                setIsLoading(false);
            }
        }, 600);
        return ()=>{
            controller.abort();
            window.clearTimeout(timeout);
        };
    }, [
        query
    ]);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-base font-semibold text-slate-900",
                        children: "Search places"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                        lineNumber: 90,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-slate-500",
                        children: "Nominatim lookup (debounced)"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                        lineNumber: 91,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                lineNumber: 89,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "text",
                value: query,
                onChange: (event)=>setQuery(event.target.value),
                placeholder: "Search by address, mountain, or trailhead",
                className: "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                lineNumber: 94,
                columnNumber: 7
            }, this),
            isLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2 text-xs text-slate-600",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$LoadingSpinner$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["LoadingSpinner"], {
                        size: "sm"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                        lineNumber: 104,
                        columnNumber: 11
                    }, this),
                    "Searching..."
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                lineNumber: 103,
                columnNumber: 9
            }, this),
            error && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-xs text-rose-600",
                children: error
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                lineNumber: 109,
                columnNumber: 17
            }, this),
            results.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "max-h-48 space-y-2 overflow-auto",
                children: results.map((result)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                            type: "button",
                            onClick: ()=>{
                                onSelectPlace(result);
                                setQuery("");
                                setResults([]);
                            },
                            className: "w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-100",
                            children: result.name
                        }, void 0, false, {
                            fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                            lineNumber: 115,
                            columnNumber: 15
                        }, this)
                    }, result.id, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                        lineNumber: 114,
                        columnNumber: 13
                    }, this))
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
                lineNumber: 112,
                columnNumber: 9
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx",
        lineNumber: 88,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WaypointItem",
    ()=>WaypointItem
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Toggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Toggle.tsx [app-ssr] (ecmascript)");
"use client";
;
;
function WaypointItem({ waypoint, index, onRename, onToggleRequired, onSetStart, onSetEnd, onDelete, onSetTimeWindow }) {
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("article", {
        className: "space-y-3 rounded-md border border-slate-200 bg-white p-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center justify-between gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "text-xs font-semibold text-slate-500",
                        children: [
                            "#",
                            index + 1
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                        lineNumber: 30,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex items-center gap-2 text-xs",
                        children: [
                            waypoint.isStart && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "rounded bg-rose-100 px-2 py-1 font-medium text-rose-700",
                                children: "Start"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                                lineNumber: 33,
                                columnNumber: 13
                            }, this),
                            waypoint.isEnd && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: "rounded bg-emerald-100 px-2 py-1 font-medium text-emerald-700",
                                children: "End"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                                lineNumber: 38,
                                columnNumber: 13
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                        lineNumber: 31,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                type: "text",
                value: waypoint.name,
                onChange: (event)=>onRename(waypoint.id, event.target.value),
                className: "w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-emerald-500 focus:outline-none"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                lineNumber: 45,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Toggle$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Toggle"], {
                checked: waypoint.required,
                onChange: ()=>onToggleRequired(waypoint.id),
                label: "Required stop"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                lineNumber: 52,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "grid grid-cols-2 gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                        variant: "secondary",
                        onClick: ()=>onSetStart(waypoint.id),
                        children: "Set Start"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                        lineNumber: 59,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                        variant: "secondary",
                        onClick: ()=>onSetEnd(waypoint.id),
                        children: "Set End"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                        lineNumber: 62,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                lineNumber: 58,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "space-y-1",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs font-medium text-slate-600",
                        children: "Time window"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                        lineNumber: 68,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "grid grid-cols-2 gap-2",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "time",
                                value: waypoint.timeWindow?.start ?? "",
                                onChange: (event)=>onSetTimeWindow(waypoint.id, {
                                        start: event.target.value,
                                        end: waypoint.timeWindow?.end ?? event.target.value
                                    }),
                                className: "rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                                lineNumber: 70,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                type: "time",
                                value: waypoint.timeWindow?.end ?? "",
                                onChange: (event)=>onSetTimeWindow(waypoint.id, {
                                        start: waypoint.timeWindow?.start ?? event.target.value,
                                        end: event.target.value
                                    }),
                                className: "rounded-md border border-slate-300 px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                                lineNumber: 81,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                        lineNumber: 69,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: ()=>onSetTimeWindow(waypoint.id, undefined),
                        className: "text-xs text-slate-500 underline underline-offset-2",
                        children: "Clear time window"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                        lineNumber: 93,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                lineNumber: 67,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                variant: "danger",
                onClick: ()=>onDelete(waypoint.id),
                fullWidth: true,
                children: "Remove waypoint"
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
                lineNumber: 102,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx",
        lineNumber: 28,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WaypointList",
    ()=>WaypointList
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$WaypointItem$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx [app-ssr] (ecmascript)");
"use client";
;
;
;
;
function WaypointList({ waypoints, onRename, onToggleRequired, onSetStart, onSetEnd, onDelete, onReorder, onSetTimeWindow }) {
    const [draggingIndex, setDraggingIndex] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
        className: "space-y-3",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h2", {
                        className: "text-base font-semibold text-slate-900",
                        children: "Waypoints"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx",
                        lineNumber: 36,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                        className: "text-xs text-slate-500",
                        children: "Drag to reorder stop sequence"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx",
                        lineNumber: 37,
                        columnNumber: 9
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx",
                lineNumber: 35,
                columnNumber: 7
            }, this),
            waypoints.length === 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                className: "rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-500",
                children: "Add waypoints from map clicks or search results."
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx",
                lineNumber: 41,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "space-y-2",
                children: waypoints.map((waypoint, index)=>/*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        draggable: true,
                        onDragStart: ()=>setDraggingIndex(index),
                        onDragOver: (event)=>event.preventDefault(),
                        onDrop: ()=>{
                            if (draggingIndex === null) {
                                return;
                            }
                            onReorder(draggingIndex, index);
                            setDraggingIndex(null);
                        },
                        onDragEnd: ()=>setDraggingIndex(null),
                        className: "cursor-grab active:cursor-grabbing",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$WaypointItem$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WaypointItem"], {
                            waypoint: waypoint,
                            index: index,
                            onRename: onRename,
                            onToggleRequired: onToggleRequired,
                            onSetStart: onSetStart,
                            onSetEnd: onSetEnd,
                            onDelete: onDelete,
                            onSetTimeWindow: onSetTimeWindow
                        }, void 0, false, {
                            fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx",
                            lineNumber: 63,
                            columnNumber: 13
                        }, this)
                    }, waypoint.id, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx",
                        lineNumber: 48,
                        columnNumber: 11
                    }, this))
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx",
                lineNumber: 46,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx",
        lineNumber: 34,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/waypoints/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$PlaceSearch$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$WaypointItem$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointItem.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$WaypointList$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx [app-ssr] (ecmascript)");
;
;
;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/types/constraints.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "defaultConstraints",
    ()=>defaultConstraints
]);
const defaultConstraints = {
    maxDistance: {
        enabled: false,
        maxKm: 15
    },
    timeWindows: {
        enabled: false
    },
    fixedStartEnd: {
        enabled: false
    }
};
}),
"[project]/Documents/test/hiking-route-planner/src/lib/types/hike-search.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/types/ors.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/types/route.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/types/trail-intelligence.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/types/walk-plan.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/types/waypoint.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/types/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$constraints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/constraints.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$hike$2d$search$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/hike-search.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$ors$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/ors.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$route$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/route.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$trail$2d$intelligence$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/trail-intelligence.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$plan$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/walk-plan.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$waypoint$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/waypoint.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/hooks/useConstraints.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useConstraints",
    ()=>useConstraints
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$constraints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/constraints.ts [app-ssr] (ecmascript)");
"use client";
;
;
function useConstraints(initialConstraints = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$constraints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["defaultConstraints"]) {
    const [constraints, setConstraints] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialConstraints);
    const toggleMaxDistance = ()=>{
        setConstraints((current)=>({
                ...current,
                maxDistance: {
                    ...current.maxDistance,
                    enabled: !current.maxDistance.enabled
                }
            }));
    };
    const setMaxDistanceKm = (maxKm)=>{
        setConstraints((current)=>({
                ...current,
                maxDistance: {
                    ...current.maxDistance,
                    maxKm
                }
            }));
    };
    const toggleTimeWindows = ()=>{
        setConstraints((current)=>({
                ...current,
                timeWindows: {
                    ...current.timeWindows,
                    enabled: !current.timeWindows.enabled
                }
            }));
    };
    const setDefaultTimeWindow = (timeWindow)=>{
        setConstraints((current)=>({
                ...current,
                timeWindows: {
                    ...current.timeWindows,
                    defaultWindow: timeWindow
                }
            }));
    };
    const toggleFixedStartEnd = ()=>{
        setConstraints((current)=>({
                ...current,
                fixedStartEnd: {
                    enabled: !current.fixedStartEnd.enabled
                }
            }));
    };
    const resetConstraints = ()=>{
        setConstraints(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$constraints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["defaultConstraints"]);
    };
    return {
        constraints,
        setConstraints,
        toggleMaxDistance,
        setMaxDistanceKm,
        toggleTimeWindows,
        setDefaultTimeWindow,
        toggleFixedStartEnd,
        resetConstraints
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/data/rtg-trails.json (json)", ((__turbopack_context__) => {

__turbopack_context__.v([{"id":"rtg-jerusalem-park-loop","name":"Jerusalem Park Scenic Loop","region":"Jerusalem","lengthMeters":4200,"difficulty":"easy","source":"rtg-curated","dataVersion":"2026-04-03","lastUpdated":"2026-04-03T00:00:00.000Z","geometry":[{"lat":31.7691,"lng":35.2136},{"lat":31.7708,"lng":35.2168},{"lat":31.7727,"lng":35.2157},{"lat":31.7734,"lng":35.2129},{"lat":31.7715,"lng":35.2102},{"lat":31.7691,"lng":35.2136}],"metadata":{"dataSource":"rtg-curated-static-v1","surface":"trail/mixed"}},{"id":"rtg-emek-refaim-ridge","name":"Emek Refaim Ridge Trail","region":"Jerusalem","lengthMeters":6100,"difficulty":"moderate","source":"rtg-curated","dataVersion":"2026-04-03","lastUpdated":"2026-04-03T00:00:00.000Z","geometry":[{"lat":31.7589,"lng":35.2034},{"lat":31.7612,"lng":35.2078},{"lat":31.7645,"lng":35.2123},{"lat":31.7669,"lng":35.2159},{"lat":31.7681,"lng":35.2191}],"metadata":{"dataSource":"rtg-curated-static-v1","surface":"trail"}},{"id":"rtg-sataf-forest-cross","name":"Sataf Forest Cross Trail","region":"Jerusalem Hills","lengthMeters":7800,"difficulty":"moderate","source":"rtg-curated","dataVersion":"2026-04-03","lastUpdated":"2026-04-03T00:00:00.000Z","geometry":[{"lat":31.7748,"lng":35.1374},{"lat":31.7762,"lng":35.1431},{"lat":31.7793,"lng":35.1478},{"lat":31.7822,"lng":35.1509},{"lat":31.785,"lng":35.1543}],"metadata":{"dataSource":"rtg-curated-static-v1","surface":"forest-trail"}}]);}),
"[project]/Documents/test/hiking-route-planner/src/lib/api/rtg-client.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getRtgTrailDiagnostics",
    ()=>getRtgTrailDiagnostics,
    "getRtgTrails",
    ()=>getRtgTrails,
    "normalizeTrail",
    ()=>normalizeTrail,
    "validateTrail",
    ()=>validateTrail
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$data$2f$rtg$2d$trails$2e$json__$28$json$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/data/rtg-trails.json (json)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
;
;
const ISRAEL_BOUNDS = {
    minLat: 29.5,
    maxLat: 33.3,
    minLng: 34.2,
    maxLng: 35.9
};
let diagnosticsCache = null;
function isCoordinateObject(value) {
    if (!value || typeof value !== "object") {
        return false;
    }
    const coordinate = value;
    return Number.isFinite(coordinate.lat) && Number.isFinite(coordinate.lng);
}
function normalizeCoordinate(value) {
    if (Array.isArray(value)) {
        return (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fromOrsCoord"])(value);
    }
    return value;
}
function isInIsraelBounds(point) {
    return point.lat >= ISRAEL_BOUNDS.minLat && point.lat <= ISRAEL_BOUNDS.maxLat && point.lng >= ISRAEL_BOUNDS.minLng && point.lng <= ISRAEL_BOUNDS.maxLng;
}
function normalizeGeometry(rawGeometry) {
    if (!Array.isArray(rawGeometry)) {
        return [];
    }
    return rawGeometry.filter((value)=>Array.isArray(value) || isCoordinateObject(value)).map((value)=>normalizeCoordinate(value)).filter((point)=>Number.isFinite(point.lat) && Number.isFinite(point.lng)).filter((point)=>isInIsraelBounds(point));
}
function normalizeSource(value) {
    return value === "rtg-official" ? "rtg-official" : "rtg-curated";
}
function normalizeTrail(rawTrail) {
    return {
        id: typeof rawTrail.id === "string" ? rawTrail.id : "",
        name: typeof rawTrail.name === "string" ? rawTrail.name : "",
        region: typeof rawTrail.region === "string" ? rawTrail.region : "Unknown",
        geometry: normalizeGeometry(rawTrail.geometry),
        lengthMeters: typeof rawTrail.lengthMeters === "number" && Number.isFinite(rawTrail.lengthMeters) ? rawTrail.lengthMeters : 0,
        difficulty: typeof rawTrail.difficulty === "string" ? rawTrail.difficulty : undefined,
        source: normalizeSource(rawTrail.source),
        dataVersion: typeof rawTrail.dataVersion === "string" ? rawTrail.dataVersion : "unknown",
        lastUpdated: typeof rawTrail.lastUpdated === "string" ? rawTrail.lastUpdated : new Date(0).toISOString(),
        metadata: rawTrail.metadata && typeof rawTrail.metadata === "object" ? rawTrail.metadata : undefined
    };
}
function validateTrail(trail) {
    if (!trail.id.trim()) {
        return {
            valid: false,
            reason: "missing id"
        };
    }
    if (!trail.name.trim()) {
        return {
            valid: false,
            reason: "missing name"
        };
    }
    if (!Number.isFinite(trail.lengthMeters) || trail.lengthMeters <= 0) {
        return {
            valid: false,
            reason: "invalid length"
        };
    }
    if (trail.geometry.length < 3) {
        return {
            valid: false,
            reason: "geometry must contain at least 3 points"
        };
    }
    if (!trail.geometry.every((point)=>Number.isFinite(point.lat) && Number.isFinite(point.lng) && isInIsraelBounds(point))) {
        return {
            valid: false,
            reason: "geometry contains invalid coordinates"
        };
    }
    return {
        valid: true
    };
}
function loadRtgTrails() {
    let skippedTrailCount = 0;
    const normalized = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$data$2f$rtg$2d$trails$2e$json__$28$json$29$__["default"].flatMap((rawTrail)=>{
        const trail = normalizeTrail(rawTrail);
        const validation = validateTrail(trail);
        if (!validation.valid) {
            skippedTrailCount += 1;
            if ("TURBOPACK compile-time truthy", 1) {
                console.warn(`Skipping RTG trail "${trail.id || "unknown"}": ${validation.reason}`);
            }
            return [];
        }
        return [
            trail
        ];
    });
    diagnosticsCache = {
        validTrailCount: normalized.length,
        skippedTrailCount
    };
    return normalized;
}
const cachedTrails = loadRtgTrails();
async function getRtgTrails() {
    return cachedTrails;
}
function getRtgTrailDiagnostics() {
    return diagnosticsCache ?? {
        validTrailCount: cachedTrails.length,
        skippedTrailCount: 0
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/api/osm-trails-client.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "fetchOsmHikingTrails",
    ()=>fetchOsmHikingTrails
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
;
const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
];
const DEFAULT_SEARCH_RADIUS_METERS = 10_000;
const TIMEOUT_MS = 25_000;
function buildQuery(center, radiusMeters) {
    const { lat, lng } = center;
    return `
[out:json][timeout:25];
relation["route"="hiking"](around:${radiusMeters},${lat},${lng});
out geom;
`.trim();
}
function assembleGeometry(members) {
    // Collect all points from all way members in order.
    // We do a simple chain-assembly: try to connect each way end-to-end.
    // If a way's start is close to the previous end, append it forward;
    // if its end is close, append it reversed.
    const SNAP_METERS = 50;
    const wayGeoms = members.filter((m)=>m.type === "way" && Array.isArray(m.geometry) && m.geometry.length >= 2).map((m)=>m.geometry.map((p)=>({
                lat: p.lat,
                lng: p.lon
            })));
    if (wayGeoms.length === 0) return [];
    const result = [
        ...wayGeoms[0]
    ];
    for(let i = 1; i < wayGeoms.length; i++){
        const way = wayGeoms[i];
        const lastPoint = result[result.length - 1];
        const wayStart = way[0];
        const wayEnd = way[way.length - 1];
        const distToStart = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(lastPoint, wayStart);
        const distToEnd = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(lastPoint, wayEnd);
        if (distToStart <= distToEnd || distToStart <= SNAP_METERS) {
            // Append forward, skip first point if it overlaps
            const skip = distToStart <= SNAP_METERS ? 1 : 0;
            result.push(...way.slice(skip));
        } else {
            // Append reversed
            const reversed = [
                ...way
            ].reverse();
            const skip = distToEnd <= SNAP_METERS ? 1 : 0;
            result.push(...reversed.slice(skip));
        }
    }
    return result;
}
function geometryLengthMeters(geometry) {
    let total = 0;
    for(let i = 1; i < geometry.length; i++){
        total += (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(geometry[i - 1], geometry[i]);
    }
    return total;
}
function inferDifficulty(tags) {
    const sac = tags["sac_scale"];
    if (!sac) return undefined;
    if (sac === "hiking") return "easy";
    if (sac === "mountain_hiking") return "moderate";
    if (sac === "demanding_mountain_hiking" || sac === "alpine_hiking") return "hard";
    return "moderate";
}
function inferRegion(tags, geometry) {
    // Prefer OSM tags
    const area = tags["area"] ?? tags["region"] ?? tags["network"];
    if (area) return area;
    // Fall back to coordinate-based region (Israel-centric)
    const center = geometry[Math.floor(geometry.length / 2)];
    if (!center) return "Unknown";
    if (center.lat > 33.0) return "Upper Galilee";
    if (center.lat > 32.7) return "Lower Galilee";
    if (center.lat > 32.0) return "Carmel & Sharon";
    if (center.lat > 31.6 && center.lng > 35.05) return "Jerusalem Hills";
    if (center.lat > 31.2) return "Judean Foothills";
    if (center.lat < 30.5) return "Eilat & Arava";
    return "Negev";
}
function relationToTrail(rel) {
    const tags = rel.tags ?? {};
    const name = tags.name ?? tags["name:en"] ?? tags["name:he"] ?? tags["ref"];
    if (!name) return null;
    const geometry = assembleGeometry(rel.members);
    if (geometry.length < 3) return null;
    // Use OSM-reported distance if available, otherwise compute from geometry
    let lengthMeters;
    const osmDistance = tags.distance ?? tags.length;
    if (osmDistance) {
        const parsed = parseFloat(osmDistance);
        // OSM distance is usually in km
        lengthMeters = Number.isFinite(parsed) ? parsed * 1000 : geometryLengthMeters(geometry);
    } else {
        lengthMeters = geometryLengthMeters(geometry);
    }
    if (lengthMeters <= 0) return null;
    return {
        id: `osm-relation-${rel.id}`,
        name,
        region: inferRegion(tags, geometry),
        geometry,
        lengthMeters,
        difficulty: inferDifficulty(tags),
        source: "osm-hiking",
        dataVersion: new Date().toISOString().split("T")[0],
        lastUpdated: new Date().toISOString(),
        metadata: {
            osmId: rel.id,
            osmTags: tags
        }
    };
}
async function fetchOsmHikingTrails(center, radiusMeters = DEFAULT_SEARCH_RADIUS_METERS) {
    const query = buildQuery(center, radiusMeters);
    const body = `data=${encodeURIComponent(query)}`;
    let lastError = new Error("Overpass API unavailable.");
    for (const endpoint of OVERPASS_ENDPOINTS){
        try {
            const controller = new AbortController();
            const timeout = setTimeout(()=>controller.abort(), TIMEOUT_MS);
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
                lastError = new Error(`Overpass error: ${response.status}`);
                continue;
            }
            const data = await response.json();
            const trails = [];
            const seenIds = new Set();
            for (const el of data.elements){
                if (el.type !== "relation") continue;
                const trail = relationToTrail(el);
                if (!trail) continue;
                if (seenIds.has(trail.id)) continue;
                seenIds.add(trail.id);
                trails.push(trail);
            }
            return trails;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error("Overpass request failed.");
        }
    }
    throw lastError;
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/optimization/constraint-builder.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "buildOptimizationRequest",
    ()=>buildOptimizationRequest
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$time$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/time.ts [app-ssr] (ecmascript)");
;
;
function getTimeWindowForWaypoint(waypoint, constraints) {
    if (!constraints.timeWindows.enabled) {
        return undefined;
    }
    const activeWindow = waypoint.timeWindow ?? constraints.timeWindows.defaultWindow;
    if (!activeWindow) {
        return undefined;
    }
    const start = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$time$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["timeToSeconds"])(activeWindow.start);
    const end = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$time$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["timeToSeconds"])(activeWindow.end);
    if (start === null || end === null || start >= end) {
        return undefined;
    }
    return [
        [
            start,
            end
        ]
    ];
}
function buildOptimizationRequest(waypoints, constraints) {
    const explicitStartWaypoint = constraints.fixedStartEnd.enabled ? waypoints.find((waypoint)=>waypoint.isStart) : undefined;
    const explicitEndWaypoint = constraints.fixedStartEnd.enabled ? waypoints.find((waypoint)=>waypoint.isEnd) : undefined;
    const startWaypoint = explicitStartWaypoint ?? (!constraints.fixedStartEnd.enabled && waypoints.length >= 3 ? waypoints[0] : undefined);
    const endWaypoint = explicitEndWaypoint;
    const jobs = [];
    const jobWaypointMap = new Map();
    let nextJobId = 1;
    for (const waypoint of waypoints){
        if (startWaypoint?.id === waypoint.id || endWaypoint?.id === waypoint.id) {
            continue;
        }
        const job = {
            id: nextJobId,
            location: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toOrsCoord"])(waypoint.coordinates),
            priority: waypoint.required ? 100 : 0
        };
        const timeWindows = getTimeWindowForWaypoint(waypoint, constraints);
        if (timeWindows) {
            job.time_windows = timeWindows;
        }
        jobs.push(job);
        jobWaypointMap.set(nextJobId, waypoint);
        nextJobId += 1;
    }
    const vehicle = {
        id: 1,
        profile: "foot-walking",
        start: startWaypoint ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toOrsCoord"])(startWaypoint.coordinates) : undefined,
        end: endWaypoint ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toOrsCoord"])(endWaypoint.coordinates) : undefined,
        max_distance: constraints.maxDistance.enabled ? Math.round(constraints.maxDistance.maxKm * 1000) : undefined
    };
    return {
        request: {
            jobs,
            vehicles: [
                vehicle
            ]
        },
        jobWaypointMap,
        startWaypoint,
        endWaypoint
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/utils/polyline.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
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
"[project]/Documents/test/hiking-route-planner/src/lib/optimization/route-planner.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "planRoute",
    ()=>planRoute
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$optimization$2f$constraint$2d$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/optimization/constraint-builder.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$polyline$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/polyline.ts [app-ssr] (ecmascript)");
;
;
;
function hasActiveConstraints(constraints) {
    return constraints.maxDistance.enabled || constraints.timeWindows.enabled || constraints.fixedStartEnd.enabled;
}
async function postJson(url, body) {
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(()=>({}));
        throw new Error(errorBody.error ?? `Request failed (${response.status})`);
    }
    return await response.json();
}
function getWaypointOrderFromOptimization(optimization, waypoints, constraints) {
    const { jobWaypointMap, startWaypoint, endWaypoint } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$optimization$2f$constraint$2d$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildOptimizationRequest"])(waypoints, constraints);
    const steps = optimization.routes[0]?.steps ?? [];
    const ordered = [];
    for (const step of steps){
        if (step.type === "start" && startWaypoint) {
            ordered.push(startWaypoint);
            continue;
        }
        if (step.type === "job") {
            const waypoint = jobWaypointMap.get(step.id);
            if (waypoint) {
                ordered.push(waypoint);
            }
            continue;
        }
        if (step.type === "end" && endWaypoint) {
            ordered.push(endWaypoint);
        }
    }
    if (ordered.length >= 2) {
        return ordered;
    }
    return waypoints;
}
function toRouteSteps(directions) {
    const firstRoute = directions.routes[0];
    if (!firstRoute) {
        return [];
    }
    return firstRoute.segments.flatMap((segment)=>segment.steps.map((step)=>({
                instruction: step.instruction,
                distanceMeters: step.distance,
                durationSeconds: step.duration
            })));
}
async function getDirectionsBetween(from, to) {
    return postJson("/api/directions", {
        profile: "foot-walking",
        instructions: true,
        coordinates: [
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toOrsCoord"])(from.coordinates),
            (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toOrsCoord"])(to.coordinates)
        ]
    });
}
function aggregateGeometry(segments) {
    const geometry = [];
    for (const segment of segments){
        for(let index = 0; index < segment.geometry.length; index += 1){
            const point = segment.geometry[index];
            const isFirstPointOfSegment = index === 0;
            const lastPoint = geometry[geometry.length - 1];
            if (isFirstPointOfSegment && lastPoint && lastPoint.lat === point.lat && lastPoint.lng === point.lng) {
                continue;
            }
            geometry.push(point);
        }
    }
    return geometry;
}
async function calculateViaDirections(waypoints) {
    const directions = await postJson("/api/directions", {
        profile: "foot-walking",
        instructions: true,
        coordinates: waypoints.map((waypoint)=>(0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["toOrsCoord"])(waypoint.coordinates))
    });
    const route = directions.routes[0];
    if (!route) {
        throw new Error("No walking route found between these locations. Try moving waypoints closer to a road or trail.");
    }
    const geometry = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$polyline$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["decodePolyline"])(route.geometry);
    const segmentSummaries = route.segments;
    const wayPointIndices = route.way_points;
    const segments = [];
    for(let index = 0; index < waypoints.length - 1; index += 1){
        const segment = segmentSummaries[index];
        const startIdx = wayPointIndices[index] ?? 0;
        const endIdx = wayPointIndices[index + 1] ?? geometry.length - 1;
        segments.push({
            from: waypoints[index],
            to: waypoints[index + 1],
            distanceMeters: segment?.distance ?? 0,
            durationSeconds: segment?.duration ?? 0,
            geometry: geometry.slice(startIdx, endIdx + 1),
            steps: segment?.steps.map((step)=>({
                    instruction: step.instruction,
                    distanceMeters: step.distance,
                    durationSeconds: step.duration
                })) ?? []
        });
    }
    return {
        orderedWaypoints: waypoints,
        segments,
        geometry,
        totalDistanceMeters: route.summary.distance,
        totalDurationSeconds: route.summary.duration,
        warnings: []
    };
}
async function calculateViaOptimization(waypoints, constraints) {
    const optimizationRequest = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$optimization$2f$constraint$2d$builder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["buildOptimizationRequest"])(waypoints, constraints);
    if (optimizationRequest.request.jobs.length === 0 && constraints.fixedStartEnd.enabled && optimizationRequest.startWaypoint && optimizationRequest.endWaypoint) {
        return calculateViaDirections([
            optimizationRequest.startWaypoint,
            optimizationRequest.endWaypoint
        ]);
    }
    const optimizationResponse = await postJson("/api/optimization", optimizationRequest.request);
    const orderedWaypoints = getWaypointOrderFromOptimization(optimizationResponse, waypoints, constraints);
    if (orderedWaypoints.length < 2) {
        throw new Error("Not enough optimized waypoints to build a route.");
    }
    const segments = [];
    const warnings = [];
    if (optimizationResponse.unassigned.length) {
        // Check whether any required waypoint was dropped (LOW-1)
        const unassignedIds = new Set(optimizationResponse.unassigned.map((u)=>u.id));
        const requiredDropped = [
            ...optimizationRequest.jobWaypointMap.entries()
        ].filter(([jobId, wp])=>unassignedIds.has(jobId) && wp.required).map(([, wp])=>wp.name ?? wp.id);
        if (requiredDropped.length > 0) {
            warnings.push(`Required waypoint(s) were dropped by route optimization: ${requiredDropped.join(", ")}.`);
        } else {
            warnings.push(`${optimizationResponse.unassigned.length} waypoint(s) could not be assigned due to constraints.`);
        }
    }
    for(let index = 0; index < orderedWaypoints.length - 1; index += 1){
        const from = orderedWaypoints[index];
        const to = orderedWaypoints[index + 1];
        let directions;
        try {
            directions = await getDirectionsBetween(from, to);
        } catch  {
            warnings.push(`Could not get directions from "${from.name}" to "${to.name}". Segment skipped.`);
            continue;
        }
        const route = directions.routes[0];
        if (!route) {
            warnings.push(`No walking route found between "${from.name}" and "${to.name}". Try moving that waypoint closer to a path.`);
            continue;
        }
        segments.push({
            from,
            to,
            distanceMeters: route.summary.distance,
            durationSeconds: route.summary.duration,
            geometry: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$polyline$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["decodePolyline"])(route.geometry),
            steps: toRouteSteps(directions)
        });
    }
    if (segments.length === 0) {
        throw new Error("No walking route could be generated for the optimized waypoint order. Try moving waypoints closer to a road or trail.");
    }
    const totalDistanceMeters = segments.reduce((sum, segment)=>sum + segment.distanceMeters, 0);
    const totalDurationSeconds = segments.reduce((sum, segment)=>sum + segment.durationSeconds, 0);
    return {
        orderedWaypoints,
        segments,
        geometry: aggregateGeometry(segments),
        totalDistanceMeters,
        totalDurationSeconds,
        warnings
    };
}
async function planRoute({ waypoints, constraints }) {
    if (waypoints.length < 2) {
        throw new Error("Add at least two waypoints before calculating a route.");
    }
    const shouldOptimize = waypoints.length >= 3 || hasActiveConstraints(constraints);
    if (!shouldOptimize) {
        return calculateViaDirections(waypoints);
    }
    return calculateViaOptimization(waypoints, constraints);
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/optimization/hike-search.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "findHikeCandidates",
    ()=>findHikeCandidates,
    "searchBestHike",
    ()=>searchBestHike
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$api$2f$rtg$2d$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/api/rtg-client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$api$2f$osm$2d$trails$2d$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/api/osm-trails-client.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$constraints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/constraints.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$optimization$2f$route$2d$planner$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/optimization/route-planner.ts [app-ssr] (ecmascript)");
;
;
;
;
;
const ORIGIN_RADIUS_METERS = 6000;
const ENDPOINT_RADIUS_METERS = 2500;
const PREFERRED_TRAILHEAD_DISTANCE_METERS = 1000;
const MAX_TRAIL_GAP_METERS = 500;
const DEFAULT_FALLBACK_DISTANCE_METERS = 2500;
const DEFAULT_DESIRED_ROUTE_COUNT = 1;
const MAX_DESIRED_ROUTE_COUNT = 5;
const AUTO_START_DISTANCE_BASE_METERS = 2200;
const AUTO_START_DISTANCE_STEP_METERS = 400;
const MALFORMED_TRAIL_WARNING = "RTG trail data is malformed or unusable for this request. Showing fallback route.";
const NON_OFFICIAL_DISCLAIMER = "No official RTG trail was found for this request. This is a general hiking suggestion, not an official recommendation, and final responsibility remains with you.";
let _waypointIdCounter = 0;
function createWaypointId(index) {
    return `generated-${index}-${++_waypointIdCounter}`;
}
function distanceToTrail(point, trail) {
    return trail.geometry.reduce((minDistance, segmentPoint)=>{
        const current = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(point, segmentPoint);
        return Math.min(minDistance, current);
    }, Number.POSITIVE_INFINITY);
}
function isValidCoordinate(point) {
    if (!point) {
        return false;
    }
    return Number.isFinite(point.lat) && Number.isFinite(point.lng) && point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180;
}
function hasValidTrailGeometry(trail) {
    if (!Array.isArray(trail.geometry) || trail.geometry.length < 3) {
        return false;
    }
    return trail.geometry.every((point)=>isValidCoordinate(point));
}
function geometryGapPenalty(trail) {
    let largestGap = 0;
    for(let index = 1; index < trail.geometry.length; index += 1){
        largestGap = Math.max(largestGap, (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(trail.geometry[index - 1], trail.geometry[index]));
    }
    if (largestGap <= MAX_TRAIL_GAP_METERS) {
        return 1;
    }
    const overageRatio = Math.min(largestGap / MAX_TRAIL_GAP_METERS, 3);
    return Math.max(0, 1 - (overageRatio - 1) * 0.5);
}
function inferAreaLabel(point) {
    if (point.lat > 31.6 && point.lng > 35.05) {
        return "jerusalem";
    }
    if (point.lat > 32.7) {
        return "north";
    }
    if (point.lat < 31.2) {
        return "south";
    }
    return "central";
}
function regionMatchScore(trail, origin) {
    const areaLabel = inferAreaLabel(origin);
    const region = trail.region.toLowerCase();
    if (region.includes(areaLabel)) {
        return 1;
    }
    if (areaLabel === "jerusalem" && region.includes("hills")) {
        return 0.85;
    }
    return 0.45;
}
function distanceFitScore(distanceMeters, targetMeters) {
    if (!targetMeters) {
        return 0.7;
    }
    const delta = Math.abs(distanceMeters - targetMeters);
    const ratio = Math.min(delta / Math.max(targetMeters, 1), 1);
    return 1 - ratio;
}
function difficultyScore(trail, preference) {
    if (!preference || !trail.difficulty) {
        return 0.6;
    }
    return trail.difficulty.toLowerCase() === preference.toLowerCase() ? 1 : 0.3;
}
function scoreTrail(trail, request, originDistance, maxStartDistanceMeters, endpointDistance) {
    const targetDistance = request.targetDistanceMeters ?? request.preferences?.maxDistanceMeters;
    const effectiveMaxStartDistance = Math.max(maxStartDistanceMeters, PREFERRED_TRAILHEAD_DISTANCE_METERS + 1);
    const proximityOrigin = originDistance <= PREFERRED_TRAILHEAD_DISTANCE_METERS ? 1 : Math.max(0, 1 - (originDistance - PREFERRED_TRAILHEAD_DISTANCE_METERS) / (effectiveMaxStartDistance - PREFERRED_TRAILHEAD_DISTANCE_METERS));
    const proximityEndpoint = request.endpoint && endpointDistance !== undefined ? Math.max(0, 1 - endpointDistance / ENDPOINT_RADIUS_METERS) : 0.7;
    const fit = distanceFitScore(trail.lengthMeters, targetDistance);
    const difficulty = difficultyScore(trail, request.preferences?.difficulty);
    const completeness = geometryGapPenalty(trail);
    const regionMatch = regionMatchScore(trail, request.origin);
    return proximityOrigin * 0.3 + proximityEndpoint * 0.2 + fit * 0.2 + completeness * 0.2 + regionMatch * 0.08 + difficulty * 0.02;
}
function matchesMaxDistance(trail, request) {
    const maxDistance = request.preferences?.maxDistanceMeters;
    if (!maxDistance) {
        return true;
    }
    return trail.lengthMeters <= maxDistance * 1.1;
}
function toCandidate(trail, score) {
    return {
        trail,
        source: "rtg",
        geometry: trail.geometry,
        distanceMeters: trail.lengthMeters,
        score,
        routeApproximated: true
    };
}
function endpointDistancesFromOrigin(trail, origin) {
    const first = trail.geometry[0];
    const last = trail.geometry[trail.geometry.length - 1];
    return [
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(origin, first),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(origin, last)
    ];
}
function chooseGeometryOrientation(geometry, origin, maxFinishDistanceFromOriginMeters) {
    const first = geometry[0];
    const last = geometry[geometry.length - 1];
    if (!first || !last) {
        return geometry;
    }
    const startDistanceForward = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(origin, first);
    const finishDistanceForward = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(origin, last);
    const startDistanceReverse = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(origin, last);
    const finishDistanceReverse = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(origin, first);
    if (maxFinishDistanceFromOriginMeters) {
        const forwardFits = finishDistanceForward <= maxFinishDistanceFromOriginMeters;
        const reverseFits = finishDistanceReverse <= maxFinishDistanceFromOriginMeters;
        if (forwardFits && !reverseFits) {
            return geometry;
        }
        if (reverseFits && !forwardFits) {
            return [
                ...geometry
            ].reverse();
        }
    }
    return startDistanceForward <= startDistanceReverse ? geometry : [
        ...geometry
    ].reverse();
}
function buildFallbackEndpoint(origin) {
    // Approximate 1 degree lat ~ 111.32km, lng depends on latitude.
    const latOffset = DEFAULT_FALLBACK_DISTANCE_METERS / 111_320;
    const lngOffset = DEFAULT_FALLBACK_DISTANCE_METERS / (111_320 * Math.max(Math.cos(origin.lat * Math.PI / 180), 0.1));
    return {
        lat: origin.lat + latOffset,
        lng: origin.lng + lngOffset
    };
}
function endpointWithinFinishLimit(origin, endpoint, maxFinishDistanceFromOriginMeters) {
    if (!maxFinishDistanceFromOriginMeters || (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(origin, endpoint) <= maxFinishDistanceFromOriginMeters) {
        return endpoint;
    }
    const ratio = maxFinishDistanceFromOriginMeters / Math.max((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(origin, endpoint), 1);
    return {
        lat: origin.lat + (endpoint.lat - origin.lat) * ratio,
        lng: origin.lng + (endpoint.lng - origin.lng) * ratio
    };
}
function waypointsFromGeometry(geometry, prefix, names, origin, maxFinishDistanceFromOriginMeters) {
    if (geometry.length < 3 || !geometry.every((point)=>isValidCoordinate(point))) {
        return null;
    }
    const orientedGeometry = chooseGeometryOrientation(geometry, origin, maxFinishDistanceFromOriginMeters);
    const first = orientedGeometry[0];
    const middle = orientedGeometry[Math.floor((orientedGeometry.length - 1) / 2)];
    const last = orientedGeometry[orientedGeometry.length - 1];
    if (!isValidCoordinate(first) || !isValidCoordinate(middle) || !isValidCoordinate(last)) {
        return null;
    }
    return [
        {
            id: `${prefix}-${createWaypointId(1)}`,
            name: names[0],
            coordinates: first,
            required: true,
            isStart: true,
            isEnd: false
        },
        {
            id: `${prefix}-${createWaypointId(2)}`,
            name: names[1],
            coordinates: middle,
            required: false,
            isStart: false,
            isEnd: false
        },
        {
            id: `${prefix}-${createWaypointId(3)}`,
            name: names[2],
            coordinates: last,
            required: true,
            isStart: false,
            isEnd: true
        }
    ];
}
function fallbackWaypoints(request) {
    const maxFinishDistanceFromOriginMeters = request.preferences?.maxFinishDistanceFromOriginMeters;
    const endpoint = endpointWithinFinishLimit(request.origin, request.endpoint ?? buildFallbackEndpoint(request.origin), maxFinishDistanceFromOriginMeters);
    const midpoint = {
        lat: (request.origin.lat + endpoint.lat) / 2,
        lng: (request.origin.lng + endpoint.lng) / 2 + 0.002
    };
    return [
        {
            id: `fallback-${createWaypointId(1)}`,
            name: "Origin",
            coordinates: request.origin,
            required: true,
            isStart: true,
            isEnd: false
        },
        {
            id: `fallback-${createWaypointId(2)}`,
            name: "Scenic midpoint",
            coordinates: midpoint,
            required: false,
            isStart: false,
            isEnd: false
        },
        {
            id: `fallback-${createWaypointId(3)}`,
            name: request.endpoint ? "Endpoint" : "Suggested finish",
            coordinates: endpoint,
            required: true,
            isStart: false,
            isEnd: true
        }
    ];
}
function buildConstraintHints(request) {
    const hints = [];
    if (request.preferences?.maxDistanceMeters) {
        hints.push("Try increasing the max distance constraint by 20-40% to unlock more candidate trails.");
    }
    if (request.preferences?.maxStartDistanceMeters) {
        hints.push("Try increasing the max start distance constraint so nearby RTG trails can be considered.");
    }
    if ((request.preferences?.desiredRouteCount ?? DEFAULT_DESIRED_ROUTE_COUNT) > 1) {
        hints.push("If options remain limited, reduce the nearby route count request to focus on the strongest match.");
    }
    if (request.endpoint) {
        hints.push("Try removing the endpoint constraint temporarily to expand the RTG trail search area.");
    }
    if (request.targetDistanceMeters) {
        hints.push("Try relaxing the target finish distance requirement to allow near-match trail suggestions.");
    }
    if (request.preferences?.maxFinishDistanceFromOriginMeters) {
        hints.push("Try increasing the finish-distance-from-origin constraint to allow more feasible route endings.");
    }
    hints.push("If results are limited, move the origin marker slightly toward nearby marked trails and try again.");
    return hints;
}
function buildFallbackMessages(request, candidates) {
    const bestCandidate = candidates[0];
    const guidance = buildConstraintHints(request);
    if (bestCandidate?.trail) {
        const proximity = Math.round(distanceToTrail(request.origin, bestCandidate.trail));
        return {
            fallbackReason: `Could not build a complete walking route from the top RTG candidate "${bestCandidate.trail.name}". ` + `Nearest candidate trail point is about ${proximity}m from your origin.`,
            guidance
        };
    }
    return {
        fallbackReason: "No RTG trail candidate matched the current constraints closely enough to build a route.",
        guidance
    };
}
function clampDesiredRouteCount(value) {
    if (!Number.isInteger(value)) {
        return DEFAULT_DESIRED_ROUTE_COUNT;
    }
    return Math.min(Math.max(value ?? 1, 1), MAX_DESIRED_ROUTE_COUNT);
}
function resolveDesiredRouteCount(request) {
    return clampDesiredRouteCount(request.preferences?.desiredRouteCount);
}
function resolveMaxStartDistanceMeters(request) {
    if (request.preferences?.maxStartDistanceMeters) {
        return request.preferences.maxStartDistanceMeters;
    }
    const desiredRouteCount = resolveDesiredRouteCount(request);
    const recommended = AUTO_START_DISTANCE_BASE_METERS + (desiredRouteCount - 1) * AUTO_START_DISTANCE_STEP_METERS;
    return Math.min(Math.max(recommended, PREFERRED_TRAILHEAD_DISTANCE_METERS), ORIGIN_RADIUS_METERS);
}
function findHikeCandidates(request, trails) {
    const maxStartDistanceMeters = resolveMaxStartDistanceMeters(request);
    const maxFinishDistanceFromOriginMeters = request.preferences?.maxFinishDistanceFromOriginMeters;
    return trails.filter((trail)=>hasValidTrailGeometry(trail)).filter((trail)=>matchesMaxDistance(trail, request)).map((trail)=>{
        const originDistance = distanceToTrail(request.origin, trail);
        const endpointDistance = request.endpoint ? distanceToTrail(request.endpoint, trail) : undefined;
        const [firstEndpointDistance, lastEndpointDistance] = endpointDistancesFromOrigin(trail, request.origin);
        const minFinishDistance = Math.min(firstEndpointDistance, lastEndpointDistance);
        return {
            trail,
            originDistance,
            endpointDistance,
            minFinishDistance
        };
    }).filter(({ originDistance, endpointDistance, minFinishDistance })=>{
        if (originDistance > maxStartDistanceMeters) {
            return false;
        }
        if (maxFinishDistanceFromOriginMeters && minFinishDistance > maxFinishDistanceFromOriginMeters) {
            return false;
        }
        if (request.endpoint && endpointDistance !== undefined) {
            return endpointDistance <= ENDPOINT_RADIUS_METERS;
        }
        return true;
    }).map(({ trail, originDistance, endpointDistance })=>toCandidate(trail, scoreTrail(trail, request, originDistance, maxStartDistanceMeters, endpointDistance))).sort((a, b)=>b.score - a.score);
}
async function buildRouteFromWaypoints(waypoints, baseConstraints) {
    const constraints = baseConstraints ?? __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$constraints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["defaultConstraints"];
    const route = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$optimization$2f$route$2d$planner$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["planRoute"])({
        waypoints,
        constraints
    });
    return route;
}
async function searchBestHike(request, baseConstraints) {
    const [rtgTrails, osmTrails] = await Promise.allSettled([
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$api$2f$rtg$2d$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["getRtgTrails"])(),
        (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$api$2f$osm$2d$trails$2d$client$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["fetchOsmHikingTrails"])(request.origin)
    ]);
    const trails = [
        ...rtgTrails.status === "fulfilled" ? rtgTrails.value : [],
        ...osmTrails.status === "fulfilled" ? osmTrails.value : []
    ];
    const candidates = findHikeCandidates(request, trails);
    const desiredRouteCount = resolveDesiredRouteCount(request);
    for(let index = 0; index < candidates.length; index += 1){
        const selected = candidates[index];
        const maxFinishDistanceFromOriginMeters = request.preferences?.maxFinishDistanceFromOriginMeters;
        const selectedWaypoints = waypointsFromGeometry(selected.geometry, "rtg", [
            "RTG start",
            "RTG midpoint",
            "RTG finish"
        ], request.origin, maxFinishDistanceFromOriginMeters);
        if (!selectedWaypoints) {
            continue;
        }
        try {
            const route = await buildRouteFromWaypoints(selectedWaypoints, baseConstraints);
            const alternates = candidates.filter((_, candidateIndex)=>candidateIndex !== index).slice(0, Math.max(0, desiredRouteCount - 1));
            const autoStartDistance = resolveMaxStartDistanceMeters(request);
            const alternateSummary = alternates.length > 0 ? `Nearby alternatives: ${alternates.map((alternate)=>`${alternate.trail?.name ?? "Unnamed trail"} (${Math.round(alternate.distanceMeters / 100) / 10} km)`).join(", ")}.` : "";
            return {
                selected,
                alternates,
                route: {
                    ...route,
                    source: "rtg",
                    sourceLabel: selected.trail?.source === "osm-hiking" ? "OpenStreetMap Hiking Route (path approximated)" : selected.trail?.source === "rtg-official" ? "RTG-Guided Route (path approximated)" : "RTG-Guided Route (curated trail, path approximated)",
                    warnings: [
                        ...route.warnings,
                        selected.trail?.source === "rtg-official" ? "Route path is generated by ORS between RTG trail points and may not exactly follow the official marked trail." : "Route path is generated by ORS from a curated RTG-style trail dataset and may not exactly follow the official marked trail.",
                        request.preferences?.maxStartDistanceMeters ? `Applied start-distance constraint: up to ${(request.preferences.maxStartDistanceMeters / 1000).toFixed(1)} km from your location.` : `Applied automatic start-distance filter: up to ${(autoStartDistance / 1000).toFixed(1)} km from your location.`,
                        ...request.preferences?.maxFinishDistanceFromOriginMeters ? [
                            `Applied finish-distance constraint: route ending kept within ${(request.preferences.maxFinishDistanceFromOriginMeters / 1000).toFixed(1)} km of your location.`
                        ] : [],
                        ...alternateSummary ? [
                            alternateSummary
                        ] : []
                    ]
                }
            };
        } catch  {
            continue;
        }
    }
    const fallbackReason = candidates.length > 0 ? MALFORMED_TRAIL_WARNING : "No RTG trail candidate matched the current constraints.";
    const fallbackMessages = buildFallbackMessages(request, candidates);
    const fallback = fallbackWaypoints(request);
    const fallbackRoute = await buildRouteFromWaypoints(fallback, baseConstraints);
    const fallbackDistance = fallbackRoute.totalDistanceMeters;
    return {
        selected: {
            trail: null,
            source: "fallback",
            geometry: fallbackRoute.geometry,
            distanceMeters: fallbackDistance,
            score: 0,
            routeApproximated: false
        },
        route: {
            ...fallbackRoute,
            source: "fallback",
            sourceLabel: "Suggested route (no official RTG trail found)",
            warnings: Array.from(new Set([
                ...fallbackRoute.warnings,
                NON_OFFICIAL_DISCLAIMER,
                fallbackReason,
                fallbackMessages.fallbackReason,
                ...fallbackMessages.guidance
            ]))
        },
        fallbackReason
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/hooks/useHikeSearch.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useHikeSearch",
    ()=>useHikeSearch
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$optimization$2f$hike$2d$search$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/optimization/hike-search.ts [app-ssr] (ecmascript)");
"use client";
;
;
function useHikeSearch() {
    const [result, setResult] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isSearching, setIsSearching] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const activeRequestIdRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const findHike = async (request, constraints)=>{
        activeRequestIdRef.current += 1;
        const requestId = activeRequestIdRef.current;
        setIsSearching(true);
        setError(null);
        try {
            const nextResult = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$optimization$2f$hike$2d$search$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["searchBestHike"])(request, constraints);
            if (requestId !== activeRequestIdRef.current) {
                return null;
            }
            setResult(nextResult);
            return nextResult;
        } catch (searchError) {
            if (requestId !== activeRequestIdRef.current) {
                return null;
            }
            const message = searchError instanceof Error ? searchError.message : "Hike search failed.";
            setError(message);
            setResult(null);
            return null;
        } finally{
            if (requestId === activeRequestIdRef.current) {
                setIsSearching(false);
            }
        }
    };
    const clearSearch = ()=>{
        setResult(null);
        setError(null);
    };
    const cancelSearch = ()=>{
        activeRequestIdRef.current += 1;
        setResult(null);
        setError(null);
        setIsSearching(false);
    };
    return {
        result,
        isSearching,
        error,
        findHike,
        clearSearch,
        cancelSearch
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/hooks/useMapInteraction.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useMapInteraction",
    ()=>useMapInteraction
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
const DEFAULT_CENTER = {
    lat: 31.7683,
    lng: 35.2137
};
function useMapInteraction() {
    const [center, setCenter] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(DEFAULT_CENTER);
    const [zoom, setZoom] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(12);
    const [clickMode, setClickMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("add-waypoint");
    const focusOn = (coordinates, nextZoom = zoom)=>{
        setCenter(coordinates);
        setZoom(nextZoom);
    };
    return {
        center,
        zoom,
        clickMode,
        setCenter,
        setZoom,
        setClickMode,
        focusOn
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/hooks/useRouteCalculation.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useRouteCalculation",
    ()=>useRouteCalculation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$optimization$2f$route$2d$planner$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/optimization/route-planner.ts [app-ssr] (ecmascript)");
"use client";
;
;
function useRouteCalculation() {
    const [route, setRoute] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const calculateRoute = async (waypoints, constraints)=>{
        setIsLoading(true);
        setError(null);
        try {
            const result = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$optimization$2f$route$2d$planner$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["planRoute"])({
                waypoints,
                constraints
            });
            setRoute(result);
            return result;
        } catch (routeError) {
            const message = routeError instanceof Error ? routeError.message : "Route calculation failed.";
            setError(message);
            setRoute(null);
            return null;
        } finally{
            setIsLoading(false);
        }
    };
    const clearRoute = ()=>{
        setRoute(null);
        setError(null);
    };
    const applyRoute = (nextRoute)=>{
        setRoute(nextRoute);
        setError(null);
    };
    return {
        route,
        isLoading,
        error,
        calculateRoute,
        clearRoute,
        applyRoute
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/hooks/useTrailIntelligence.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useTrailIntelligence",
    ()=>useTrailIntelligence
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
async function postTrailIntelligence(route, userLocation) {
    const response = await fetch("/api/trail-intelligence", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            route,
            userLocation
        })
    });
    if (!response.ok) {
        const errorBody = await response.json().catch(()=>({}));
        throw new Error(errorBody.error ?? "Failed to generate trail briefing.");
    }
    return await response.json();
}
function useTrailIntelligence(route, userLocation) {
    const [report, setReport] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const activeRequestIdRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const userLat = userLocation?.lat;
    const userLng = userLocation?.lng;
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        activeRequestIdRef.current += 1;
        const requestId = activeRequestIdRef.current;
        if (!route) {
            setReport(null);
            setError(null);
            setIsLoading(false);
            return;
        }
        setIsLoading(true);
        setError(null);
        void (async ()=>{
            try {
                const nextReport = await postTrailIntelligence(route, userLat !== undefined && userLng !== undefined ? {
                    lat: userLat,
                    lng: userLng
                } : undefined);
                if (requestId !== activeRequestIdRef.current) {
                    return;
                }
                setReport(nextReport);
            } catch (trailError) {
                if (requestId !== activeRequestIdRef.current) {
                    return;
                }
                const message = trailError instanceof Error ? trailError.message : "Failed to load trail briefing.";
                setError(message);
                setReport(null);
            } finally{
                if (requestId === activeRequestIdRef.current) {
                    setIsLoading(false);
                }
            }
        })();
    }, [
        route,
        userLat,
        userLng
    ]);
    const clear = ()=>{
        activeRequestIdRef.current += 1;
        setReport(null);
        setError(null);
        setIsLoading(false);
    };
    return {
        report,
        isLoading,
        error,
        clear
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/types/walk-settings.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEFAULT_WALK_SETTINGS",
    ()=>DEFAULT_WALK_SETTINGS,
    "MIN_PACE_CHECK_INTERVAL_MS",
    ()=>MIN_PACE_CHECK_INTERVAL_MS,
    "clampPaceCheckInterval",
    ()=>clampPaceCheckInterval
]);
const MIN_PACE_CHECK_INTERVAL_MS = 30_000;
const DEFAULT_WALK_SETTINGS = {
    paceCheckEnabled: true,
    paceCheckIntervalMs: 60_000
};
function clampPaceCheckInterval(ms) {
    return Math.max(MIN_PACE_CHECK_INTERVAL_MS, ms);
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/hooks/useWalkSettings.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useWalkSettings",
    ()=>useWalkSettings
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/walk-settings.ts [app-ssr] (ecmascript)");
"use client";
;
;
const WALK_SETTINGS_STORAGE_KEY = "walk-settings";
function sanitizeSettings(candidate) {
    return {
        paceCheckEnabled: typeof candidate?.paceCheckEnabled === "boolean" ? candidate.paceCheckEnabled : __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_WALK_SETTINGS"].paceCheckEnabled,
        paceCheckIntervalMs: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clampPaceCheckInterval"])(typeof candidate?.paceCheckIntervalMs === "number" ? candidate.paceCheckIntervalMs : __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_WALK_SETTINGS"].paceCheckIntervalMs)
    };
}
function readStoredSettings() {
    if ("TURBOPACK compile-time truthy", 1) {
        return __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DEFAULT_WALK_SETTINGS"];
    }
    //TURBOPACK unreachable
    ;
}
function useWalkSettings() {
    const [settings, setSettingsState] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(()=>readStoredSettings());
    const setSettings = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useCallback"])((partial)=>{
        setSettingsState((current)=>{
            const next = sanitizeSettings({
                ...current,
                ...partial
            });
            if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
            ;
            return next;
        });
    }, []);
    return {
        settings,
        setSettings
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/hooks/useWaypoints.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useWaypoints",
    ()=>useWaypoints
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
"use client";
;
function createWaypointId() {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function useWaypoints(initialWaypoints = []) {
    const [waypoints, setWaypoints] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(initialWaypoints);
    const addWaypoint = ({ coordinates, name })=>{
        const nextWaypoint = {
            id: createWaypointId(),
            name: name?.trim() || `Waypoint ${waypoints.length + 1}`,
            coordinates,
            required: false,
            isStart: false,
            isEnd: false
        };
        setWaypoints((current)=>[
                ...current,
                nextWaypoint
            ]);
        return nextWaypoint;
    };
    const updateWaypoint = (id, updates)=>{
        setWaypoints((current)=>current.map((waypoint)=>waypoint.id === id ? {
                    ...waypoint,
                    ...updates
                } : waypoint));
    };
    const removeWaypoint = (id)=>{
        setWaypoints((current)=>current.filter((waypoint)=>waypoint.id !== id));
    };
    const reorderWaypoints = (fromIndex, toIndex)=>{
        if (fromIndex === toIndex) {
            return;
        }
        setWaypoints((current)=>{
            const next = [
                ...current
            ];
            const [moved] = next.splice(fromIndex, 1);
            if (!moved) {
                return current;
            }
            next.splice(toIndex, 0, moved);
            return next;
        });
    };
    const toggleRequired = (id)=>{
        setWaypoints((current)=>current.map((waypoint)=>waypoint.id === id ? {
                    ...waypoint,
                    required: !waypoint.required
                } : waypoint));
    };
    const setStartWaypoint = (id)=>{
        setWaypoints((current)=>current.map((waypoint)=>({
                    ...waypoint,
                    isStart: waypoint.id === id,
                    isEnd: waypoint.id === id ? false : waypoint.isEnd
                })));
    };
    const setEndWaypoint = (id)=>{
        setWaypoints((current)=>current.map((waypoint)=>({
                    ...waypoint,
                    isEnd: waypoint.id === id,
                    isStart: waypoint.id === id ? false : waypoint.isStart
                })));
    };
    const setWaypointTimeWindow = (id, timeWindow)=>{
        setWaypoints((current)=>current.map((waypoint)=>waypoint.id === id ? {
                    ...waypoint,
                    timeWindow
                } : waypoint));
    };
    const clearWaypoints = ()=>{
        setWaypoints([]);
    };
    return {
        waypoints,
        setWaypoints,
        addWaypoint,
        updateWaypoint,
        removeWaypoint,
        reorderWaypoints,
        toggleRequired,
        setStartWaypoint,
        setEndWaypoint,
        setWaypointTimeWindow,
        clearWaypoints
    };
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/hooks/index.ts [app-ssr] (ecmascript) <locals>", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useConstraints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useConstraints.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useHikeSearch$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useHikeSearch.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useMapInteraction$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useMapInteraction.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useRouteCalculation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useRouteCalculation.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useTrailIntelligence$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useTrailIntelligence.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useWalkSettings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useWalkSettings.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useWaypoints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useWaypoints.ts [app-ssr] (ecmascript)");
;
;
;
;
;
;
;
}),
"[project]/Documents/test/hiking-route-planner/src/lib/walk/gpx-exporter.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "downloadCsv",
    ()=>downloadCsv,
    "downloadGpx",
    ()=>downloadGpx,
    "exportToGpx",
    ()=>exportToGpx
]);
function escapeXml(value) {
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function localDateStamp(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}
function exportToGpx(points, walkName, attractions = []) {
    const safeName = escapeXml(walkName.trim() || "Walk");
    const wpts = attractions.map((a)=>`  <wpt lat="${a.coordinates.lat}" lon="${a.coordinates.lng}">
    <name>${escapeXml(a.name)}</name>
    <desc>${escapeXml(a.category)}</desc>
    <sym>Flag, Blue</sym>
  </wpt>`).join("\n");
    const trkpts = points.map((point)=>`      <trkpt lat="${point.lat}" lon="${point.lng}">
        <time>${new Date(point.timestamp).toISOString()}</time>
      </trkpt>`).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="hiking-route-planner" xmlns="http://www.topografix.com/GPX/1/1">
${wpts}
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}
function downloadGpx(points, walkName, attractions = []) {
    const gpx = exportToGpx(points, walkName, attractions);
    const blob = new Blob([
        gpx
    ], {
        type: "application/gpx+xml"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `walk-${localDateStamp(new Date())}.gpx`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}
function downloadCsv(points, attractions, walkName) {
    if (points.length === 0) return;
    const attractionHeaders = attractions.map((a)=>`"${a.name.replace(/"/g, '""')}"`);
    const header = [
        "timestamp",
        "lat",
        "lng",
        "pace_min_per_km",
        ...attractionHeaders
    ].join(",");
    const rows = points.map((p)=>{
        const distances = attractions.map((a)=>{
            const d = p.attractionDistances[a.id];
            return d !== undefined ? Math.round(d) : "";
        });
        return [
            new Date(p.timestamp).toISOString(),
            p.lat,
            p.lng,
            p.paceMinPerKm !== null ? p.paceMinPerKm.toFixed(1) : "",
            ...distances
        ].join(",");
    });
    const csv = [
        header,
        ...rows
    ].join("\n");
    const blob = new Blob([
        csv
    ], {
        type: "text/csv;charset=utf-8;"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `walk-data-${localDateStamp(new Date())}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "AttractionDistancesPanel",
    ()=>AttractionDistancesPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$constants$2f$categories$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/constants/categories.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
function AttractionDistancesPanel({ attractions, attractionDistances }) {
    if (attractions.length === 0) return null;
    const items = attractions.map((a)=>({
            attraction: a,
            meters: attractionDistances[a.id] ?? null
        })).filter((item)=>item.meters !== null).sort((a, b)=>(a.meters ?? 0) - (b.meters ?? 0));
    if (items.length === 0) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "rounded-lg border border-slate-200 bg-white shadow-sm",
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "border-b border-slate-100 px-3 py-2",
                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "text-xs font-semibold uppercase tracking-wide text-slate-500",
                    children: "Attractions ahead"
                }, void 0, false, {
                    fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
                    lineNumber: 25,
                    columnNumber: 9
                }, this)
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
                lineNumber: 24,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                className: "divide-y divide-slate-100",
                children: items.map(({ attraction, meters }, idx)=>{
                    const passed = meters === 0;
                    const isNext = idx === 0 && !passed;
                    const emoji = __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$constants$2f$categories$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["CATEGORY_EMOJI"][attraction.category] ?? "📍";
                    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
                        className: `flex items-center justify-between px-3 py-2 ${isNext ? "bg-emerald-50" : ""}`,
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex items-center gap-2 min-w-0",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "text-base leading-none",
                                        children: emoji
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
                                        lineNumber: 43,
                                        columnNumber: 17
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: `truncate text-sm ${passed ? "text-slate-400 line-through" : "text-slate-700"}`,
                                        children: attraction.name
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
                                        lineNumber: 44,
                                        columnNumber: 17
                                    }, this),
                                    isNext && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                        className: "shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700",
                                        children: "next"
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
                                        lineNumber: 52,
                                        columnNumber: 19
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
                                lineNumber: 42,
                                columnNumber: 15
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                className: `ml-3 shrink-0 text-sm font-medium tabular-nums ${passed ? "text-slate-400" : isNext ? "text-emerald-700" : "text-slate-600"}`,
                                children: passed ? "passed" : (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["formatDistance"])(meters ?? 0)
                            }, void 0, false, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
                                lineNumber: 57,
                                columnNumber: 15
                            }, this)
                        ]
                    }, attraction.id, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
                        lineNumber: 36,
                        columnNumber: 13
                    }, this);
                })
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
                lineNumber: 29,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/walk/pace-checker.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PaceChecker",
    ()=>PaceChecker
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/types/walk-settings.ts [app-ssr] (ecmascript)");
;
class PaceChecker {
    settings;
    plannedPaceMinPerKm;
    onSlowPace;
    intervalId = null;
    getLatestPaceRef = null;
    constructor(settings, plannedPaceMinPerKm, onSlowPace){
        this.settings = {
            ...settings,
            paceCheckIntervalMs: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clampPaceCheckInterval"])(settings.paceCheckIntervalMs)
        };
        this.plannedPaceMinPerKm = plannedPaceMinPerKm;
        this.onSlowPace = onSlowPace;
    }
    start(getLatestPace) {
        this.getLatestPaceRef = getLatestPace;
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        const intervalMs = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clampPaceCheckInterval"])(this.settings.paceCheckIntervalMs);
        this.intervalId = setInterval(()=>{
            if (!this.settings.paceCheckEnabled) {
                return;
            }
            const latestPace = this.getLatestPaceRef?.();
            if (latestPace === null || latestPace === undefined) {
                return;
            }
            if (latestPace > this.plannedPaceMinPerKm * 1.3) {
                this.onSlowPace(latestPace);
            }
        }, intervalMs);
    }
    stop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
    updateSettings(settings) {
        this.settings = {
            ...settings,
            paceCheckIntervalMs: (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$types$2f$walk$2d$settings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["clampPaceCheckInterval"])(settings.paceCheckIntervalMs)
        };
        const latestPaceGetter = this.getLatestPaceRef;
        this.stop();
        if (latestPaceGetter) {
            this.start(latestPaceGetter);
        }
    }
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/walk/deviation-detector.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "detectDeviation",
    ()=>detectDeviation,
    "remainingRoute",
    ()=>remainingRoute
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
;
// Only flag deviation when user is this far off-route
const DEVIATION_THRESHOLD_METERS = 50;
function detectDeviation(currentPosition, routeCoordinates) {
    if (routeCoordinates.length < 2) {
        return {
            deviationMeters: 0,
            needsReroute: false,
            closestPointOnRoute: routeCoordinates[0] ?? currentPosition,
            closestSegmentIndex: 0
        };
    }
    let minDist = Infinity;
    let closestPoint = routeCoordinates[0];
    let closestSegIdx = 0;
    for(let i = 0; i < routeCoordinates.length - 1; i++){
        const candidate = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["closestPointOnSegment"])(currentPosition, routeCoordinates[i], routeCoordinates[i + 1]);
        const dist = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(currentPosition, candidate);
        if (dist < minDist) {
            minDist = dist;
            closestPoint = candidate;
            closestSegIdx = i;
        }
    }
    return {
        deviationMeters: minDist,
        needsReroute: minDist > DEVIATION_THRESHOLD_METERS,
        closestPointOnRoute: closestPoint,
        closestSegmentIndex: closestSegIdx
    };
}
function remainingRoute(routeCoordinates, fromSegmentIndex, currentPosition) {
    if (fromSegmentIndex >= routeCoordinates.length - 1) {
        return [
            currentPosition
        ];
    }
    return [
        currentPosition,
        ...routeCoordinates.slice(fromSegmentIndex + 1)
    ];
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/walk/walk-recorder.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalkRecorder",
    ()=>WalkRecorder
]);
class WalkRecorder {
    intervalMs;
    intervalId = null;
    points = [];
    constructor(intervalMs = 30_000){
        this.intervalMs = intervalMs;
    }
    start(getLatestUpdate) {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
        }
        this.intervalId = setInterval(()=>{
            const update = getLatestUpdate();
            if (update === null) return;
            this.points.push({
                lat: update.currentPosition.lat,
                lng: update.currentPosition.lng,
                timestamp: update.timestamp,
                paceMinPerKm: update.paceMinPerKm,
                attractionDistances: update.attractionDistances
            });
        }, this.intervalMs);
    }
    stop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        return [
            ...this.points
        ];
    }
    clear() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.points = [];
    }
    getPoints() {
        return [
            ...this.points
        ];
    }
    get pointCount() {
        return this.points.length;
    }
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/walk/walk-tracker.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalkTracker",
    ()=>WalkTracker
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
;
/**
 * Compass bearing (degrees, 0 = north, clockwise) from a to b.
 */ function computeBearing(a, b) {
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
// Minimum distance between samples to compute a meaningful pace (avoids GPS noise)
const MIN_DISTANCE_FOR_PACE_METERS = 10;
// Keep last N samples for pace averaging
const PACE_SAMPLE_WINDOW = 5;
// Ignore positions with accuracy worse than this
const MAX_ACCURACY_METERS = 100;
class WalkTracker {
    watchId = null;
    samples = [];
    onUpdate;
    onError;
    attractions;
    geometry;
    lastAcceptedPosition = null;
    constructor(onUpdate, onError, attractions = [], geometry = []){
        this.onUpdate = onUpdate;
        this.onError = onError;
        this.attractions = attractions;
        this.geometry = geometry;
    }
    start() {
        if (!navigator.geolocation) {
            throw new Error("Geolocation is not supported by this browser.");
        }
        this.watchId = navigator.geolocation.watchPosition((pos)=>this.handlePosition(pos), (err)=>{
            this.onError?.({
                code: err.code,
                message: err.message,
                isTimeout: err.code === err.TIMEOUT
            });
        }, {
            enableHighAccuracy: true,
            maximumAge: 15000,
            timeout: 20000
        });
    }
    stop() {
        if (this.watchId !== null) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        this.samples = [];
        this.lastAcceptedPosition = null;
    }
    handlePosition(pos) {
        const accuracy = pos.coords.accuracy;
        // Discard low-accuracy readings
        if (accuracy > MAX_ACCURACY_METERS) return;
        const sample = {
            coordinates: {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude
            },
            timestamp: pos.timestamp,
            accuracyMeters: accuracy
        };
        const bearing = this.lastAcceptedPosition !== null ? computeBearing(this.lastAcceptedPosition, sample.coordinates) : undefined;
        this.lastAcceptedPosition = sample.coordinates;
        this.samples.push(sample);
        if (this.samples.length > PACE_SAMPLE_WINDOW) {
            this.samples.shift();
        }
        this.onUpdate({
            currentPosition: sample.coordinates,
            accuracyMeters: accuracy,
            paceMinPerKm: this.computePace(),
            timestamp: sample.timestamp,
            attractionDistances: this.computeAttractionDistances(sample.coordinates),
            bearing
        });
    }
    computeAttractionDistances(position) {
        const result = {};
        for (const attraction of this.attractions){
            result[attraction.id] = this.geometry.length >= 2 ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["routeDistanceBetween"])(this.geometry, position, attraction.coordinates) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(position, attraction.coordinates);
        }
        return result;
    }
    computePace() {
        if (this.samples.length < 2) return null;
        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        const distMeters = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(first.coordinates, last.coordinates);
        if (distMeters < MIN_DISTANCE_FOR_PACE_METERS) return null;
        const durationMs = last.timestamp - first.timestamp;
        if (durationMs <= 0) return null;
        const speedMps = distMeters / (durationMs / 1000);
        const paceMinPerKm = 1000 / 60 / speedMps;
        // Sanity clamp: 5 min/km (brisk walk) to 30 min/km (very slow)
        if (paceMinPerKm < 5 || paceMinPerKm > 30) return null;
        return paceMinPerKm;
    }
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/walk/simulated-walk-tracker.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SimulatedWalkTracker",
    ()=>SimulatedWalkTracker
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
;
class SimulatedWalkTracker {
    geometry;
    attractions;
    paceMinPerKm;
    speedMultiplier;
    tickMs;
    onUpdate;
    intervalId = null;
    distanceCovered = 0;
    simulatedTime = 0;
    cumulativeDist;
    totalDistance;
    constructor(geometry, onUpdate, attractions = [], paceMinPerKm = 15, speedMultiplier = 10, tickMs = 500){
        this.geometry = geometry;
        this.attractions = attractions;
        this.paceMinPerKm = paceMinPerKm;
        this.speedMultiplier = speedMultiplier;
        this.tickMs = tickMs;
        this.onUpdate = onUpdate;
        this.cumulativeDist = this.buildCumulativeDist(geometry);
        this.totalDistance = this.cumulativeDist[this.cumulativeDist.length - 1] ?? 0;
    }
    start() {
        if (this.geometry.length === 0) return;
        this.distanceCovered = 0;
        this.simulatedTime = Date.now();
        // e.g. 15 min/km → 1.11 m/s real → ×10 = 11.1 m/s simulated
        const metersPerTick = 1000 / (this.paceMinPerKm * 60) * this.speedMultiplier * (this.tickMs / 1000);
        const simMsPerTick = this.tickMs * this.speedMultiplier;
        this.intervalId = setInterval(()=>{
            this.distanceCovered = Math.min(this.distanceCovered + metersPerTick, this.totalDistance);
            this.simulatedTime += simMsPerTick;
            const position = this.interpolatePosition(this.distanceCovered);
            const update = {
                currentPosition: position,
                accuracyMeters: 5,
                paceMinPerKm: this.paceMinPerKm,
                timestamp: this.simulatedTime,
                attractionDistances: this.computeAttractionDistances(position)
            };
            this.onUpdate(update);
            if (this.distanceCovered >= this.totalDistance) {
                this.stop();
            }
        }, this.tickMs);
    }
    stop() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.distanceCovered = 0;
    }
    buildCumulativeDist(coords) {
        const result = [
            0
        ];
        for(let i = 1; i < coords.length; i++){
            result.push(result[i - 1] + (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(coords[i - 1], coords[i]));
        }
        return result;
    }
    interpolatePosition(dist) {
        if (this.geometry.length === 1) return this.geometry[0];
        let lo = 0;
        let hi = this.cumulativeDist.length - 2;
        while(lo < hi){
            const mid = lo + hi >> 1;
            if (this.cumulativeDist[mid + 1] < dist) {
                lo = mid + 1;
            } else {
                hi = mid;
            }
        }
        const segStart = this.cumulativeDist[lo];
        const segEnd = this.cumulativeDist[lo + 1];
        const segLen = segEnd - segStart;
        if (segLen === 0) return this.geometry[lo];
        const t = (dist - segStart) / segLen;
        const a = this.geometry[lo];
        const b = this.geometry[lo + 1];
        return {
            lat: a.lat + t * (b.lat - a.lat),
            lng: a.lng + t * (b.lng - a.lng)
        };
    }
    computeAttractionDistances(position) {
        const result = {};
        for (const attraction of this.attractions){
            result[attraction.id] = this.geometry.length >= 2 ? (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["routeDistanceBetween"])(this.geometry, position, attraction.coordinates) : (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(position, attraction.coordinates);
        }
        return result;
    }
}
}),
"[project]/Documents/test/hiking-route-planner/src/components/WalkRecordingPanel.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "WalkRecordingPanel",
    ()=>WalkRecordingPanel
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
"use client";
;
function WalkRecordingPanel({ isRecording, pointCount, onDownload, onDownloadCsv }) {
    if (!isRecording && pointCount === 0) {
        return null;
    }
    const plural = pointCount === 1 ? "" : "s";
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
        className: "space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm",
        children: [
            isRecording ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex items-center gap-2 text-sm text-slate-700",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        className: "h-2 w-2 animate-pulse rounded-full bg-emerald-500",
                        "aria-hidden": "true"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkRecordingPanel.tsx",
                        lineNumber: 26,
                        columnNumber: 11
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                        children: [
                            "Recording · ",
                            pointCount,
                            " point",
                            plural,
                            " captured"
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkRecordingPanel.tsx",
                        lineNumber: 30,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkRecordingPanel.tsx",
                lineNumber: 25,
                columnNumber: 9
            }, this) : null,
            pointCount > 0 ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex gap-2",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: onDownload,
                        className: "inline-flex h-9 flex-1 items-center justify-center rounded-md bg-emerald-600 px-3 text-sm font-medium text-white transition hover:bg-emerald-500",
                        children: "GPX"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkRecordingPanel.tsx",
                        lineNumber: 38,
                        columnNumber: 11
                    }, this),
                    onDownloadCsv ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        type: "button",
                        onClick: onDownloadCsv,
                        className: "inline-flex h-9 flex-1 items-center justify-center rounded-md border border-emerald-600 px-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50",
                        children: "CSV"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkRecordingPanel.tsx",
                        lineNumber: 46,
                        columnNumber: 13
                    }, this) : null
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkRecordingPanel.tsx",
                lineNumber: 37,
                columnNumber: 9
            }, this) : null
        ]
    }, void 0, true, {
        fileName: "[project]/Documents/test/hiking-route-planner/src/components/WalkRecordingPanel.tsx",
        lineNumber: 23,
        columnNumber: 5
    }, this);
}
}),
"[project]/Documents/test/hiking-route-planner/src/lib/walk/poi-alerter.ts [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "PoiAlerter",
    ()=>PoiAlerter
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/utils/geo.ts [app-ssr] (ecmascript)");
;
// POI must be within this radius to trigger an alert
const ALERT_RADIUS_METERS = 120;
// Minimum gap between any two alerts (ms)
const MIN_ALERT_GAP_MS = 5 * 60 * 1000; // 5 minutes
// POI must be roughly "ahead" — within this angular tolerance of travel direction
const DIRECTION_TOLERANCE_DEG = 70;
/**
 * Bearing from point a to point b, in degrees (0 = north, clockwise).
 */ function bearing(a, b) {
    const lat1 = a.lat * Math.PI / 180;
    const lat2 = b.lat * Math.PI / 180;
    const dLng = (b.lng - a.lng) * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function angleDiff(a, b) {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
}
function isAhead(current, travelDirection, poi) {
    if (travelDirection === null) return true; // no direction data — allow all
    const poiBearing = bearing(current, poi);
    return angleDiff(travelDirection, poiBearing) <= DIRECTION_TOLERANCE_DEG;
}
function alertMessage(attraction, distanceMeters) {
    const side = distanceMeters < 50 ? "right next to you" : `${Math.round(distanceMeters)} m away`;
    return `Nearby: ${attraction.name} (${side})`;
}
class PoiAlerter {
    lastAlertTime = -MIN_ALERT_GAP_MS;
    alertedIds = new Set();
    /**
   * Call this on every position update.
   * Returns at most one alert, or null if rate-limited / nothing nearby.
   */ check(currentPosition, travelDirection, nearbyPois, nowMs = Date.now()) {
        // Rate limit: no alert if we just showed one
        if (nowMs - this.lastAlertTime < MIN_ALERT_GAP_MS) return null;
        for (const poi of nearbyPois){
            // Skip already alerted POIs
            if (this.alertedIds.has(poi.id)) continue;
            const dist = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$utils$2f$geo$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["haversineDistance"])(currentPosition, poi.coordinates);
            if (dist > ALERT_RADIUS_METERS) continue;
            // Skip if behind the user
            if (!isAhead(currentPosition, travelDirection, poi.coordinates)) continue;
            this.lastAlertTime = nowMs;
            this.alertedIds.add(poi.id);
            return {
                attraction: poi,
                distanceMeters: dist,
                message: alertMessage(poi, dist)
            };
        }
        return null;
    }
    reset() {
        this.lastAlertTime = -MIN_ALERT_GAP_MS;
        this.alertedIds.clear();
    }
}
}),
"[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx [app-ssr] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>HomePage
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react-jsx-dev-runtime.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/node_modules/next/dist/server/route-modules/app-page/vendored/ssr/react.js [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/constraints/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$ConstraintPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/constraints/ConstraintPanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$map$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/map/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$map$2f$DynamicMap$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/map/DynamicMap.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$HikeSearchPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/HikeSearchPanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$RouteResults$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/RouteResults.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$TrailIntelligencePanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/TrailIntelligencePanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$WalkCompanionPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/WalkCompanionPanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$WalkPlanResults$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/route/WalkPlanResults.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$walk$2f$OffRouteNotification$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/walk/OffRouteNotification.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Button.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/ui/Card.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/waypoints/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$PlaceSearch$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/waypoints/PlaceSearch.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$WaypointList$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/waypoints/WaypointList.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$index$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__$3c$locals$3e$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/index.ts [app-ssr] (ecmascript) <locals>");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useConstraints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useConstraints.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useHikeSearch$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useHikeSearch.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useMapInteraction$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useMapInteraction.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useRouteCalculation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useRouteCalculation.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useTrailIntelligence$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useTrailIntelligence.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useWalkSettings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useWalkSettings.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useWaypoints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/hooks/useWaypoints.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$gpx$2d$exporter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/walk/gpx-exporter.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$walk$2f$AttractionDistancesPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/walk/AttractionDistancesPanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$pace$2d$checker$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/walk/pace-checker.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$deviation$2d$detector$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/walk/deviation-detector.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$walk$2d$recorder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/walk/walk-recorder.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$walk$2d$tracker$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/walk/walk-tracker.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$simulated$2d$walk$2d$tracker$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/walk/simulated-walk-tracker.ts [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$WalkRecordingPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/components/WalkRecordingPanel.tsx [app-ssr] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$poi$2d$alerter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/Documents/test/hiking-route-planner/src/lib/walk/poi-alerter.ts [app-ssr] (ecmascript)");
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
;
function HomePage() {
    const [plannerMode, setPlannerMode] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("manual");
    const [hikeSearchOriginInput, setHikeSearchOriginInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({
        lat: "31.7683",
        lng: "35.2137"
    });
    const [useMapClickForHikeOrigin, setUseMapClickForHikeOrigin] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const { waypoints, setWaypoints, addWaypoint, updateWaypoint, removeWaypoint, reorderWaypoints, toggleRequired, setStartWaypoint, setEndWaypoint, setWaypointTimeWindow, clearWaypoints } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useWaypoints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useWaypoints"])();
    const { constraints, toggleMaxDistance, setMaxDistanceKm, toggleTimeWindows, setDefaultTimeWindow, toggleFixedStartEnd } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useConstraints$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useConstraints"])();
    const { route, isLoading, error, calculateRoute, clearRoute, applyRoute } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useRouteCalculation$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRouteCalculation"])();
    const { isSearching, error: hikeSearchError, findHike, cancelSearch } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useHikeSearch$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useHikeSearch"])();
    const [walkPlan, setWalkPlan] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [walkPlanError, setWalkPlanError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [isWalkPlanLoading, setIsWalkPlanLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const { settings: walkSettings, setSettings: setWalkSettings } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useWalkSettings$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useWalkSettings"])();
    const walkInputRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const walkStartTimeRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const latestPaceUpdateRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const walkTrackerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [isSimulating, setIsSimulating] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const paceCheckerRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const walkRecorderRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const poiAlerterRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const [poiAlert, setPoiAlert] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const poiAlertTimeoutRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(null);
    const buildWalkRequestIdRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const lastGpsUpdateRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])(0);
    const walkGeometryRef = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useRef"])([]);
    const [lastWalkInput, setLastWalkInput] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [recordedPointCount, setRecordedPointCount] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [isRecording, setIsRecording] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [currentPosition, setCurrentPosition] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [remainingGeometry, setRemainingGeometry] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isOffRoute, setIsOffRoute] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(false);
    const [offRouteDeviation, setOffRouteDeviation] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(0);
    const [walkPhase, setWalkPhase] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])("idle");
    const [mapClickedCoords, setMapClickedCoords] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [walkTrackingMessage, setWalkTrackingMessage] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])(null);
    const [attractionDistances, setAttractionDistances] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useState"])({});
    const routeAnchor = route?.orderedWaypoints[0]?.coordinates ?? route?.geometry[0];
    const { report: trailBriefing, isLoading: isTrailBriefingLoading, error: trailBriefingError } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useTrailIntelligence$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useTrailIntelligence"])(route, routeAnchor);
    const { center, zoom, clickMode, setClickMode, focusOn } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$hooks$2f$useMapInteraction$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useMapInteraction"])();
    const stopWalkTracking = ()=>{
        paceCheckerRef.current?.stop();
        paceCheckerRef.current = null;
        walkTrackerRef.current?.stop();
        walkTrackerRef.current = null;
        walkRecorderRef.current?.stop();
        walkRecorderRef.current = null;
        poiAlerterRef.current = null;
        if (poiAlertTimeoutRef.current !== null) {
            clearTimeout(poiAlertTimeoutRef.current);
            poiAlertTimeoutRef.current = null;
        }
        setIsRecording(false);
        setCurrentPosition(null);
        setRemainingGeometry([]);
        setIsOffRoute(false);
        setOffRouteDeviation(0);
        setWalkPhase("idle");
        setWalkTrackingMessage(null);
        setAttractionDistances({});
        setPoiAlert(null);
    };
    const handleBuildWalk = async (input)=>{
        stopWalkTracking();
        walkInputRef.current = input;
        setLastWalkInput(input);
        walkStartTimeRef.current = Date.now();
        latestPaceUpdateRef.current = null;
        setCurrentPosition(input.origin);
        buildWalkRequestIdRef.current += 1;
        const requestId = buildWalkRequestIdRef.current;
        setWalkPlanError(null);
        setWalkPlan(null);
        setIsWalkPlanLoading(true);
        try {
            const res = await fetch("/api/walk-plan", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    lat: input.origin.lat,
                    lng: input.origin.lng,
                    availableMinutes: input.availableMinutes,
                    walkingPaceMinPerKm: input.walkingPaceMinPerKm,
                    radiusMeters: input.radiusMeters,
                    preferredCategories: input.preferredCategories
                })
            });
            const data = await res.json();
            // Bail if a newer request has superseded this one
            if (requestId !== buildWalkRequestIdRef.current) return;
            if (!res.ok || data.error) {
                setWalkPlanError(data.error ?? "Failed to build walk plan.");
            } else {
                setWalkPlan(data);
                setWalkPhase("planned");
                walkGeometryRef.current = data.geometry ?? [];
                setRemainingGeometry(data.geometry ?? []);
                setIsOffRoute(false);
                setOffRouteDeviation(0);
                setWalkTrackingMessage(null);
                // Show attraction markers on the map
                clearWaypoints();
                clearRoute();
                const attractionWaypoints = data.orderedAttractions.map((a, i)=>({
                        id: a.id,
                        name: `${i + 1}. ${a.name}`,
                        coordinates: a.coordinates,
                        required: true,
                        isStart: i === 0,
                        isEnd: i === data.orderedAttractions.length - 1
                    }));
                attractionWaypoints.forEach((w)=>addWaypoint(w));
                // If ORS returned geometry, show the route line on the map
                if (data.geometry && data.geometry.length > 0) {
                    applyRoute({
                        orderedWaypoints: attractionWaypoints,
                        geometry: data.geometry,
                        totalDistanceMeters: data.totalDistanceMeters,
                        totalDurationSeconds: data.totalMinutes * 60,
                        segments: [],
                        warnings: []
                    });
                }
                if (data.orderedAttractions[0]) {
                    focusOn(data.orderedAttractions[0].coordinates, 14);
                }
            }
        } catch  {
            if (requestId !== buildWalkRequestIdRef.current) return;
            setWalkPlanError("Network error. Please try again.");
        } finally{
            if (requestId === buildWalkRequestIdRef.current) {
                setIsWalkPlanLoading(false);
            }
        }
    };
    const handleStartWalk = ()=>{
        if (!walkPlan || walkGeometryRef.current.length === 0) {
            setWalkPlanError("Build a walk plan before starting live tracking.");
            return;
        }
        const initialPosition = currentPosition ?? walkInputRef.current?.origin ?? walkGeometryRef.current[0] ?? null;
        stopWalkTracking();
        latestPaceUpdateRef.current = null;
        setRecordedPointCount(0);
        setCurrentPosition(initialPosition);
        setIsOffRoute(false);
        setOffRouteDeviation(0);
        setWalkPhase("walking");
        setWalkTrackingMessage(null);
        if (initialPosition) {
            const initialDeviation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$deviation$2d$detector$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["detectDeviation"])(initialPosition, walkGeometryRef.current);
            setRemainingGeometry((0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$deviation$2d$detector$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["remainingRoute"])(walkGeometryRef.current, initialDeviation.closestSegmentIndex, initialPosition));
        } else {
            setRemainingGeometry(walkGeometryRef.current);
        }
        const attractions = walkPlan?.orderedAttractions ?? [];
        // Instantiate PoiAlerter for this walk session (CRITICAL-1)
        const alerter = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$poi$2d$alerter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PoiAlerter"]();
        poiAlerterRef.current = alerter;
        const onPositionUpdate = (update)=>{
            latestPaceUpdateRef.current = update;
            // PoiAlerter check — runs every tick, not throttled (CRITICAL-1)
            const alert = alerter.check(update.currentPosition, update.bearing ?? null, attractions);
            if (alert) {
                setPoiAlert(alert);
                // Auto-dismiss after 8 seconds
                if (poiAlertTimeoutRef.current !== null) clearTimeout(poiAlertTimeoutRef.current);
                poiAlertTimeoutRef.current = setTimeout(()=>setPoiAlert(null), 8000);
            }
            // Throttle setState calls to at most once per second (LOW-2)
            const now = Date.now();
            if (now - lastGpsUpdateRef.current < 1000) return;
            lastGpsUpdateRef.current = now;
            setCurrentPosition(update.currentPosition);
            setAttractionDistances(update.attractionDistances);
            setWalkTrackingMessage(null);
            const deviation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$deviation$2d$detector$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["detectDeviation"])(update.currentPosition, walkGeometryRef.current);
            if (deviation.needsReroute) {
                setIsOffRoute(true);
                setOffRouteDeviation(Math.round(deviation.deviationMeters));
            } else {
                setIsOffRoute(false);
                setOffRouteDeviation(0);
            }
            const remaining = (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$deviation$2d$detector$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["remainingRoute"])(walkGeometryRef.current, deviation.closestSegmentIndex, update.currentPosition);
            setRemainingGeometry(remaining);
        };
        const onGpsError = (error)=>{
            if (error.isTimeout) {
                setWalkTrackingMessage("GPS signal is weak right now. Waiting for the next location update...");
                return;
            }
            setWalkTrackingMessage(`Live tracking issue: ${error.message}`);
        };
        const tracker = isSimulating ? new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$simulated$2d$walk$2d$tracker$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["SimulatedWalkTracker"](walkGeometryRef.current, onPositionUpdate, attractions, walkInputRef.current?.walkingPaceMinPerKm ?? 15) : new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$walk$2d$tracker$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WalkTracker"](onPositionUpdate, onGpsError, attractions, walkGeometryRef.current);
        walkTrackerRef.current = tracker;
        tracker.start();
        const recorder = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$walk$2d$recorder$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WalkRecorder"](30_000);
        walkRecorderRef.current = recorder;
        setIsRecording(true);
        recorder.start(()=>{
            const update = latestPaceUpdateRef.current;
            if (update) {
                setRecordedPointCount((count)=>count + 1);
            }
            return update;
        });
        const input = walkInputRef.current;
        if (!input) {
            return;
        }
        const checker = new __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$pace$2d$checker$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PaceChecker"](walkSettings, input.walkingPaceMinPerKm, ()=>{
            const orig = walkInputRef.current;
            if (!orig) return;
            // Only auto-rebuild when the user is actually walking (CRITICAL-2)
            // This ref closure captures the live walkPhase via the setter comparison below
            // We re-read walkPhase by checking the tracker is still active
            if (walkTrackerRef.current === null) return;
            const elapsedMinutes = (Date.now() - walkStartTimeRef.current) / 60_000;
            const remainingMinutes = Math.max(15, orig.availableMinutes - elapsedMinutes);
            const currentPos = latestPaceUpdateRef.current?.currentPosition ?? orig.origin;
            void handleBuildWalk({
                ...orig,
                origin: currentPos,
                availableMinutes: remainingMinutes
            });
        });
        paceCheckerRef.current = checker;
        checker.start(()=>latestPaceUpdateRef.current?.paceMinPerKm ?? null);
    };
    // Keep PaceChecker in sync when settings change while a walk is active
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["useEffect"])(()=>{
        paceCheckerRef.current?.updateSettings(walkSettings);
    }, [
        walkSettings
    ]);
    const handleMapClick = (coordinates)=>{
        if (plannerMode === "hike-search") {
            if (useMapClickForHikeOrigin) {
                setHikeSearchOriginInput({
                    lat: coordinates.lat.toFixed(6),
                    lng: coordinates.lng.toFixed(6)
                });
            }
            return;
        }
        if (plannerMode === "walk-companion") {
            setMapClickedCoords(coordinates);
            setCurrentPosition(coordinates);
            focusOn(coordinates, 16);
            return;
        }
        if (plannerMode !== "manual") {
            return;
        }
        if (clickMode === "add-waypoint") {
            addWaypoint({
                coordinates
            });
            return;
        }
        const nextWaypoint = addWaypoint({
            coordinates,
            name: clickMode === "set-start" ? "Custom Start" : "Custom End"
        });
        if (clickMode === "set-start") {
            setStartWaypoint(nextWaypoint.id);
        } else {
            setEndWaypoint(nextWaypoint.id);
        }
        setClickMode("add-waypoint");
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$walk$2f$OffRouteNotification$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["OffRouteNotification"], {
                visible: isOffRoute,
                deviationMeters: offRouteDeviation
            }, void 0, false, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                lineNumber: 414,
                columnNumber: 7
            }, this),
            poiAlert && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-medium text-white shadow-lg",
                children: [
                    poiAlert.message,
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                        className: "ml-3 text-emerald-200 hover:text-white",
                        onClick: ()=>setPoiAlert(null),
                        children: "✕"
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                        lineNumber: 422,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                lineNumber: 420,
                columnNumber: 9
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                className: "flex min-h-screen w-full flex-col lg:h-screen lg:flex-row lg:overflow-hidden",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                        className: "order-2 w-full overflow-y-auto border-b border-slate-200 bg-slate-50 p-4 pb-8 lg:order-1 lg:h-full lg:max-w-[400px] lg:border-b-0 lg:border-r lg:pb-4",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "mb-4 space-y-1",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                        className: "text-xl font-bold text-slate-900",
                                        children: "Hiking Route Planner"
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                        lineNumber: 433,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                        className: "text-xs text-slate-500",
                                        children: "Add waypoints, configure constraints, and generate an optimized walking route."
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                        lineNumber: 434,
                                        columnNumber: 11
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                lineNumber: 432,
                                columnNumber: 9
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "space-y-4",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                                        className: "space-y-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-sm font-semibold text-slate-900",
                                                children: "Planning mode"
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 441,
                                                columnNumber: 13
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "grid grid-cols-3 gap-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                        variant: plannerMode === "manual" ? "primary" : "secondary",
                                                        onClick: ()=>setPlannerMode("manual"),
                                                        children: "Manual"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 443,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                        variant: plannerMode === "hike-search" ? "primary" : "secondary",
                                                        onClick: ()=>setPlannerMode("hike-search"),
                                                        children: "Hike"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 449,
                                                        columnNumber: 15
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                        variant: plannerMode === "walk-companion" ? "primary" : "secondary",
                                                        onClick: ()=>setPlannerMode("walk-companion"),
                                                        children: "City Walk"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 455,
                                                        columnNumber: 15
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 442,
                                                columnNumber: 13
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                        lineNumber: 440,
                                        columnNumber: 11
                                    }, this),
                                    plannerMode === "manual" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$PlaceSearch$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["PlaceSearch"], {
                                                onSelectPlace: (place)=>{
                                                    addWaypoint({
                                                        coordinates: place.coordinates,
                                                        name: place.name
                                                    });
                                                    focusOn(place.coordinates, 14);
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 466,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                                                className: "space-y-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "text-sm font-semibold text-slate-900",
                                                        children: "Map click mode"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 477,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "grid grid-cols-3 gap-2",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                                variant: clickMode === "add-waypoint" ? "primary" : "secondary",
                                                                onClick: ()=>setClickMode("add-waypoint"),
                                                                children: "Add"
                                                            }, void 0, false, {
                                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                                lineNumber: 479,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                                variant: clickMode === "set-start" ? "primary" : "secondary",
                                                                onClick: ()=>setClickMode("set-start"),
                                                                children: "Start"
                                                            }, void 0, false, {
                                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                                lineNumber: 485,
                                                                columnNumber: 19
                                                            }, this),
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                                variant: clickMode === "set-end" ? "primary" : "secondary",
                                                                onClick: ()=>setClickMode("set-end"),
                                                                children: "End"
                                                            }, void 0, false, {
                                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                                lineNumber: 491,
                                                                columnNumber: 19
                                                            }, this)
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 478,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 476,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$waypoints$2f$WaypointList$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WaypointList"], {
                                                waypoints: waypoints,
                                                onRename: (id, name)=>updateWaypoint(id, {
                                                        name
                                                    }),
                                                onToggleRequired: toggleRequired,
                                                onSetStart: setStartWaypoint,
                                                onSetEnd: setEndWaypoint,
                                                onDelete: removeWaypoint,
                                                onReorder: reorderWaypoints,
                                                onSetTimeWindow: setWaypointTimeWindow
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 500,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$constraints$2f$ConstraintPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["ConstraintPanel"], {
                                                constraints: constraints,
                                                isCalculating: isLoading,
                                                onToggleMaxDistance: toggleMaxDistance,
                                                onSetMaxDistanceKm: setMaxDistanceKm,
                                                onToggleTimeWindows: toggleTimeWindows,
                                                onSetDefaultTimeWindow: setDefaultTimeWindow,
                                                onToggleFixedStartEnd: toggleFixedStartEnd,
                                                onCalculateRoute: ()=>{
                                                    void calculateRoute(waypoints, constraints);
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 511,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true) : plannerMode === "walk-companion" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Fragment"], {
                                        children: [
                                            walkPhase !== "walking" && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("label", {
                                                className: "flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("input", {
                                                        type: "checkbox",
                                                        checked: isSimulating,
                                                        onChange: (e)=>setIsSimulating(e.target.checked),
                                                        className: "h-4 w-4 rounded border-amber-400 accent-amber-500"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 528,
                                                        columnNumber: 19
                                                    }, this),
                                                    "Simulate walk (dev mode — 10× speed)"
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 527,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$WalkCompanionPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WalkCompanionPanel"], {
                                                isLoading: isWalkPlanLoading,
                                                onBuildWalk: (input)=>{
                                                    void handleBuildWalk(input);
                                                },
                                                walkSettings: walkSettings,
                                                onWalkSettingsChange: setWalkSettings,
                                                mapClickedCoords: mapClickedCoords,
                                                onLocationDetected: (coords)=>{
                                                    setCurrentPosition(coords);
                                                    focusOn(coords, 16);
                                                },
                                                walkPlanReady: walkPhase === "planned" || walkPhase === "walking",
                                                onStartWalk: handleStartWalk,
                                                onStopWalk: stopWalkTracking,
                                                isWalking: walkPhase === "walking"
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 537,
                                                columnNumber: 15
                                            }, this),
                                            walkPlan?.warnings?.some((w)=>w.includes("geometry")) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-amber-700",
                                                    children: "⚠️ Route geometry is unavailable (ORS API key not configured). Start Walk is disabled."
                                                }, void 0, false, {
                                                    fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                    lineNumber: 555,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 554,
                                                columnNumber: 17
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$WalkRecordingPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WalkRecordingPanel"], {
                                                isRecording: isRecording,
                                                pointCount: recordedPointCount,
                                                onDownload: ()=>{
                                                    const points = walkRecorderRef.current?.getPoints() ?? [];
                                                    if (points.length > 0) (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$gpx$2d$exporter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["downloadGpx"])(points, "My Walk", walkPlan?.orderedAttractions ?? []);
                                                },
                                                onDownloadCsv: ()=>{
                                                    const points = walkRecorderRef.current?.getPoints() ?? [];
                                                    if (points.length > 0) (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$lib$2f$walk$2f$gpx$2d$exporter$2e$ts__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["downloadCsv"])(points, walkPlan?.orderedAttractions ?? [], "My Walk");
                                                }
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 560,
                                                columnNumber: 15
                                            }, this),
                                            walkPhase === "walking" && walkPlan && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$walk$2f$AttractionDistancesPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["AttractionDistancesPanel"], {
                                                attractions: walkPlan.orderedAttractions,
                                                attractionDistances: attractionDistances
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 573,
                                                columnNumber: 17
                                            }, this),
                                            isWalkPlanLoading && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                                                className: "space-y-2 animate-pulse",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-4 w-1/2 rounded bg-slate-200"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 581,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-3 w-full rounded bg-slate-100"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 582,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-3 w-5/6 rounded bg-slate-100"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 583,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                        className: "h-3 w-4/6 rounded bg-slate-100"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 584,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 580,
                                                columnNumber: 17
                                            }, this),
                                            !isWalkPlanLoading && walkPlan && lastWalkInput && (!walkPlan.feasible || walkPlan.droppedAttractions.length > 0) && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                                                className: "space-y-2",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "text-sm text-amber-700",
                                                        children: !walkPlan.feasible ? "No attractions fit your time budget." : `Only ${walkPlan.orderedAttractions.length} of ${walkPlan.orderedAttractions.length + walkPlan.droppedAttractions.length} attractions fit — expand time or radius?`
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 591,
                                                        columnNumber: 21
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                        variant: "secondary",
                                                        onClick: ()=>{
                                                            void handleBuildWalk({
                                                                ...lastWalkInput,
                                                                availableMinutes: lastWalkInput.availableMinutes + 15
                                                            });
                                                        },
                                                        children: "+ 15 min and retry"
                                                    }, void 0, false, {
                                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                        lineNumber: 596,
                                                        columnNumber: 21
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 590,
                                                columnNumber: 19
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$WalkPlanResults$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["WalkPlanResults"], {
                                                plan: walkPlan,
                                                error: walkPlanError,
                                                walkOrigin: lastWalkInput?.origin,
                                                walkMinutes: lastWalkInput?.availableMinutes,
                                                walkRadius: lastWalkInput?.radiusMeters
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 610,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("a", {
                                                href: lastWalkInput ? `/tsp-debug?lat=${lastWalkInput.origin.lat}&lng=${lastWalkInput.origin.lng}&minutes=${lastWalkInput.availableMinutes}&radius=${lastWalkInput.radiusMeters}` : "/tsp-debug",
                                                target: "_blank",
                                                rel: "noopener noreferrer",
                                                className: "inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white py-2 text-xs font-medium text-slate-700 hover:bg-slate-50",
                                                children: "🔬 View TSP Graph"
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 617,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$TrailIntelligencePanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TrailIntelligencePanel"], {
                                                report: trailBriefing,
                                                isLoading: isTrailBriefingLoading,
                                                error: trailBriefingError
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 627,
                                                columnNumber: 15
                                            }, this),
                                            walkTrackingMessage ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                    className: "text-sm text-amber-700",
                                                    children: walkTrackingMessage
                                                }, void 0, false, {
                                                    fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                    lineNumber: 634,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 633,
                                                columnNumber: 17
                                            }, this) : null
                                        ]
                                    }, void 0, true) : /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$HikeSearchPanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["HikeSearchPanel"], {
                                        isSearching: isSearching,
                                        originLatValue: hikeSearchOriginInput.lat,
                                        originLngValue: hikeSearchOriginInput.lng,
                                        onOriginInputChange: setHikeSearchOriginInput,
                                        useMapClickForOrigin: useMapClickForHikeOrigin,
                                        onUseMapClickForOriginChange: setUseMapClickForHikeOrigin,
                                        onFindHike: ({ origin, endpoint, maxDistanceKm, maxStartDistanceKm, maxFinishDistanceFromOriginKm, desiredRouteCount })=>{
                                            void (async ()=>{
                                                cancelSearch();
                                                const searchConstraints = maxDistanceKm && maxDistanceKm > 0 ? {
                                                    ...constraints,
                                                    maxDistance: {
                                                        enabled: true,
                                                        maxKm: maxDistanceKm
                                                    }
                                                } : constraints;
                                                const result = await findHike({
                                                    origin,
                                                    endpoint,
                                                    preferences: {
                                                        maxDistanceMeters: maxDistanceKm && maxDistanceKm > 0 ? maxDistanceKm * 1000 : undefined,
                                                        maxStartDistanceMeters: maxStartDistanceKm && maxStartDistanceKm > 0 ? maxStartDistanceKm * 1000 : undefined,
                                                        maxFinishDistanceFromOriginMeters: maxFinishDistanceFromOriginKm && maxFinishDistanceFromOriginKm > 0 ? maxFinishDistanceFromOriginKm * 1000 : undefined,
                                                        desiredRouteCount: desiredRouteCount && desiredRouteCount > 0 ? desiredRouteCount : 1
                                                    }
                                                }, searchConstraints);
                                                if (!result) {
                                                    return;
                                                }
                                                applyRoute(result.route);
                                                setWaypoints(result.route.orderedWaypoints);
                                                const firstPoint = result.route.geometry[0];
                                                if (firstPoint) {
                                                    focusOn(firstPoint, 13);
                                                }
                                            })();
                                        }
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                        lineNumber: 639,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Card$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Card"], {
                                        className: "grid grid-cols-2 gap-2",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                variant: "ghost",
                                                onClick: ()=>{
                                                    clearRoute();
                                                },
                                                children: "Clear Route"
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 710,
                                                columnNumber: 13
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$ui$2f$Button$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["Button"], {
                                                variant: "danger",
                                                onClick: ()=>{
                                                    clearWaypoints();
                                                    clearRoute();
                                                    cancelSearch();
                                                    stopWalkTracking();
                                                    walkRecorderRef.current?.clear();
                                                    setRecordedPointCount(0);
                                                },
                                                children: "Clear All"
                                            }, void 0, false, {
                                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                                lineNumber: 718,
                                                columnNumber: 13
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                        lineNumber: 709,
                                        columnNumber: 11
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$RouteResults$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["RouteResults"], {
                                        route: route,
                                        error: hikeSearchError ?? error
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                        lineNumber: 733,
                                        columnNumber: 11
                                    }, this),
                                    plannerMode !== "walk-companion" ? /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$route$2f$TrailIntelligencePanel$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["TrailIntelligencePanel"], {
                                        report: trailBriefing,
                                        isLoading: isTrailBriefingLoading,
                                        error: trailBriefingError
                                    }, void 0, false, {
                                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                        lineNumber: 735,
                                        columnNumber: 13
                                    }, this) : null
                                ]
                            }, void 0, true, {
                                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                                lineNumber: 439,
                                columnNumber: 9
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                        lineNumber: 431,
                        columnNumber: 7
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])("section", {
                        className: "relative order-1 h-[45vh] min-h-[320px] flex-1 overflow-hidden lg:order-2 lg:h-full",
                        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$node_modules$2f$next$2f$dist$2f$server$2f$route$2d$modules$2f$app$2d$page$2f$vendored$2f$ssr$2f$react$2d$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$Documents$2f$test$2f$hiking$2d$route$2d$planner$2f$src$2f$components$2f$map$2f$DynamicMap$2e$tsx__$5b$app$2d$ssr$5d$__$28$ecmascript$29$__["DynamicMap"], {
                            waypoints: waypoints,
                            routeGeometry: walkPhase === "walking" ? remainingGeometry : route?.geometry ?? [],
                            center: center,
                            zoom: zoom,
                            onMapClick: handleMapClick,
                            currentPosition: currentPosition ?? undefined,
                            followPosition: walkPhase === "walking"
                        }, void 0, false, {
                            fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                            lineNumber: 745,
                            columnNumber: 9
                        }, this)
                    }, void 0, false, {
                        fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                        lineNumber: 744,
                        columnNumber: 7
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/Documents/test/hiking-route-planner/src/app/app/page.tsx",
                lineNumber: 430,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true);
}
}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__d846c45d._.js.map