import type { Page } from "@playwright/test";

/** Opens the walk's Details sheet: the button lives in the sheet's half state, so raise the sheet first if it is at peek. */
export async function openWalkDetails(page: Page): Promise<void> {
  const details = page.getByRole("button", { name: "Details" });
  if (!(await details.isVisible())) await page.getByRole("button", { name: "Expand or collapse" }).click();
  await details.click();
}
