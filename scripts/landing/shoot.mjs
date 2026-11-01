import { chromium } from "@playwright/test";
const out = "build/landing-shots";
const sizes = [[1440, 900, "d"], [390, 844, "m"]];
const b = await chromium.launch();
for (const [w, h, tag] of sizes) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  await p.goto("http://localhost:3111/", { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0, i = 0; y < H; y += h, i++) {
    await p.evaluate((yy) => window.scrollTo({ top: yy, behavior: "instant" }), y);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${tag}-${String(i).padStart(2, "0")}.png` });
  }
  console.log(tag, "height", H, "errors", errs.slice(0, 3));
}
await b.close();
