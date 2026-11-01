import { expect, test } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";
import { ORIGIN, STUBBED_PLAN } from "./support/stub-plan";

/** A Hebrew-UI walk: the page flips to RTL, nothing scrolls sideways, and the HUD stays clear of the account pill. */
test.use({
  locale: "he-IL",
  viewport: { width: 390, height: 844 },
  storageState: {
    cookies: [],
    origins: [
      {
        origin: "http://127.0.0.1:3101",
        localStorage: [{ name: "walk-settings", value: JSON.stringify({ learningConsent: "declined", uiLanguage: "he" }) }],
      },
    ],
  },
});

test("a Hebrew walk lays out right-to-left without overflow", async ({ page }, testInfo) => {
  const watch = watchConsole(page);
  const hebrewPlan = {
    ...STUBBED_PLAN,
    orderedAttractions: STUBBED_PLAN.orderedAttractions.map((a, i) => ({ ...a, name: i === 0 ? "כיכר דיזנגוף" : "מרכז באוהאוס" })),
  };
  await page.route("**/api/walk-plan", (route) => route.fulfill({ json: hebrewPlan }));
  await page.route("**/api/nearby", (route) => route.fulfill({ json: { places: [], ring: [], wikipedia: [], commons: [] } }));

  await page.goto("/app");
  await expect.poll(() => page.evaluate(() => document.documentElement.dir)).toBe("rtl");
  await page.getByPlaceholder("Latitude").fill(ORIGIN.lat);
  await page.getByPlaceholder("Longitude").fill(ORIGIN.lng);
  await page.getByRole("button", { name: "Build My Walk" }).click();
  await expect(page.getByRole("heading", { name: "Your Walk Plan" })).toBeVisible({ timeout: 15_000 });
  await testInfo.attach("planner-he", { body: await page.screenshot(), contentType: "image/png" });

  await page.getByLabel(/Simulate this walk/).check();
  await page.getByRole("button", { name: "Start Walk" }).click();
  const hud = page.getByTestId("walk-hud");
  await expect(hud).toBeVisible();
  await expect(page.getByTestId("walk-stats")).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);

  const hudBox = await hud.boundingBox();
  expect(hudBox).not.toBeNull();
  expect(hudBox!.y).toBeGreaterThan(844 / 2);
  // The account pill is pinned top-right in LTR; check both corners so a mirrored pill is covered too.
  for (const pillX of [390 - 12 - 220, 12]) {
    const pill = { x: pillX, y: 12, width: 220, height: 44 };
    const overlaps =
      hudBox!.x < pill.x + pill.width && hudBox!.x + hudBox!.width > pill.x && hudBox!.y < pill.y + pill.height && hudBox!.y + hudBox!.height > pill.y;
    expect(overlaps).toBe(false);
  }
  await testInfo.attach("hud-he", { body: await page.screenshot(), contentType: "image/png" });

  expect(watch.hydrationErrors).toEqual([]);
  expect(appErrors(watch)).toEqual([]);
});
