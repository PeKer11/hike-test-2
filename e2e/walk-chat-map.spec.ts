import { expect, test } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";
import { raiseWalkSheet } from "./support/open-walk-details";
import { openMore } from "./support/open-more";

/**
 * Phone feedback 2026-11-24: with the walk chat open the sheet grew past the top of the screen (the map section was
 * left with no height, and the map's own pill drew over the sheet's header). The sheet is capped so the map is always
 * on screen, and the chat's chevron gives the room back.
 */

const STUBBED_PLAN = {
  orderedAttractions: [
    { id: "node/1", name: "Dizengoff Square", coordinates: { lat: 32.078, lng: 34.7743 }, category: "landmark", avgVisitMinutes: 15, tags: {} },
    { id: "node/2", name: "Bauhaus Center", coordinates: { lat: 32.0791, lng: 34.7736 }, category: "museum", avgVisitMinutes: 25, tags: {} },
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

// A short phone screen (browser bars showing) is where the expanded chat used to push the sheet off the top.
test.use({ viewport: { width: 390, height: 600 } });

test("the open walk chat never covers the whole map, and minimizing it gives the room back", async ({ page }) => {
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
  const hud = page.getByTestId("walk-hud");
  await expect(hud).toBeVisible();

  await raiseWalkSheet(page);
  await page.getByRole("button", { name: /^Ask/ }).click();
  const chat = page.getByTestId("walk-chat");
  const input = chat.locator("input");
  for (const q of ["I need a coffee", "toilet", "how long left"]) {
    await input.fill(q);
    await input.press("Enter");
    await expect(chat.locator("li").last()).toBeVisible();
  }

  const open = await hud.boundingBox();
  expect(open).not.toBeNull();
  // The map keeps at least a third of the walk screen above the sheet, and the sheet's top is on screen.
  expect(open!.y).toBeGreaterThanOrEqual(0.3 * 600 - 1);

  // The handle never scrolls out of view inside the sheet (it was 226 against a sheet top of 297 before the header was split off).
  const handleBox = await page.getByTestId("walk-sheet-header").boundingBox();
  expect(handleBox!.y).toBeGreaterThanOrEqual(open!.y - 1);
  expect(handleBox!.y).toBeLessThan(open!.y + open!.height);

  await chat.getByRole("button", { name: "Minimize" }).click();
  await expect(chat).toBeHidden();
  const closed = await hud.boundingBox();
  expect(closed!.height).toBeLessThan(open!.height);
  expect(closed!.y).toBeGreaterThan(open!.y);

  expect(appErrors(watch)).toEqual([]);

  // Whatever the map draws (its pills and buttons carry z-index 1000) stays under the sheet: the map is its own stacking layer.
  const mapLayer = await page.locator(".leaflet-container").evaluate((el) => getComputedStyle(el).isolation);
  expect(mapLayer).toBe("isolate");
});
