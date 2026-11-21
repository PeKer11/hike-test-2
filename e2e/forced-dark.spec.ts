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

  // An explicit light choice must survive forced dark (device dark would otherwise give our own dark theme).
  await page.addInitScript(() => {
    localStorage.setItem("traike-theme", "light");
    localStorage.setItem("traike-consent-accepted", "1"); // the consent screen would dim the page
  });
  await page.goto("/app?view=plan");
  await expect(page.getByRole("button", { name: "Build walking route" })).toBeVisible();
  // The top of the Plan is the painted header; sample the cream form body below it, at the screen's left edge.
  const painted = luminance(await paintedRgb(page, 4, 600));
  // Cream #fbf8f4 is about 0.97; a repainted card is near black.
  expect(painted).toBeGreaterThanOrEqual(0.85);
});
