import { describe, expect, it } from "vitest";

import { evaluateRoute } from "@/lib/walk/rule-verdict";

const geometry = [
  { lat: 32.0, lng: 34.0 },
  { lat: 32.01, lng: 34.0 },
];
const base = {
  geometry,
  origin: geometry[0],
  forbidden: { ways: [], failed: false },
  boundary: null,
  paceMinPerKm: 15,
  visitMin: 0,
};

describe("time rule and climbing", () => {
  it("is partial near the limit when heights are unknown", () => {
    const v = evaluateRoute({ ...base, params: { timeMinutes: 20 } });
    expect(v.rules.find((r) => r.rule === "time")?.status).toBe("partial");
    expect(v.climbMin).toBeUndefined();
  });

  it("is met when heights are known, and reports the climbing", () => {
    const v = evaluateRoute({ ...base, params: { timeMinutes: 20 }, walkMin: 17, climbMin: 2 });
    expect(v.rules.find((r) => r.rule === "time")?.status).toBe("met");
    expect(v.climbMin).toBe(2);
  });

  it("stays met when far under the limit without heights", () => {
    const v = evaluateRoute({ ...base, params: { timeMinutes: 120 } });
    expect(v.rules.find((r) => r.rule === "time")?.status).toBe("met");
  });
});
