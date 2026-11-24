import { expect, test } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";
import { openMore } from "./support/open-more";

/**
 * The Walks tab opened over a live walk used to be blank on a phone (docs/PHONE-FEEDBACK-BEAM-TRAIL-CRASH-PLAN-2026-11-24.md,
 * section 3): the side panel and the map column were both hidden. Auth is off in this suite, so the list itself is
 * signed-in only; what must show is the band and the way back to the walk.
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

test.use({ viewport: { width: 390, height: 844 } });

test("Walks during a live walk shows a way back, and Walk shows the map again", async ({ page }) => {
  const watch = watchConsole(page);
  await page.route("**/api/walk-plan", (route) => route.fulfill({ json: STUBBED_PLAN }));
  await page.route("**/api/nearby", (route) => route.fulfill({ json: { places: [] } }));
  await page.goto("/app?view=plan");
  await openMore(page);
  await page.getByPlaceholder("Latitude").fill("32.0779");
  await page.getByPlaceholder("Longitude").fill("34.7742");
  await page.getByRole("button", { name: "Build walking route" }).click();
  await expect(page.getByRole("heading", { name: "Your Walk Plan" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel(/Simulate this walk/).check();
  await page.getByRole("button", { name: "Start Walk" }).click();
  await expect(page.getByTestId("walk-hud")).toBeVisible();

  const nav = page.getByRole("navigation", { name: "App" }).filter({ visible: true });
  await nav.getByRole("button", { name: "Walks", exact: true }).click();
  await expect(page.locator("[data-view=walks]")).toBeAttached();
  await expect(page.getByTestId("walks-during-walk")).toBeVisible();
  await expect(page.getByRole("button", { name: "Back to your walk" })).toBeVisible();

  await page.getByRole("button", { name: "Back to your walk" }).click();
  await expect(page).toHaveURL(/view=walk/);
  await expect(page.getByTestId("walk-hud")).toBeVisible();
  await expect(page.locator(".leaflet-container, canvas").first()).toBeVisible();

  expect(appErrors(watch)).toEqual([]);
});
