import { expect, test, type Page } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";
import { openMore } from "./support/open-more";
import { ORIGIN, STUBBED_PLAN } from "./support/stub-plan";

/**
 * The tablet and desktop pass (feedback round 2026-11-22, item 8): every screen has a layout from md (768) and lg (1024) up,
 * and the phone layout is the one that was approved. This spec is the geometry of it, in a real browser; the pixel gate for
 * the phone (before / after screenshots) is `scripts/responsive-shots.mjs`.
 */

const WIDTHS = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1920, height: 1080 },
] as const;

const SCREENS = ["/app", "/app?view=plan", "/app?view=walks", "/app?view=social", "/app?view=me", "/login", "/signup", "/forgot-password", "/pricing", "/privacy"];

const SNAPSHOT = {
  plan: { ...STUBBED_PLAN, totalMinutes: 47 },
  geometry: STUBBED_PLAN.geometry,
  input: { origin: { lat: 32.0779, lng: 34.7742 }, availableMinutes: 60, walkingPaceMinPerKm: 15, radiusMeters: 2000 },
  visitedIds: [],
  startedAt: Date.now() - 5 * 60_000,
  lastFix: null,
  walkId: null,
  savedAt: Date.now(),
};

async function box(page: Page, selector: string) {
  const b = await page.locator(selector).first().boundingBox();
  expect(b, selector).not.toBeNull();
  return b!;
}

async function buildPlan(page: Page) {
  await page.route("**/api/walk-plan", (route) => route.fulfill({ json: STUBBED_PLAN }));
  await page.route("**/api/nearby", (route) => route.fulfill({ json: { places: [] } }));
  await page.goto("/app?view=plan");
  await openMore(page);
  await page.getByPlaceholder("Latitude").fill(ORIGIN.lat);
  await page.getByPlaceholder("Longitude").fill(ORIGIN.lng);
  await page.getByRole("button", { name: "Build walking route" }).click();
  await expect(page.getByRole("heading", { name: "Your Walk Plan" })).toBeVisible({ timeout: 15_000 });
}

for (const vp of WIDTHS) {
  test.describe(`${vp.width}px`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("no screen scrolls sideways", async ({ page }) => {
      const watch = watchConsole(page);
      for (const path of SCREENS) {
        await page.goto(path);
        await page.waitForTimeout(400);
        const overflow = await page.evaluate(() => {
          const over: string[] = [];
          if (document.documentElement.scrollWidth > window.innerWidth + 1) over.push("document");
          // The app screens are fixed, scrolling panes: none of them may be wider than itself.
          for (const el of document.querySelectorAll<HTMLElement>(".overflow-y-auto")) {
            if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") continue;
            if (el.scrollWidth > el.clientWidth + 1) over.push(el.className.slice(0, 60));
          }
          return over;
        });
        expect(overflow, `${path} at ${vp.width}`).toEqual([]);
      }
      expect(watch.hydrationErrors).toEqual([]);
      expect(appErrors(watch)).toEqual([]);
    });

    test("the rail is the navigation from lg, the bottom bar below it", async ({ page }) => {
      await page.goto("/app");
      const nav = page.getByRole("navigation", { name: "App" }).filter({ visible: true });
      await expect(nav).toHaveCount(1);
      const b = (await nav.boundingBox())!;
      if (vp.width >= 1024) {
        expect(b.width).toBeCloseTo(72, 0);
        expect(b.x).toBeCloseTo(0, 0);
      } else {
        expect(b.width).toBeCloseTo(vp.width, 0);
        expect(b.y + b.height).toBeCloseTo(vp.height, 0);
      }
    });

    test("Home: the walk and the recent walks sit side by side from md, stacked on a phone; the numbers clear the traveler", async ({ page }) => {
      await page.addInitScript((s) => localStorage.setItem("traike.activeWalk.v1", JSON.stringify(s)), SNAPSHOT);
      await page.goto("/app");
      const walk = page.locator("section[aria-label='Your walk']");
      const recent = page.locator("section[aria-label='Saved & recent walks']");
      await expect(walk).toBeVisible();
      const [a, b] = [(await walk.boundingBox())!, (await recent.boundingBox())!];
      if (vp.width >= 768) {
        // Two columns: the second starts where the first ends and they share a top.
        expect(b.x).toBeGreaterThanOrEqual(a.x + a.width - 1);
        expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(2);
        // The button is on the end side, past the middle of the page and clear of the traveler on the start side.
        const button = (await page.getByRole("button", { name: /Continue walk/ }).boundingBox())!;
        expect(button.x).toBeGreaterThan(vp.width * 0.3);
        expect(button.x + button.width).toBeLessThanOrEqual(vp.width + 1);
      } else {
        expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
      }
    });

    test("Plan: the map is above the form on a phone and beside it from a tablet's width", async ({ page }) => {
      await buildPlan(page);
      const map = await box(page, ".leaflet-container");
      const form = await box(page, "aside");
      if (vp.width >= 768) {
        // Two panes: the form at the start, the map filling the rest, side by side.
        expect(map.x).toBeGreaterThanOrEqual(form.x + form.width - 1);
        expect(map.height).toBeGreaterThan(vp.height * 0.6);
      } else {
        // A block above the chat and the form: 35 to 45 percent of the screen, and the form starts under it.
        expect(map.y).toBeCloseTo(0, 0);
        expect(map.height).toBeGreaterThan(vp.height * 0.25);
        expect(map.height).toBeLessThan(vp.height * 0.45);
        expect(form.y).toBeGreaterThanOrEqual(map.y + map.height - 1);
      }
      // One "Full map", and only where it is needed (a phone).
      await expect(page.getByRole("button", { name: "Full map" }).filter({ visible: true })).toHaveCount(vp.width >= 768 ? 0 : 1);
    });

    test("Live Walk: a bottom sheet on a phone, a centred 560px sheet on a tablet, a 400px panel at the start side on a desktop", async ({ page }) => {
      await buildPlan(page);
      await page.getByLabel(/Simulate this walk/).check();
      await page.getByRole("button", { name: "Start Walk" }).click();
      const hud = page.getByTestId("walk-hud");
      await expect(hud).toBeVisible();
      const h = (await hud.boundingBox())!;
      const map = await box(page, ".leaflet-container");
      if (vp.width >= 1024) {
        expect(h.width).toBeCloseTo(400, 0);
        // At the start (left) side of the map, with the map's own bottom strip left clear under it.
        const mapPane = await box(page, "[data-testid=walk-hud] >> xpath=ancestor::section[1]");
        expect(h.x - mapPane.x).toBeLessThan(40);
        expect(h.y + h.height).toBeLessThan(mapPane.y + mapPane.height - 16);
        expect(map.height).toBeGreaterThanOrEqual(mapPane.height - 2);
      } else if (vp.width >= 768) {
        expect(h.width).toBeCloseTo(560, 0);
        expect(h.x + h.width / 2).toBeCloseTo(vp.width / 2, 0);
        expect(map.height).toBeGreaterThan(h.height + 200);
      } else {
        expect(h.width).toBeCloseTo(vp.width, 0);
        // As approved: the map has the whole screen and the sheet lies over its bottom half (walk-hud.spec.ts holds the rest).
        expect(map.height).toBeGreaterThanOrEqual(0.9 * vp.height);
        expect(h.y).toBeGreaterThan(vp.height / 2);
      }
    });
  });
}

test.describe("sign in", () => {
  test("is the phone column, a 480px column on a tablet and a 960px split card on a desktop", async ({ page }) => {
    for (const [width, expected] of [[390, 390], [768, 480], [1280, 960]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/login");
      const card = await box(page, "main > div");
      expect(card.width, `${width}`).toBeCloseTo(expected, 0);
    }
    // The desktop split: the arch and the guide on the start half, the form on the other.
    const header = await box(page, "main header");
    const form = await box(page, "main form");
    expect(form.x).toBeGreaterThanOrEqual(header.x + header.width - 1);
  });

  test("forgot password is the same frame as sign in", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/login");
    const login = await box(page, "main > div");
    await page.goto("/forgot-password");
    const forgot = await box(page, "main > div");
    expect(forgot.width).toBeCloseTo(login.width, 0);
    await expect(page.getByRole("heading", { level: 1, name: "Reset your password" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
  });
});
