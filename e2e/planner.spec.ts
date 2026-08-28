import { expect, test } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";

/**
 * One walk, built the way a walker builds it: typed into the real form, in a
 * real browser, against a real server.
 *
 * Where the upstreams are faked, and why. By default `/api/walk-plan` is
 * fulfilled by Playwright rather than by Overpass and ORS, and that is a
 * deliberate line rather than a shortcut:
 *
 *  - The route handler behind that URL is already covered in depth by
 *    `tests/walk-plan-api.test.ts`, ~1500 lines of it. Re-driving it here would
 *    duplicate that at browser speed, and this suite's brief is explicitly not
 *    to re-test what `tests/` already tests.
 *  - What is NOT covered anywhere else is the half this keeps real: a
 *    server-rendered form, hydrated, typed into, submitted, and the response
 *    rendered back through real React state. That is entirely untouched by the
 *    stub.
 *  - This runs on every push. Spending ORS's 2000 requests/day and Overpass's
 *    rate limit on a smoke suite, and taking their outages as our red build,
 *    is a bad trade for a check whose question is "does the pipeline work at
 *    all".
 *  - CI has no secrets. `ORS_API_KEY` and `GEMINI_API_KEY` live only in
 *    `.env.local`, and the CI workflow was written on the promise that nothing
 *    in it needs a key. Real upstreams here would have broken that promise for
 *    one test.
 *
 * Set `E2E_REAL_UPSTREAM=1` locally to drop the stub and drive the whole thing
 * through the real Overpass/ORS path instead -- which is worth doing by hand
 * when the walk-plan route changes, and is where the claim "the real pipeline
 * works" actually gets earned.
 */

const USE_REAL_UPSTREAM = process.env.E2E_REAL_UPSTREAM === "1";

/** Dizengoff Square, Tel Aviv -- somewhere real Overpass has real POIs. */
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

test("a walker fills in the form and gets a plan back", async ({ page }) => {
  const watch = watchConsole(page);

  if (!USE_REAL_UPSTREAM) {
    await page.route("**/api/walk-plan", (route) =>
      route.fulfill({ json: STUBBED_PLAN }),
    );
  }

  await page.goto("/app");

  await page.getByPlaceholder("Latitude").fill(ORIGIN.lat);
  await page.getByPlaceholder("Longitude").fill(ORIGIN.lng);
  // The number fields carry no `for`/`id` pairing, so they are addressed by the
  // bounds that make each one what it is: 15-480 is the time budget, 0.5-10 the
  // search radius.
  await page.locator('input[type="number"][min="15"][max="480"]').fill("60");
  await page.locator('input[type="number"][min="0.5"][max="10"]').fill("1.5");
  await page.getByRole("button", { name: "Landmarks" }).click();

  await page.getByRole("button", { name: "Build My Walk" }).click();

  // Real Overpass + ORS is several round trips; the stub answers instantly.
  await expect(page.getByRole("heading", { name: "Your Walk Plan" })).toBeVisible(
    { timeout: USE_REAL_UPSTREAM ? 90_000 : 15_000 },
  );

  // A plan with an itinerary in it, not just the card's chrome. Real Overpass
  // decides its own stop names, so only the stub can be asked for a specific
  // one.
  // Every stop in the itinerary renders its own "N min visit" line.
  expect(await page.getByText(/\d+ min visit/).count()).toBeGreaterThan(0);
  if (!USE_REAL_UPSTREAM) {
    await expect(page.getByText("Dizengoff Square").first()).toBeVisible();
  }

  expect(watch.hydrationErrors).toEqual([]);
  expect(appErrors(watch)).toEqual([]);
});

/** `WALK_SETTINGS_STORAGE_KEY` in `src/lib/hooks/useWalkSettings.ts`. */
const SETTINGS_KEY = "walk-settings";

test("a returning walker's stored settings hydrate without a mismatch", async ({
  page,
}) => {
  // The 2026-08-07 bug in one scenario: settings on disk that disagree with the
  // defaults the server has to render, arriving at a cold page load. Seeded
  // before the first navigation, because that is the render that either matches
  // the server or does not -- a value written after mount is never compared to
  // anything.
  //
  // Verified against a deliberately reverted `useWalkSettings` (reading
  // localStorage in the initial `useState` again) with the settings panel
  // defaulted open: React 19 raises this as an uncaught #418, which
  // `watchConsole` catches via `pageerror`. It stays green with the panel
  // closed, which is its real state today -- so this guards the moment anything
  // starts rendering persisted settings during the first paint, rather than
  // reproducing a bug the closed-by-default panel has already made unreachable.
  await page.addInitScript(
    ([key]) => {
      window.localStorage.setItem(
        key,
        JSON.stringify({
          deviationMode: "off",
          preferenceLearningEnabled: false,
          paceCheckIntervalMs: 45_000,
        }),
      );
    },
    [SETTINGS_KEY],
  );

  const watch = watchConsole(page);
  await page.goto("/app");
  await page.waitForFunction(() => "next" in window);

  // The stored blob is what the walker gets back, not the defaults the server
  // rendered -- a real browser store surviving a real SSR pass, which jsdom's
  // per-file fake cannot say anything about.
  await page.getByRole("button", { name: "Walk settings" }).click();
  await expect(
    page.getByRole("button", { name: "Remember my preferences" }),
  ).toHaveAttribute("aria-pressed", "false");

  expect(watch.hydrationErrors).toEqual([]);
  expect(appErrors(watch)).toEqual([]);
});

test("a walk setting survives a reload", async ({ page }) => {
  // The other half: written by a click, read back by a fresh page load. jsdom
  // fakes localStorage per test file, so the round trip a returning walker
  // actually makes -- change something, close the tab, come back -- has never
  // been exercised anywhere in `tests/`.
  await page.goto("/app");
  await page.getByRole("button", { name: "Walk settings" }).click();

  const toggle = page.getByRole("button", { name: "Remember my preferences" });
  await expect(toggle).toBeVisible();
  const before = await toggle.getAttribute("aria-pressed");
  const after = before === "true" ? "false" : "true";
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", after);

  const watch = watchConsole(page);
  await page.reload();

  await page.getByRole("button", { name: "Walk settings" }).click();
  await expect(
    page.getByRole("button", { name: "Remember my preferences" }),
  ).toHaveAttribute("aria-pressed", after);

  expect(watch.hydrationErrors).toEqual([]);
  expect(appErrors(watch)).toEqual([]);
});
