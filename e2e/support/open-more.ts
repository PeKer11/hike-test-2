import type { Page } from "@playwright/test";

/** The Plan form keeps location, radius and pace under "More options" (closed by default): open it before typing coordinates. */
export async function openMore(page: Page): Promise<void> {
  await page.locator("details").evaluateAll((all) => all.forEach((d) => ((d as HTMLDetailsElement).open = true)));
}
