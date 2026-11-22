import { cleanup, render } from "@testing-library/react";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import * as icons from "@/components/ui/icons";

afterEach(cleanup);

const ICONS = Object.entries(icons).filter(([name]) => name.endsWith("Icon")) as [string, (props: { className?: string }) => React.ReactElement][];

function mount(name: string) {
  const Icon = icons[name as keyof typeof icons] as (props: { className?: string }) => React.ReactElement;
  return render(createElement(Icon)).container.querySelector("svg")!;
}

describe("the Traike icon set", () => {
  it("has the icons the app uses", () => {
    expect(ICONS.length).toBeGreaterThanOrEqual(40);
  });

  it.each(ICONS.map(([name]) => name))("%s is one 24 viewBox, 1.75 stroke, round-capped currentColor svg, hidden from readers", (name) => {
    const svg = mount(name);
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("stroke-width")).toBe("1.75");
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("fill")).toBe("none");
    expect(svg.getAttribute("stroke-linecap")).toBe("round");
    expect(svg.getAttribute("stroke-linejoin")).toBe("round");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it.each(ICONS.map(([name]) => name))("%s has no fixed colour: only currentColor, none, or the bar-colour token", (name) => {
    const markup = mount(name).outerHTML;
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const [, value] of markup.matchAll(/\b(?:fill|stroke)="([^"]*)"/g)) {
      expect(value === "none" || value === "currentColor" || value.startsWith("var(--tk-nav-fill")).toBe(true);
    }
  });

  it("draws every icon with at least one shape", () => {
    for (const [name] of ICONS) expect(mount(name).querySelectorAll("path, circle, rect").length, name).toBeGreaterThan(0);
  });

  it("mirrors in Hebrew only the icons that point along the reading direction", () => {
    const mirrored = ["PlanIcon", "WalkIcon", "WalksIcon", "BackIcon", "ArrowIcon", "SpeakerIcon", "ChatIcon", "ShortcutIcon", "FlagIcon", "TrailIcon"];
    for (const [name] of ICONS) {
      const flips = (mount(name).getAttribute("class") ?? "").includes("rtl:-scale-x-100");
      expect(flips, name).toBe(mirrored.includes(name));
    }
  });

  it("keeps the tab bar's Plan and Walks clearly apart: a dotted trail between Rings, against a solid trail on a card", () => {
    const plan = mount("PlanIcon");
    const walks = mount("WalksIcon");
    expect(plan.querySelector("path[stroke-dasharray]")).not.toBeNull();
    expect(plan.querySelector("rect")).toBeNull();
    expect(plan.querySelectorAll("circle")).toHaveLength(2);
    expect(walks.querySelector("rect")).not.toBeNull();
    expect(walks.querySelector("path[stroke-dasharray]")).toBeNull();
    expect(plan.innerHTML).not.toBe(walks.innerHTML);
  });

  it("gives the five destinations five different drawings", () => {
    const drawings = ["HomeIcon", "PlanIcon", "WalkIcon", "WalksIcon", "PersonIcon"].map((n) => mount(n).innerHTML);
    expect(new Set(drawings).size).toBe(5);
  });

  it("fills the navigation arrow only while following, and takes its size from the caller", () => {
    expect(render(createElement(icons.NavArrowIcon, { filled: true })).container.querySelector("path")!.getAttribute("fill")).toBe("currentColor");
    cleanup();
    expect(render(createElement(icons.NavArrowIcon)).container.querySelector("path")!.getAttribute("fill")).toBe("none");
    cleanup();
    expect(render(createElement(icons.CloseIcon, { className: "h-4 w-4" })).container.querySelector("svg")!.getAttribute("class")).toBe("h-4 w-4");
  });
});

/**
 * The ban on emoji and text glyphs standing in for icons (docs/design-brief/BRIEF.md: "no emoji"). A glyph's look
 * changes with every phone's font; the set above does not. Allowed: place-category data (an emoji per kind of
 * place, `CATEGORY_EMOJI`), the message text the assistant itself writes (its leading "warning" sign is drawn as
 * WarnIcon by the chat), and the marker a sent photo leaves in a chat message.
 */
describe("no emoji or text glyphs in place of icons", () => {
  // ©, ® and ™ are pictographic to Unicode but are legal text, not icons.
  const BANNED = /(?![©®™])\p{Extended_Pictographic}|[✕✓✔✗ⓘ★☆✦↪↩⌄＋]/u;
  const ALLOWED_FILES = [join("map", "PoiCallouts.tsx")];
  const ALLOWED_LINE = /CATEGORY_EMOJI|🖼|⚠/;

  function files(dir: string): string[] {
    return readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : p.endsWith(".tsx") ? [p] : [];
    });
  }

  it("keeps src/components free of them", () => {
    const root = join(process.cwd(), "src/components");
    const found: string[] = [];
    for (const file of files(root)) {
      if (ALLOWED_FILES.some((a) => file.endsWith(a))) continue;
      // Comments may name a glyph; only code and visible text count.
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");
      code.split("\n").forEach((line, i) => {
        if (BANNED.test(line) && !ALLOWED_LINE.test(line)) found.push(`${file.slice(root.length + 1)}:${i + 1}: ${line.trim().slice(0, 80)}`);
      });
    }
    expect(found).toEqual([]);
  });
});
