// Screenshots of the hero scroll story at fixed progress values.
// Usage: node scripts/landing/story-shots.mjs [width height tag]
import { chromium } from "playwright";
import fs from "node:fs";

const [w = 1440, h = 900, tag = "d"] = process.argv.slice(2);
const PS = [0, 0.1, 0.2, 0.3, 0.38, 0.43, 0.47, 0.52, 0.58, 0.7, 1];
fs.mkdirSync("build/story-shots", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:3111/", { waitUntil: "load" });
await page.waitForTimeout(1500);
const geo = await page.evaluate(() => {
  const s = document.querySelector("section");
  return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight };
});
const range = geo.h - (+h - 64);
for (const p of PS) {
  const y = geo.top - 64 + p * range;
  await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), y);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `build/story-shots/${tag}-${String(Math.round(p * 100)).padStart(3, "0")}.png` });
}
console.log("done", { errors });
await browser.close();
