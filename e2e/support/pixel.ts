import type { Page } from "@playwright/test";

/**
 * The colour actually painted at a pixel, read from a screenshot. Chromium's forced dark mode repaints
 * after style resolution, so `getComputedStyle` still says "cream" while the screen shows black.
 */
export async function paintedRgb(page: Page, x: number, y: number): Promise<[number, number, number]> {
  const png = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  const probe = await page.context().newPage();
  try {
    return await probe.evaluate(async (b64) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 1;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
      return [r, gg, b] as [number, number, number];
    }, png.toString("base64"));
  } finally {
    await probe.close();
  }
}

export const luminance = ([r, g, b]: [number, number, number]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
