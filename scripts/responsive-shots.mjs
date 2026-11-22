// Screenshot matrix for the tablet / desktop pass (docs/FEEDBACK-ROUND-2026-11-22.md item 8, batch C).
//
//   node scripts/responsive-shots.mjs --base http://127.0.0.1:3101 --out docs/design-brief/shots/r14/c \
//        [--widths 390,768,1024,1280,1920] [--langs en,he] [--themes light,dark] [--screens home,plan,...]
//
// Run it against a server started in the e2e mode (auth not configured, Leaflet map, no API keys needed):
//   NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= NEXT_PUBLIC_MAP_PROVIDER= \
//   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY= NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY= NEXT_PUBLIC_SOCIAL= next start -p 3101
//
// Everything outside the page is pinned so two runs of the same build give the same pixels: a fixed clock
// (so the greeting and every time-of-arrival are the same), the OSM tiles are replaced by one flat tile,
// animations are off and the dev indicator is hidden. That is what makes the phone gate ("390px must not
// change") a pixel diff instead of an eyeball: run it before and after a change and compare the two folders.
// No network, no API keys, nothing is written outside --out.
import { mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { resolve } from "node:path";

import { chromium } from "@playwright/test";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const BASE = arg("base", "http://127.0.0.1:3101");
const OUT = resolve(process.cwd(), arg("out", "docs/design-brief/shots/r14/c"));
const WIDTHS = arg("widths", "390,768,1024,1280,1920").split(",").map(Number);
const LANGS = arg("langs", "en,he").split(",");
const THEMES = arg("themes", "light,dark").split(",");
const ALL = ["home", "home-walk", "plan", "plan-built", "walk", "walks", "social", "me", "login", "signup", "forgot", "reset", "pricing", "privacy"];
const SCREENS = arg("screens", ALL.join(",")).split(",");
mkdirSync(OUT, { recursive: true });

const HEIGHT = { 390: 844, 768: 1024, 1024: 768, 1280: 800, 1440: 900, 1920: 1080 };

// A flat map tile with a faint grid, so a map is recognisably a map and never changes between runs.
function crc32(buf) {
  let c;
  let crc = ~0;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function tilePng() {
  const size = 256;
  const raw = Buffer.alloc((size * 3 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const edge = x === 0 || y === 0;
      const street = (x > 118 && x < 128) || (y > 70 && y < 78);
      const [r, g, b] = edge ? [214, 208, 192] : street ? [250, 247, 238] : [232, 226, 210];
      const o = y * (size * 3 + 1) + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const TILE = tilePng();

// One walk used by every state that needs a plan: five stops, a loop through the middle of Tel Aviv.
const STOPS = [
  ["node/1", "Dizengoff Square", 32.0779, 34.7742, "landmark", 15],
  ["node/2", "Bauhaus Center", 32.0791, 34.7736, "museum", 25],
  ["node/3", "Rothschild Boulevard", 32.0636, 34.7746, "landmark", 12],
  ["node/4", "Carmel Market", 32.0678, 34.7685, "market", 30],
  ["node/5", "Neve Tzedek", 32.0577, 34.7638, "landmark", 20],
];
const PLAN = {
  orderedAttractions: STOPS.map(([id, name, lat, lng, category, avgVisitMinutes]) => ({ id, name, coordinates: { lat, lng }, category, avgVisitMinutes, tags: {} })),
  segments: [],
  totalDistanceMeters: 4100,
  totalMinutes: 92,
  feasible: true,
  droppedAttractions: [],
  geometry: [
    { lat: 32.0779, lng: 34.7742 },
    { lat: 32.0791, lng: 34.7736 },
    { lat: 32.0735, lng: 34.7742 },
    { lat: 32.0678, lng: 34.7745 },
    { lat: 32.0636, lng: 34.7746 },
    { lat: 32.0655, lng: 34.7705 },
    { lat: 32.0678, lng: 34.7685 },
    { lat: 32.0628, lng: 34.7662 },
    { lat: 32.0577, lng: 34.7638 },
  ],
  warnings: [],
};
const SNAPSHOT = {
  plan: PLAN,
  geometry: PLAN.geometry,
  input: { origin: { lat: 32.0779, lng: 34.7742 }, availableMinutes: 90, walkingPaceMinPerKm: 15, radiusMeters: 2000 },
  visitedIds: ["node/1", "node/2"],
  startedAt: new Date(2026, 10, 22, 9, 20).getTime(),
  lastFix: { lat: 32.0735, lng: 34.7742 },
  walkId: null,
  savedAt: new Date(2026, 10, 22, 9, 59).getTime(),
};

async function openPage(browser, width, lang, theme, { geolocation = false } = {}) {
  const height = HEIGHT[width] ?? 900;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    ...(geolocation ? { geolocation: { latitude: 32.0735, longitude: 34.7742 }, permissions: ["geolocation"] } : {}),
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  await page.clock.setFixedTime(new Date(2026, 10, 22, 10, 0, 0));
  await page.addInitScript(
    ([l, t]) => {
      localStorage.setItem("walk-settings", JSON.stringify({ learningConsent: "declined", uiLanguage: l }));
      localStorage.setItem("traike-theme", t);
      localStorage.setItem("traike-consent-accepted", "1");
    },
    [lang, theme],
  );
  await page.route(/tile\.openstreetmap\.org/, (route) => route.fulfill({ status: 200, contentType: "image/png", body: TILE }));
  await page.route("**/api/walk-plan", (route) => route.fulfill({ json: PLAN }));
  await page.route("**/api/nearby", (route) => route.fulfill({ json: { places: [], ring: [], wikipedia: [], commons: [] } }));
  return { context, page };
}

async function settle(page) {
  await page.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important} *,*::before,*::after{caret-color:transparent!important}" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
}

async function buildPlan(page, lang) {
  const he = lang === "he";
  await page.goto(`${BASE}/app?view=plan`);
  // A dev server re-renders the tree once after hydration, which closes the <details> again: open them until the field shows.
  const lat = page.getByPlaceholder(he ? "קו רוחב" : "Latitude");
  for (let i = 0; i < 25 && !(await lat.isVisible()); i++) {
    await page.locator("details").evaluateAll((all) => all.forEach((d) => (d.open = true)));
    await page.waitForTimeout(300);
  }
  await lat.fill("32.0779");
  await page.getByPlaceholder(he ? "קו אורך" : "Longitude").fill("34.7742");
  await page.getByRole("button", { name: he ? "בנה מסלול הליכה" : "Build walking route" }).click();
  await page.getByRole("heading", { name: "Your Walk Plan" }).waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1200);
}

const STATES = {
  home: async (page) => {
    await page.goto(`${BASE}/app`);
    await page.locator("[data-view=home]").waitFor({ state: "attached" });
  },
  "home-walk": async (page) => {
    await page.addInitScript((s) => localStorage.setItem("traike.activeWalk.v1", JSON.stringify(s)), SNAPSHOT);
    await page.goto(`${BASE}/app`);
    await page.locator("[data-view=home]").waitFor({ state: "attached" });
    await page.waitForTimeout(400);
  },
  plan: async (page) => {
    await page.goto(`${BASE}/app?view=plan`);
    await page.locator("[data-view=plan]").waitFor({ state: "attached" });
  },
  "plan-built": async (page, lang) => {
    await buildPlan(page, lang);
  },
  walk: async (page) => {
    await page.addInitScript((s) => localStorage.setItem("traike.activeWalk.v1", JSON.stringify(s)), SNAPSHOT);
    await page.goto(`${BASE}/app`);
    await page.locator("[data-view=home]").waitFor({ state: "attached" });
    await page.waitForTimeout(400);
    await page.locator("header button.tk-btn-primary, header .tk-btn").first().click();
    await page.getByTestId("walk-hud").waitFor({ timeout: 20_000 });
    await page.waitForTimeout(2500);
  },
  walks: async (page) => {
    await page.goto(`${BASE}/app?view=walks`);
    await page.locator("[data-view=walks]").waitFor({ state: "attached" });
  },
  social: async (page) => {
    await page.goto(`${BASE}/app?view=social`);
    await page.locator("[data-view=social]").waitFor({ state: "attached" });
  },
  me: async (page) => {
    await page.goto(`${BASE}/app?view=me`);
    await page.locator("[data-view=me]").waitFor({ state: "attached" });
  },
  login: async (page) => void (await page.goto(`${BASE}/login`)),
  signup: async (page) => void (await page.goto(`${BASE}/signup`)),
  forgot: async (page) => void (await page.goto(`${BASE}/forgot-password`)),
  reset: async (page) => void (await page.goto(`${BASE}/reset-password`)),
  pricing: async (page) => void (await page.goto(`${BASE}/pricing`)),
  privacy: async (page) => void (await page.goto(`${BASE}/privacy`)),
};

const browser = await chromium.launch();
let count = 0;
for (const width of WIDTHS) {
  for (const lang of LANGS) {
    for (const theme of THEMES) {
      for (const screen of SCREENS) {
        // Pricing is light only by design (see src/lib/theme/theme.ts).
        if (screen === "pricing" && theme === "dark") continue;
        const { context, page } = await openPage(browser, width, lang, theme, { geolocation: screen === "walk" });
        try {
          await STATES[screen](page, lang);
          await settle(page);
          await page.screenshot({ path: `${OUT}/${width}-${lang}-${theme}-${screen}.png`, animations: "disabled" });
          count++;
        } catch (e) {
          console.error(`FAILED ${width} ${lang} ${theme} ${screen}: ${String(e).split("\n")[0]}`);
        }
        await context.close();
      }
    }
  }
}
await browser.close();
console.log(`wrote ${count} screenshots to ${OUT}`);
