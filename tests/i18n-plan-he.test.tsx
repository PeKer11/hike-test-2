import { render, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { WalkPlanResults } from "@/components/route/WalkPlanResults";
import { formatDistance } from "@/lib/utils/geo";
import type { WalkPlan } from "@/lib/types";

afterEach(cleanup);

const plan = {
  orderedAttractions: [{ id: "a", name: "Gan", category: "park", avgVisitMinutes: 3 }],
  droppedAttractions: [{ id: "b", name: "Museum" }],
  segments: [{ walkingMinutes: 10, distanceMeters: 347 }],
  totalMinutes: 13,
  totalDistanceMeters: 347,
  feasible: true,
} as unknown as WalkPlan;

describe("WalkPlanResults in Hebrew", () => {
  it("shows no English words outside the stop names", () => {
    const { container } = render(<WalkPlanResults plan={plan} error={null} lang="he" />);
    const text = (container.textContent ?? "").replace(/Gan|Museum/g, "");
    expect(text).not.toMatch(/[A-Za-z]{2,}/);
    expect(text).toContain("המסלול שלך");
    expect(text).toContain("13 דק׳ בסך הכול");
  });
  it("keeps English by default", () => {
    const { container } = render(<WalkPlanResults plan={plan} error={null} />);
    expect(container.textContent).toContain("Your Walk Plan");
  });
  it("formats distance in Hebrew", () => {
    expect(formatDistance(347, "he")).toBe("347 מ׳");
    expect(formatDistance(1500, "he")).toBe("1.5 ק״מ");
    expect(formatDistance(347)).toBe("347 m");
  });
});

import { displayWalkTitle, titleForWalk } from "@/lib/walks/walk-history";

describe("walk titles", () => {
  const stops = [{ name: "Alush" }, { name: "Gan" }] as never;
  const at = new Date("2026-11-26T10:00:00Z");
  it("keeps the English title", () => {
    expect(titleForWalk(stops, at)).toBe("Alush + 1 more, Nov 26");
  });
  it("writes a Hebrew title", () => {
    expect(titleForWalk(stops, at, "he")).toMatch(/^Alush ועוד 1 · /);
    expect(titleForWalk([], at, "he")).toMatch(/^הליכה · /);
  });
  it("shows an untouched English auto title in Hebrew, but the walker's own title as written", () => {
    const auto = { title: titleForWalk(stops, at), stops, createdAt: at.toISOString() };
    expect(displayWalkTitle(auto, "he")).toMatch(/ועוד 1/);
    expect(displayWalkTitle(auto, "en")).toBe(auto.title);
    expect(displayWalkTitle({ ...auto, title: "My trip" }, "he")).toBe("My trip");
  });
});
