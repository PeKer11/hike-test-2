// Contact sheet of the Traike icon set (docs/FEEDBACK-ROUND-2026-11-22.md item 5, batch B).
//
//   node scripts/icons-sheet.mjs [outDir]        (default docs/design-brief/shots/r14)
//
// Renders every export of src/components/ui/icons.tsx at 22 px (the real size) and enlarged, in light, dark and
// Hebrew (dir=rtl), plus the tab bar, the map buttons and the chat header as they use the set. Writes
// icons-sheet.html and one PNG per variant. No network, no API keys.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, process.argv[2] ?? "docs/design-brief/shots/r14");
mkdirSync(outDir, { recursive: true });

const vite = await createServer({
  root,
  configFile: false,
  logLevel: "error",
  appType: "custom",
  server: { middlewareMode: true },
  esbuild: { jsx: "automatic" },
  resolve: { alias: { "@": resolve(root, "src") } },
});
const icons = await vite.ssrLoadModule("/src/components/ui/icons.tsx");
await vite.close();

const render = (Icon, props = {}) => renderToStaticMarkup(createElement(Icon, props));
const names = Object.keys(icons).filter((n) => n.endsWith("Icon"));

const FUNCTION = {
  HomeIcon: "Home tab",
  PlanIcon: "Plan tab, custom walk",
  WalkIcon: "Walk tab, walker",
  WalksIcon: "Walks tab (saved)",
  PersonIcon: "Me tab",
  PeopleIcon: "Friends",
  SlidersIcon: "Assistant preferences",
  MicIcon: "Dictate",
  SpeakerIcon: "Read aloud",
  StopIcon: "Stop, end walk",
  ImageIcon: "Add image",
  ChatIcon: "Ask",
  NavArrowIcon: "Re-centre on me",
  FitRouteIcon: "Show whole route",
  LayersIcon: "Map layers",
  ExpandIcon: "Full map",
  CollapseIcon: "Smaller map",
  PlusIcon: "Add",
  BackIcon: "Back",
  ArrowIcon: "Go on",
  ChevronDownIcon: "Minimise",
  RefreshIcon: "Start over",
  CloseIcon: "Close, remove",
  CheckIcon: "Done, added",
  WarnIcon: "Warning",
  InfoIcon: "Info",
  StarIcon: "Recommend, rating",
  ClockIcon: "Time",
  TrailIcon: "Distance",
};

const TOKENS = `
:root{--tk-cream:#f8f3ea;--tk-forest:#1e3d2f;--tk-terra:#c15f3c;--tk-leather:#d2602f;--tk-ink:#1b2620;--tk-hair:#ddd2c0;--tk-bar:#f0e8da;--tk-ctl:#1b2620;--tk-sel:#1b2620;--tk-on-sel:#f8f3ea;--tk-paper:#f8f3ea;--tk-on-leather:#111915}
:root[data-theme=dark]{--tk-cream:#1a1613;--tk-forest:#9fcbb0;--tk-terra:#e2805a;--tk-leather:#e06a38;--tk-ink:#f2eadc;--tk-hair:#3a322a;--tk-bar:#231e19;--tk-ctl:#f2eadc;--tk-sel:#ede3d3;--tk-on-sel:#1a1613;--tk-paper:#29221c;--tk-on-leather:#111915}
`;

const CSS = `
${TOKENS}
*{box-sizing:border-box}
body{margin:0;padding:24px;background:var(--tk-cream);color:var(--tk-ink);font:15px/1.3 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 8px}p.n{margin:0 0 12px;color:var(--tk-ink);opacity:.7}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:10px}
.cell{border:1px solid var(--tk-hair);border-radius:6px;padding:10px;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center}
.cell .big{color:var(--tk-forest)}.cell .big svg{width:64px;height:64px}
.cell .real{display:flex;gap:10px;align-items:center;color:var(--tk-ink)}
.cell small{font-size:12px;opacity:.75}.cell b{font-size:12px}
.row{display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start}
.bar{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;border:1.5px solid var(--tk-ctl);background:var(--tk-cream);padding:4px;width:390px;--tk-nav-fill:var(--tk-cream)}
.tab{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:52px;border-radius:6px;font-size:14px;font-weight:600;color:var(--tk-ctl)}
.tab.on{background:var(--tk-sel);color:var(--tk-on-sel);--tk-nav-fill:var(--tk-sel)}
.dot{position:absolute;top:5px;inset-inline-end:28%;width:10px;height:10px;border-radius:9999px;background:var(--tk-leather);box-shadow:0 0 0 2px var(--tk-nav-fill)}
.glyphs{display:flex;flex-direction:column;gap:8px;padding:14px;background:#6f7d5c;border-radius:6px}
.g{width:44px;height:44px;border-radius:9999px;background:var(--tk-paper);color:var(--tk-forest);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 12px rgba(50,32,16,.28)}
.g.on{background:var(--tk-forest);color:var(--tk-cream)}
.btn{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border-radius:6px;font-weight:700;font-size:16px;border:1.5px solid var(--tk-ctl);background:var(--tk-cream);color:var(--tk-ctl)}
.btn.p{background:var(--tk-leather);color:var(--tk-on-leather);border-color:var(--tk-ink);box-shadow:0 4px 0 var(--tk-ink)}
.hdr{display:flex;gap:12px;align-items:center;font-size:14px;background:var(--tk-bar);padding:8px 16px;width:390px;border-block:1px solid var(--tk-hair)}
.hdr .sp{margin-inline-start:auto;display:flex;gap:6px;align-items:center;color:var(--tk-ink)}
.tab svg,.g svg{width:22px;height:22px}.btn svg,.hdr svg{width:20px;height:20px}.rtl-flip{}
[dir=rtl] svg[class~="rtl:-scale-x-100"]{transform:scaleX(-1)}
`;

const tab = (Icon, label, on = false, dot = false) =>
  `<div class="tab${on ? " on" : ""}">${render(Icon)}${label}${dot ? '<span class="dot"></span>' : ""}</div>`;

function body(lang) {
  const he = lang === "he";
  const t = he
    ? { home: "בית", plan: "תכנון", walk: "הליכה", walks: "מסלולים", me: "פרופיל", chats: "שיחות", prefs: "העדפות", end: "סיום הליכה", ask: "שאלה" }
    : { home: "Home", plan: "Plan", walk: "Walk", walks: "Walks", me: "Me", chats: "Chats (3)", prefs: "Preferences", end: "End walk", ask: "Ask" };
  const cells = names
    .map(
      (n) => `<div class="cell"><div class="big">${render(icons[n], { className: "" })}</div>
<div class="real">${render(icons[n], { className: "icon22" })}<b>${n.replace("Icon", "")}</b></div><small>${FUNCTION[n] ?? ""}</small></div>`,
    )
    .join("");
  const bar = (activeTab, live) => `<div class="bar">${tab(icons.HomeIcon, t.home, activeTab === "home")}${tab(icons.PlanIcon, t.plan, activeTab === "plan")}${tab(icons.WalkIcon, t.walk, activeTab === "walk", live)}${tab(icons.WalksIcon, t.walks, activeTab === "walks")}${tab(icons.PersonIcon, t.me, activeTab === "me")}</div>`;
  return `<h1>Traike icon set</h1>
<p class="n">24 viewBox, 1.75 stroke, round caps and joins, currentColor. Left: enlarged. Right: the real 22 px size.</p>
<div class="grid">${cells}</div>
<h2>Tab bar (each tab selected once; Walk with the live dot)</h2>
<div class="row">${bar("plan", false)}${bar("walks", false)}${bar("walk", true)}${bar("home", false)}${bar("me", false)}</div>
<h2>Map buttons, chat header, sheet buttons</h2>
<div class="row">
<div class="glyphs"><div class="g on">${render(icons.NavArrowIcon, { filled: true })}</div><div class="g">${render(icons.NavArrowIcon)}</div><div class="g">${render(icons.FitRouteIcon)}</div><div class="g">${render(icons.LayersIcon)}</div></div>
<div><div class="hdr"><span>Plan with Traike</span><span>${t.chats}</span><span class="sp">${render(icons.SlidersIcon)}${t.prefs}</span></div>
<div style="height:14px"></div>
<div class="row"><span class="btn p">${render(icons.ChatIcon)}${t.ask}</span><span class="btn">${render(icons.StopIcon)}${t.end}</span><span class="btn">${render(icons.MicIcon)}</span><span class="btn">${render(icons.SpeakerIcon)}</span><span class="btn">${render(icons.ImageIcon)}Add image</span></div></div>
</div>`;
}

const variants = [
  { name: "light", theme: "light", dir: "ltr", lang: "en" },
  { name: "dark", theme: "dark", dir: "ltr", lang: "en" },
  { name: "rtl", theme: "light", dir: "rtl", lang: "he" },
  { name: "rtl-dark", theme: "dark", dir: "rtl", lang: "he" },
];

const browser = await chromium.launch();
for (const v of variants) {
  const html = `<!doctype html><html lang="${v.lang}" dir="${v.dir}" data-theme="${v.theme}"><head><meta charset="utf-8"><title>Traike icon set</title><style>${CSS}.icon22{width:22px;height:22px}</style></head><body>${body(v.lang)}</body></html>`;
  if (v.name === "light") writeFileSync(resolve(outDir, "icons-sheet.html"), html);
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 }, deviceScaleFactor: 2 });
  await page.setContent(html);
  await page.screenshot({ path: resolve(outDir, `icons-sheet-${v.name}.png`), fullPage: true });
  await page.close();
}
await browser.close();
console.log(`wrote ${variants.length} sheets to ${outDir}`);
