import type { Page } from "@playwright/test";

/** Opens the walk's Details sheet: the button lives in the sheet's half state, so raise the sheet first if it is at peek. */
export async function openWalkDetails(page: Page): Promise<void> {
  const details = page.getByRole("button", { name: "Details" });
  if (!(await details.isVisible())) await page.getByRole("button", { name: "Expand or collapse" }).click();
  await details.click();
}

/** A walk starts at peek (deck, numbers, credits). Ask and End walk wait in half: raise the sheet if it is still at peek. */
export async function raiseWalkSheet(page: Page): Promise<void> {
  const hud = page.getByTestId("walk-hud");
  if ((await hud.getAttribute("data-sheet")) === "peek") await page.getByRole("button", { name: /^(Expand or collapse|הרחבה או כיווץ)$/ }).click();
}
