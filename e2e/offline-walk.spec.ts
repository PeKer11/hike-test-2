import { expect, test } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";
import { ORIGIN, STUBBED_PLAN } from "./support/stub-plan";

/**
 * Airplane mode in the middle of a real (non-simulated) walk: no crash, the HUD stays, the GPS dot keeps
 * following the walker, and the nearby lookup is asked again once the walker strays past the scanned area
 * with the network back.
 */
const OFFLINE_MS = Number(process.env.E2E_OFFLINE_MS ?? 120_000);

test.use({
  viewport: { width: 390, height: 844 },
  geolocation: { latitude: 32.0779, longitude: 34.7742 },
  permissions: ["geolocation"],
});

test("a walk survives two minutes offline and resumes lookups when the network returns", async ({ page, context }) => {
  test.setTimeout(OFFLINE_MS + 120_000);
  const watch = watchConsole(page);
  const nearby = { json: { places: [], ring: [], wikipedia: [], commons: [] } };
  await page.route("**/api/walk-plan", (route) => route.fulfill({ json: STUBBED_PLAN }));
  await page.route("**/api/nearby", (route) => route.fulfill(nearby));

  await page.goto("/app");
  await page.getByPlaceholder("Latitude").fill(ORIGIN.lat);
  await page.getByPlaceholder("Longitude").fill(ORIGIN.lng);
  await page.getByRole("button", { name: "Build My Walk" }).click();
  await expect(page.getByRole("heading", { name: "Your Walk Plan" })).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Start Walk" }).click();
  await expect(page.getByTestId("walk-hud")).toBeVisible();
  await expect(page.getByTestId("walk-stats")).toBeVisible({ timeout: 30_000 });

  const geometry = STUBBED_PLAN.geometry;
  const walkTo = async (i: number) => {
    const p = geometry[Math.min(i, geometry.length - 1)];
    await context.setGeolocation({ latitude: p.lat, longitude: p.lng });
  };

  await page.unroute("**/api/nearby");
  await page.route("**/api/nearby", (route) => route.abort("internetdisconnected"));
  await context.setOffline(true);
  const statsBefore = await page.getByTestId("walk-stats").innerText();
  const started = Date.now();
  for (let i = 0; Date.now() - started < OFFLINE_MS; i++) {
    await walkTo(i % geometry.length);
    await page.waitForTimeout(2_000);
  }
  await expect(page.getByTestId("walk-hud")).toBeVisible();
  const statsOffline = await page.getByTestId("walk-stats").innerText();
  expect(statsOffline).not.toBe(statsBefore);

  await context.setOffline(false);
  await page.unroute("**/api/nearby");
  await page.route("**/api/nearby", (route) => route.fulfill(nearby));
  // The loader only asks again when the walker is well outside everything scanned (about 1.1 km north here),
  // never once per GPS fix, so that is what a returning signal has to wait for.
  await context.setGeolocation({ latitude: 32.0879, longitude: 34.7742 });
  await page.waitForRequest("**/api/nearby", { timeout: 60_000 });

  await expect(page.getByTestId("walk-hud")).toBeVisible();
  await page.getByRole("button", { name: "End walk" }).click();
  await expect(page.getByPlaceholder("Latitude")).toBeVisible();
  expect(watch.hydrationErrors).toEqual([]);
  expect(appErrors(watch)).toEqual([]);
});
