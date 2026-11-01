import { expect, test } from "@playwright/test";

import { appErrors, watchConsole } from "./support/console-watch";

/**
 * The one-time consent screen. Every other spec starts past it (see storageState in
 * playwright.config.ts); this one starts as a brand-new walker.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test("a new walker sees the consent screen once and it stays dismissed", async ({ page }) => {
  const watch = watchConsole(page);
  await page.goto("/app");

  const dialog = page.getByRole("dialog", { name: "Before your first walk" });
  await expect(dialog).toBeVisible();

  await page.getByRole("button", { name: "No thanks, keep it generic" }).click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(page.getByRole("dialog", { name: "Before your first walk" })).toHaveCount(0);
  expect(appErrors(watch)).toEqual([]);
});
