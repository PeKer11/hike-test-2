import { expect, test, type Page } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";
import { openMore } from "./support/open-more";
import { STUBBED_PLAN } from "./support/stub-plan";

/**
 * Phone feedback 2026-11-25 (docs/WALK-SHEET-COLLAPSE-PLAN-2026-11-25.md): with the chat open the sheet took most of the
 * screen and could not be dragged down. The sheet has three states: peek (deck, numbers, credits: the map keeps the
 * screen), half (Ask, End walk, coming up, at most 45% of the map section), full (the chat open, at most 62%).
 */

async function startWalk(page: Page) {
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
}

/** The sheet's height as a share of the walk section it sits in. */
async function share(page: Page) {
  return page.getByTestId("walk-hud").evaluate((el) => {
    const section = el.closest("section")!;
    return { sheet: el.getBoundingClientRect().height, section: section.getBoundingClientRect().height };
  });
}

const handle = (page: Page) => page.getByRole("button", { name: "Expand or collapse" });

for (const viewport of [
  { width: 390, height: 844 },
  { width: 600, height: 980 },
]) {
  test(`the sheet gives the map the screen at peek and stays within its caps (${viewport.width}x${viewport.height})`, async ({ page }) => {
    // From 768px the sheet floats and keeps its own sizes; these are phone widths.
    await page.setViewportSize(viewport);
    const watch = watchConsole(page);
    await startWalk(page);
    const hud = page.getByTestId("walk-hud");

    await expect(hud).toHaveAttribute("data-sheet", "peek");
    const peek = await share(page);
    expect(peek.sheet / peek.section).toBeLessThanOrEqual(0.32);
    await expect(page.getByRole("button", { name: "End walk" })).toHaveCount(0);

    await handle(page).click();
    await expect(hud).toHaveAttribute("data-sheet", "half");
    const half = await share(page);
    expect(half.sheet / half.section).toBeLessThanOrEqual(0.45 + 0.01);
    expect(half.sheet).toBeGreaterThan(peek.sheet);

    await page.getByRole("button", { name: /^Ask/ }).click();
    await expect(hud).toHaveAttribute("data-sheet", "full");
    const chat = page.getByTestId("walk-chat");
    const input = chat.locator("input");
    for (const q of ["I need a coffee", "toilet", "how long left", "water", "restroom"]) {
      await input.fill(q);
      await input.press("Enter");
      await expect(chat.locator("li").last()).toBeVisible();
    }
    const full = await share(page);
    expect(full.sheet / full.section).toBeLessThanOrEqual(0.62 + 0.01);
    // The handle never scrolls out of view.
    const sheetBox = (await hud.boundingBox())!;
    const header = (await page.getByTestId("walk-sheet-header").boundingBox())!;
    expect(header.y).toBeGreaterThanOrEqual(sheetBox.y - 1);

    console.log(`MEASURE ${viewport.width}x${viewport.height} section=${Math.round(full.section)} peek=${Math.round((100 * peek.sheet) / peek.section)}% half=${Math.round((100 * half.sheet) / half.section)}% full=${Math.round((100 * full.sheet) / full.section)}%`);
    expect(appErrors(watch)).toEqual([]);
  });
}

test.describe("touch", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test("dragging the header down with a finger steps full, half, peek; dragging up steps back", async ({ page }) => {
    await startWalk(page);
    const hud = page.getByTestId("walk-hud");
    const cdp = await page.context().newCDPSession(page);

    /** One finger down on the sunset deck (not the handle), moved `dy` px, lifted. */
    async function swipe(dy: number) {
      const box = (await page.getByTestId("walk-turn-deck").boundingBox())!;
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
      for (let i = 1; i <= 6; i += 1) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y + (dy * i) / 6 }] });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }

    await swipe(-90);
    await expect(hud).toHaveAttribute("data-sheet", "half");
    await swipe(-90);
    await expect(hud).toHaveAttribute("data-sheet", "full");
    const heights: number[] = [(await hud.boundingBox())!.height];
    await swipe(90);
    await expect(hud).toHaveAttribute("data-sheet", "half");
    heights.push((await hud.boundingBox())!.height);
    await swipe(90);
    await expect(hud).toHaveAttribute("data-sheet", "peek");
    heights.push((await hud.boundingBox())!.height);
    expect(heights[0]).toBeGreaterThan(heights[1]);
    expect(heights[1]).toBeGreaterThan(heights[2]);
  });
});
