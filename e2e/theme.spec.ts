import { expect, test } from "@playwright/test";

import { luminance, paintedRgb } from "./support/pixel";

const SHOTS = ["/login", "/signup", "/forgot-password", "/app"];

test.describe("dark theme", () => {
  test.use({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });

  test("follows the device with no flash and paints dark", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("traike-consent-accepted", "1"));
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const card = await page.locator("form").boundingBox();
    expect(luminance(await paintedRgb(page, card!.x + 4, card!.y + 4))).toBeLessThan(0.15);
  });

  test("manual toggle survives a reload; landing stays light", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("radio", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await page.getByRole("radio", { name: "Dark" }).click();
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  for (const path of SHOTS) {
    for (const theme of ["light", "dark"] as const) {
      test(`screenshot ${path} ${theme}`, async ({ page }) => {
        await page.addInitScript((t) => {
          localStorage.setItem("traike-theme", t);
          localStorage.setItem("traike-consent-accepted", "1");
        }, theme);
        await page.goto(path);
        await page.waitForTimeout(800);
        await page.screenshot({ path: `test-results/theme/${path.slice(1)}-${theme}.png` });
      });
    }
  }
});
