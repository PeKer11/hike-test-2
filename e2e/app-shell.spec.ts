import { expect, test } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";

/**
 * The app shell: one mounted planner, screens switched with ?view=.
 * Auth is disabled in this suite, so Walks and Social show the planner's own panel (signed-out form).
 */

const STUBBED_PLAN = {
  orderedAttractions: [
    { id: "node/1", name: "Dizengoff Square", coordinates: { lat: 32.078, lng: 34.7743 }, category: "landmark", avgVisitMinutes: 15, tags: {} },
  ],
  segments: [],
  totalDistanceMeters: 460,
  totalMinutes: 47,
  feasible: true,
  droppedAttractions: [],
  geometry: [
    { lat: 32.0779, lng: 34.7742 },
    { lat: 32.078, lng: 34.7743 },
    { lat: 32.0791, lng: 34.7736 },
  ],
  warnings: [],
};

for (const viewport of [
  { width: 390, height: 844, phone: true },
  { width: 1440, height: 900, phone: false },
]) {
  test.describe(`${viewport.width}px`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test("navigates Home, Walks, Social, Me and Plan with the right chrome", async ({ page }) => {
      const watch = watchConsole(page);
      await page.goto("/app");
      await expect(page.locator("[data-view=home]")).toBeAttached();
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const nav = page.getByRole("navigation", { name: "App" }).filter({ visible: true });
      await expect(nav).toBeVisible();

      for (const [name, view] of [
        ["Walks", "walks"],
        ["Social", "social"],
        ["Me", "me"],
        ["Home", "home"],
      ] as const) {
        await nav.getByRole("button", { name, exact: true }).click();
        await expect(page.locator(`[data-view=${view}]`)).toBeAttached();
      }

      // Plan is a full-screen task screen: no phone tab bar, a back button instead.
      await nav.getByRole("button", { name: "New route", exact: true }).click();
      await expect(page.locator("[data-view=plan]")).toBeAttached();
      await expect(page.getByPlaceholder("Latitude")).toBeVisible();
      if (viewport.phone) await expect(page.getByRole("navigation", { name: "App" }).filter({ visible: true })).toHaveCount(0);
      if (viewport.phone) await page.getByRole("button", { name: "Back" }).click();
      else await nav.getByRole("button", { name: "Home", exact: true }).click();
      await expect(page.locator("[data-view=home]")).toBeAttached();

      // Browser Back walks the same history.
      await page.goBack();
      await expect(page.locator("[data-view=plan]")).toBeAttached();

      expect(watch.hydrationErrors).toEqual([]);
      expect(appErrors(watch)).toEqual([]);
    });

    test("the planner never unmounts: a simulated walk survives a trip to Home and back", async ({ page }) => {
      await page.route("**/api/walk-plan", (route) => route.fulfill({ json: STUBBED_PLAN }));
      await page.route("**/api/nearby", (route) => route.fulfill({ json: { places: [] } }));
      await page.goto("/app?view=plan");
      await page.getByPlaceholder("Latitude").fill("32.0779");
      await page.getByPlaceholder("Longitude").fill("34.7742");
      await page.getByRole("button", { name: "Build My Walk" }).click();
      await expect(page.getByRole("heading", { name: "Your Walk Plan" })).toBeVisible({ timeout: 15_000 });
      await page.getByLabel(/Simulate this walk/).check();
      await page.getByRole("button", { name: "Start Walk" }).click();
      await expect(page.getByTestId("walk-hud")).toBeVisible();
      await expect(page).toHaveURL(/view=walk/);
      // The live walk is a full-screen task: no tab bar.
      await expect(page.getByRole("navigation", { name: "App" }).filter({ visible: true })).toHaveCount(viewport.phone ? 0 : 1);

      // Leave to Home (history push) and come back: the same walk is still running.
      await page.evaluate(() => window.history.pushState(null, "", "/app"));
      await page.goBack();
      await expect(page.getByTestId("walk-hud")).toBeVisible();
      await expect(page.getByTestId("walk-stats")).toBeVisible({ timeout: 20_000 });
    });
  });
}
