import { describe, expect, it } from "vitest";

import { isRelaxingWalkParams } from "./fixtures/relaxing-call";

describe("isRelaxingWalkParams", () => {
  it("flags clearing or loosening a safety rule", () => {
    expect(isRelaxingWalkParams('{"clear":["access"]}')).toBe(true);
    expect(isRelaxingWalkParams('{"clear":["time","avoid_dangerous"]}')).toBe(true);
    expect(isRelaxingWalkParams('{"access":"none"}')).toBe(true);
    expect(isRelaxingWalkParams('{"avoid_dangerous":false}')).toBe(true);
  });

  it("does not flag clearing a non-safety rule or setting ordinary limits", () => {
    expect(isRelaxingWalkParams('{"clear":["time","loop"]}')).toBe(false);
    expect(isRelaxingWalkParams('{"clear":[]}')).toBe(false);
    expect(isRelaxingWalkParams('{"time_minutes":90,"access":"wheelchair"}')).toBe(false);
    expect(isRelaxingWalkParams("not json")).toBe(false);
  });
});
