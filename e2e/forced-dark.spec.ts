import { expect, test } from "@playwright/test";

import { luminance, paintedRgb } from "./support/pixel";

/**
 * Samsung Internet / Chrome "force dark" must not repaint the cream UI. The page opts out with
 * `color-scheme: only light`; this spec turns forced dark on in Chromium and reads the painted pixel.
 */
test.use({
  viewport: { width: 412, height: 915 },
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
  launchOptions: { args: ["--enable-features=WebContentsForceDark", "--blink-settings=forceDarkModeEnabled=true"] },
});

test("the cream UI stays light under forced dark mode", async ({ page }) => {
  // Control: a plain white page with no opt-out. If this Chromium does not force-darken it, the check proves nothing.
  await page.setContent('<body style="margin:0;background:#fff;height:100vh"></body>');
  const control = luminance(await paintedRgb(page, 10, 10));
  test.skip(control > 0.5, "this Chromium ignores forced dark; run the Samsung phone check (B8)");

  await page.goto("/app");
  await expect(page.getByRole("button", { name: "Build My Walk" })).toBeVisible();
  const box = await page.locator(".bg-cream").first().boundingBox();
  expect(box).not.toBeNull();
  const painted = luminance(await paintedRgb(page, box!.x + 4, box!.y + 4));
  // Cream #fbf8f4 is about 0.97; a repainted card is near black.
  expect(painted).toBeGreaterThanOrEqual(0.85);
});
