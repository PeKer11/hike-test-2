import { expect, test } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";

/**
 * The reason this suite exists.
 *
 * Every route is server-rendered and then hydrated by a real browser, and the
 * only thing asserted is that the two agreed. jsdom cannot make this check at
 * all: `renderHook` and `render` have no server pass for the client render to
 * disagree with, which is how a live hydration mismatch sat under 698 green
 * tests for weeks.
 */

const ROUTES = [
  { path: "/", heading: "A walk built around you" },
  { path: "/app", heading: "City Walk Companion" },
  { path: "/login", heading: "Welcome back" },
  { path: "/pricing", heading: "Try it first. Properly." },
] as const;

for (const route of ROUTES) {
  test(`${route.path} server-renders and hydrates cleanly`, async ({ page }) => {
    // Attached before navigating: React logs a hydration mismatch once, during
    // the first client render, so a listener added afterwards has already
    // missed it.
    const watch = watchConsole(page);

    const response = await page.goto(route.path);

    // A route that 500s on first load is the other half of what only a real
    // server can tell you.
    expect(response?.status(), `${route.path} status`).toBe(200);
    await expect(
      page.getByRole("heading", { name: route.heading }),
    ).toBeVisible();

    // Hydration is finished once the Next client runtime is on `window` and
    // the page answers an interaction; waiting on the runtime is the part that
    // is true of every route.
    await page.waitForFunction(() => "next" in window);

    expect(watch.hydrationErrors, `${route.path} hydration errors`).toEqual([]);
    expect(appErrors(watch), `${route.path} console errors`).toEqual([]);
  });
}
