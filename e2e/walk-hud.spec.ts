import { expect, test } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";

/**
 * The live-walk screen on a phone: Start Walk gives the whole viewport to the
 * map, nothing the walk draws sits where the account pill lives, and the
 * mandatory OpenStreetMap attribution is not hidden under the stats bar.
 *
 * What jsdom cannot say: real layout. Bounding boxes, `env(safe-area-inset-*)`,
 * and the Leaflet attribution control only exist in a browser. Auth is disabled
 * in this suite (see playwright.config.ts) so the account pill itself is not
 * rendered; its place is the fixed top-right corner, asserted as a region.
 * Upstreams are stubbed for the same reasons as planner.spec.ts, and the
 * simulator stands in for GPS.
 */

const ORIGIN = { lat: "32.0779", lng: "34.7742" };

const STUBBED_PLAN = {
  orderedAttractions: [
    {
      id: "node/1",
      name: "Dizengoff Square",
      coordinates: { lat: 32.078, lng: 34.7743 },
      category: "landmark",
      avgVisitMinutes: 15,
      tags: {},
    },
    {
      id: "node/2",
      name: "Bauhaus Center",
      coordinates: { lat: 32.0791, lng: 34.7736 },
      category: "museum",
      avgVisitMinutes: 25,
      tags: {},
    },
  ],
  segments: [
    {
      from: { name: "origin", coordinates: { lat: 32.0779, lng: 34.7742 } },
      to: {
        id: "node/1",
        name: "Dizengoff Square",
        coordinates: { lat: 32.078, lng: 34.7743 },
        category: "landmark",
        avgVisitMinutes: 15,
        tags: {},
      },
      distanceMeters: 120,
      walkingMinutes: 2,
    },
    {
      from: {
        id: "node/1",
        name: "Dizengoff Square",
        coordinates: { lat: 32.078, lng: 34.7743 },
        category: "landmark",
        avgVisitMinutes: 15,
        tags: {},
      },
      to: {
        id: "node/2",
        name: "Bauhaus Center",
        coordinates: { lat: 32.0791, lng: 34.7736 },
        category: "museum",
        avgVisitMinutes: 25,
        tags: {},
      },
      distanceMeters: 340,
      walkingMinutes: 5,
    },
  ],
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

test("Start Walk fills the phone screen with the map and keeps the HUD out of the corners", async ({
  page,
}) => {
  const watch = watchConsole(page);
  await page.route("**/api/walk-plan", (route) => route.fulfill({ json: STUBBED_PLAN }));
  await page.route("**/api/nearby", (route) => route.fulfill({ json: { places: [] } }));

  await page.goto("/app");
  await page.getByPlaceholder("Latitude").fill(ORIGIN.lat);
  await page.getByPlaceholder("Longitude").fill(ORIGIN.lng);
  await page.getByRole("button", { name: "Build My Walk" }).click();
  await expect(page.getByRole("heading", { name: "Your Walk Plan" })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByLabel(/Simulate this walk/).check();
  await page.getByRole("button", { name: "Start Walk" }).click();

  const hud = page.getByTestId("walk-hud");
  await expect(hud).toBeVisible();
  await expect(page.getByTestId("walk-stats")).toBeVisible();

  // The form is out of the way; the map has the screen.
  await expect(page.getByPlaceholder("Latitude")).toBeHidden();
  const map = await page.locator(".leaflet-container").boundingBox();
  expect(map).not.toBeNull();
  expect(map!.width).toBeGreaterThanOrEqual(388);
  expect(map!.height).toBeGreaterThanOrEqual(0.9 * 844);

  // The HUD lives in the bottom half: nothing of it in the top band or in the
  // top-right corner where the account pill is pinned (right 12px, top 12px).
  const hudBox = await hud.boundingBox();
  expect(hudBox).not.toBeNull();
  expect(hudBox!.y).toBeGreaterThan(844 / 2);
  const pill = { x: 390 - 12 - 220, y: 12, width: 220, height: 44 };
  const overlapsPill =
    hudBox!.x < pill.x + pill.width &&
    hudBox!.x + hudBox!.width > pill.x &&
    hudBox!.y < pill.y + pill.height &&
    hudBox!.y + hudBox!.height > pill.y;
  expect(overlapsPill).toBe(false);

  // OSM attribution stays visible, above the HUD rather than under it.
  const attribution = page.locator(".leaflet-control-attribution");
  await expect(attribution).toBeVisible();
  const attrBox = await attribution.boundingBox();
  expect(attrBox).not.toBeNull();
  expect(attrBox!.y + attrBox!.height).toBeLessThanOrEqual(hudBox!.y + 1);

  // Ending the walk brings the form back.
  await page.getByRole("button", { name: "End walk" }).click();
  await expect(page.getByPlaceholder("Latitude")).toBeVisible();

  expect(watch.hydrationErrors).toEqual([]);
  expect(appErrors(watch)).toEqual([]);
});

test("the OSM attribution stays above the HUD while an alert card is showing", async ({
  page,
}) => {
  const watch = watchConsole(page);
  await page.route("**/api/walk-plan", (route) => route.fulfill({ json: STUBBED_PLAN }));
  await page.route("**/api/nearby", (route) => route.fulfill({ json: { places: [] } }));
  // No routed side street: the simulator falls back to a synthetic nudge off the line.
  await page.route("**/api/directions", (route) =>
    route.fulfill({ status: 500, json: { error: "stubbed" } }),
  );

  await page.goto("/app");
  await page.getByPlaceholder("Latitude").fill(ORIGIN.lat);
  await page.getByPlaceholder("Longitude").fill(ORIGIN.lng);
  await page.getByRole("button", { name: "Build My Walk" }).click();
  await expect(page.getByRole("heading", { name: "Your Walk Plan" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel(/Simulate this walk/).check();
  await page.getByRole("button", { name: "Start Walk" }).click();
  await expect(page.getByTestId("walk-hud")).toBeVisible();

  // The stray control lives in the Details sheet; open it, send the walker off, close it.
  await page.getByRole("button", { name: "Details" }).click();
  await page.getByRole("button", { name: /Stray \d+ m off route/ }).click();
  await page.getByRole("button", { name: "Close", exact: false }).first().click();

  const card = page.getByTestId("walk-hud").getByRole("alert");
  await expect(card).toBeVisible({ timeout: 30_000 });

  // `--hud-h` is published asynchronously by a ResizeObserver, so poll the boxes.
  await expect
    .poll(async () => {
      const hudBox = await page.getByTestId("walk-hud").boundingBox();
      const attrBox = await page.locator(".leaflet-control-attribution").boundingBox();
      if (!hudBox || !attrBox) return false;
      return attrBox.y + attrBox.height <= hudBox.y + 1;
    })
    .toBe(true);
  await page.screenshot({ path: "test-results/walk-hud-alert.png" });

  expect(watch.hydrationErrors).toEqual([]);
  expect(appErrors(watch)).toEqual([]);
});

test("the direction options sheet stays out of the account-pill corner and above nothing it should cover", async ({
  page,
}) => {
  const watch = watchConsole(page);
  await page.route("**/api/walk-plan", (route) => route.fulfill({ json: STUBBED_PLAN }));
  await page.route("**/api/nearby", (route) =>
    route.fulfill({ json: { places: [], ring: [], wikipedia: [], commons: [] } }),
  );
  const line = [
    { lat: 32.0779, lng: 34.7742 },
    { lat: 32.0795, lng: 34.7765 },
  ];
  await page.route("**/api/walk-options", (route) =>
    route.fulfill({
      json: {
        options: [
          { theme: "nature", geometry: line, distanceM: 3200, minutes: 45, stops: [], overlapWalked: 0 },
          { theme: "short", geometry: [...line].reverse(), distanceM: 1500, minutes: 20, stops: [], overlapWalked: 0.1 },
        ],
      },
    }),
  );

  await page.goto("/app");
  await page.getByPlaceholder("Latitude").fill(ORIGIN.lat);
  await page.getByPlaceholder("Longitude").fill(ORIGIN.lng);
  await page.getByRole("button", { name: "Build My Walk" }).click();
  await expect(page.getByRole("heading", { name: "Your Walk Plan" })).toBeVisible({
    timeout: 15_000,
  });
  await page.getByLabel(/Simulate this walk/).check();
  await page.getByRole("button", { name: "Start Walk" }).click();
  await expect(page.getByTestId("walk-hud")).toBeVisible();
  // The stats bar appears with the first GPS fix; options need a position.
  await expect(page.getByTestId("walk-stats")).toBeVisible();

  await page.getByRole("button", { name: "Details" }).click();
  await page.getByRole("button", { name: "Show me something different" }).click();

  const sheet = page.getByTestId("direction-options");
  await expect(sheet).toBeVisible({ timeout: 15_000 });
  await expect(sheet.getByRole("button", { name: "Back to my plan" })).toBeVisible();

  const sheetBox = await sheet.boundingBox();
  expect(sheetBox).not.toBeNull();
  // Bottom half only, clear of the account pill (top-right) and inside the screen.
  expect(sheetBox!.y).toBeGreaterThan(844 / 2);
  expect(sheetBox!.x).toBeGreaterThanOrEqual(0);
  expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual(390 + 1);
  const pill = { x: 390 - 12 - 220, y: 12, width: 220, height: 44 };
  const overlapsPill =
    sheetBox!.x < pill.x + pill.width &&
    sheetBox!.x + sheetBox!.width > pill.x &&
    sheetBox!.y < pill.y + pill.height &&
    sheetBox!.y + sheetBox!.height > pill.y;
  expect(overlapsPill).toBe(false);

  // The attribution stays above the whole HUD stack, sheet included.
  await expect
    .poll(async () => {
      const hudBox = await page.getByTestId("walk-hud").boundingBox();
      const attrBox = await page.locator(".leaflet-control-attribution").boundingBox();
      if (!hudBox || !attrBox) return false;
      return attrBox.y + attrBox.height <= hudBox.y + 1;
    })
    .toBe(true);
  await page.screenshot({ path: "test-results/walk-hud-options.png" });

  // Previews are on the map; Back to my plan closes the sheet and keeps the walk.
  await expect(page.locator(".leaflet-overlay-pane path[stroke-dasharray]").first()).toBeAttached();
  await sheet.getByRole("button", { name: "Back to my plan" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: "End walk" })).toBeVisible();

  expect(watch.hydrationErrors).toEqual([]);
  expect(appErrors(watch)).toEqual([]);
});
