import { expect, test, type Page } from "@playwright/test";

/**
 * Home hero (feedback round 2026-11-22, item 9): the 1000x1500 portrait used to be stretched across the whole
 * width on tablet and desktop. md and up now draw a 2880x1200 landscape; phones keep the approved portrait.
 *
 * "Sharp" is measured, not eyeballed: the decoded width of the file the browser actually fetched, against the
 * width the picture is really drawn at (object-cover draws it at least as wide as the band is tall x 2.4).
 */

// The scene pictures only: the Traike mark (traike-icon.png) is also an aria-hidden img inside the header since the icon round.
const HERO = "header img[aria-hidden=true]:not([src*='traike-icon'])";

async function drawnHeroPictures(page: Page) {
  await page.goto("/app");
  await page.locator("[data-view=home] header h1").first().waitFor();
  // The wide picture is lazy: let it arrive.
  await page.waitForLoadState("load");
  await expect
    .poll(() => page.evaluate((sel) => [...document.querySelectorAll<HTMLImageElement>(sel)].filter((i) => i.getBoundingClientRect().width > 0 && i.complete).length, HERO))
    .toBeGreaterThan(0);
  return page.evaluate(async (sel) => {
    const out: { file: string; decodedW: number; drawnW: number }[] = [];
    for (const img of document.querySelectorAll<HTMLImageElement>(sel)) {
      const r = img.getBoundingClientRect();
      if (r.width === 0) continue;
      const u = new URL(img.currentSrc);
      const bmp = await createImageBitmap(await (await fetch(img.currentSrc)).blob());
      const ratio = bmp.width / bmp.height;
      // object-cover: the picture covers the box, so it is drawn at the larger of the two fits.
      const drawnW = Math.max(r.width, r.height * ratio);
      out.push({ file: decodeURIComponent(u.searchParams.get("url") ?? u.pathname).split("/").pop() ?? "", decodedW: bmp.width, drawnW });
    }
    return out;
  }, HERO);
}

for (const vp of [
  { name: "tablet", width: 768, height: 1024, scale: 1 },
  { name: "laptop retina", width: 1440, height: 900, scale: 2 },
  { name: "desktop", width: 1920, height: 1080, scale: 1 },
]) {
  test.describe(vp.name, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.scale });

    test("draws the wide landscape, not upscaled", async ({ page }) => {
      const pics = await drawnHeroPictures(page);
      expect(pics).toHaveLength(1);
      expect(pics[0].file).toBe("home-forest-wide.jpg");
      // Decoded pixels at least the device pixels the picture covers (a little slack for rounding).
      expect(pics[0].decodedW).toBeGreaterThanOrEqual(pics[0].drawnW * vp.scale * 0.97);
    });
  });
}

test.describe("phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

  test("keeps the approved portrait and never draws the wide landscape", async ({ page }) => {
    const pics = await drawnHeroPictures(page);
    expect(pics).toHaveLength(1);
    expect(pics[0].file).toBe("home-forest.jpg");
    const wideRequests = await page.evaluate(() => performance.getEntriesByType("resource").filter((e) => e.name.includes("home-forest-wide")).length);
    expect(wideRequests).toBe(0);
  });
});
