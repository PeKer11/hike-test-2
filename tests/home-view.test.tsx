import { statSync, readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeView } from "@/components/shell/HomeView";
import { PlannerBridge } from "@/lib/shell/planner-bridge";

afterEach(() => {
  cleanup();
  window.history.replaceState(null, "", "/");
});

function setup(over: { greetingName?: string | null; lang?: "he" | "en" } = {}) {
  const onNavigate = vi.fn();
  render(
    <HomeView greetingName={over.greetingName ?? null} lang={over.lang ?? "en"} bridge={new PlannerBridge()} walkLive={false} signedIn={false} onNavigate={onNavigate} />,
  );
  return onNavigate;
}

describe("Home", () => {
  it("offers the plan button in the hero and a way to the walks list", () => {
    const onNavigate = setup();
    fireEvent.click(screen.getByRole("button", { name: /Plan my walk/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("plan");
    fireEvent.click(screen.getByRole("button", { name: /My walks/ }));
    expect(onNavigate).toHaveBeenLastCalledWith("walks");
  });

  it("greets by name when there is one, and never shows an email", () => {
    setup({ greetingName: "Dana" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain("Dana");
    cleanup();
    setup();
    expect(screen.getByRole("heading", { level: 1 }).textContent).not.toMatch(/@/);
  });

  it("has at most four blocks", () => {
    setup();
    // greeting + the walks bar (signed out: no walk to continue, no timeline, no context row)
    expect(document.querySelectorAll("h1, section").length).toBeLessThanOrEqual(4);
  });

  it("speaks Hebrew", () => {
    setup({ lang: "he" });
    expect(screen.getByRole("button", { name: /ההליכות שלי/ })).toBeTruthy();
  });
});

// The hero picture. The phone look is approved and must not move; tablet and desktop get a sharp landscape.
function heroImages(file: string): HTMLImageElement[] {
  return [...document.querySelectorAll<HTMLImageElement>("header img[aria-hidden='true']")].filter((img) =>
    decodeURIComponent(img.getAttribute("src") ?? "").includes(file),
  );
}

describe("Home hero picture", () => {
  it("keeps the approved portrait pair for phones, hidden from md up", () => {
    setup();
    const [day, night, ...more] = heroImages("/images/traike/home-forest.jpg");
    expect(more).toHaveLength(0);
    for (const img of [day, night]) {
      expect(img.getAttribute("sizes")).toBe("100vw");
      expect(img.className).toContain("object-cover");
      expect(img.className).toContain("object-[50%_38%]");
    }
    expect(day.className).toContain("dark:hidden");
    expect(day.className).toContain("md:hidden");
    expect(night.className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(night.className).toContain("max-md:dark:block");
  });

  it("serves a sharp wide landscape from md up only, mirrored for Hebrew", () => {
    setup();
    const wide = heroImages("/images/traike/home-forest-wide.jpg");
    expect(wide).toHaveLength(1);
    expect(wide[0].className).toMatch(/(^|\s)hidden(\s|$)/);
    expect(wide[0].className).toContain("md:block");
    expect(wide[0].className).toContain("rtl:-scale-x-100");
    expect(wide[0].getAttribute("sizes")).toContain("calc(100vw - 72px)");
  });

  it("?homebg=forward swaps only the phone picture", () => {
    window.history.replaceState(null, "", "/app?homebg=forward");
    setup();
    expect(heroImages("/images/traike/home-forest-forward.jpg")).toHaveLength(2);
    expect(heroImages("/images/traike/home-forest.jpg")).toHaveLength(0);
    expect(heroImages("/images/traike/home-forest-wide.jpg")).toHaveLength(1);
  });

  it("?homebg=city is unchanged: its own pair at every width, no wide picture", () => {
    window.history.replaceState(null, "", "/app?homebg=city");
    setup();
    expect(heroImages("/images/traike/home-city.jpg")[0].className).not.toContain("md:hidden");
    expect(heroImages("/images/traike/home-city-night.jpg")[0].className).toContain("dark:block");
    expect(heroImages("/images/traike/home-forest-wide.jpg")).toHaveLength(0);
  });

  it("puts the numbers and the button on the end side from md, clear of the traveler, and keeps the phone block as it was", () => {
    setup();
    const button = screen.getByRole("button", { name: /Plan my walk/ });
    const block = button.parentElement as HTMLElement;
    // Phone: the same block as before. md and up: the end side of the band (mirrored with the picture in Hebrew), 440px wide.
    expect(block.className).toContain("mt-4");
    for (const c of ["md:ms-auto", "md:mt-auto", "md:max-w-[440px]"]) expect(block.className).toContain(c);
    // The header column is the shared page column, a flex column from md so the block can sit at the bottom.
    expect(document.querySelector("header > div.relative")?.className).toContain("tk-page");
  });

  it("?homebg=city keeps its own 560px column and block at every width", () => {
    window.history.replaceState(null, "", "/app?homebg=city");
    setup();
    const block = screen.getByRole("button", { name: /Plan my walk/ }).parentElement as HTMLElement;
    expect(block.className).not.toContain("md:ms-auto");
    expect(document.querySelector("header > div.relative")?.className).toContain("max-w-[560px]");
  });

  it("lays the content out in the page column", () => {
    setup();
    const content = document.querySelector("section[aria-label]")?.closest("div.tk-page");
    expect(content).toBeTruthy();
  });

  it("ships the wide picture big enough to stay sharp and small enough to load", () => {
    // Read the JPEG's frame header: no image library needed.
    const size = (file: string) => {
      const b = readFileSync(`public/images/traike/${file}`);
      for (let i = 2; i < b.length; ) {
        const marker = b[i + 1];
        if (marker >= 0xc0 && marker <= 0xc2) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
        i += 2 + b.readUInt16BE(i + 2);
      }
      throw new Error(`no frame header in ${file}`);
    };
    const wide = size("home-forest-wide.jpg");
    expect(wide.w).toBeGreaterThanOrEqual(2880);
    expect(wide.w / wide.h).toBeGreaterThanOrEqual(2.3);
    expect(size("home-forest.jpg")).toEqual({ w: 1000, h: 1500 });
    for (const f of ["home-forest-wide.jpg", "home-forest-forward.jpg"]) {
      expect(statSync(`public/images/traike/${f}`).size).toBeLessThanOrEqual(450 * 1024);
    }
  });
});
