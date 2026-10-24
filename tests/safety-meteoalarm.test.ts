import { describe, expect, it } from "vitest";

import { inSafetyCoverage, parseWarnings, pointInPolygon, warningsAt } from "@/lib/safety/meteoalarm";

const xml = (onset: string, expires: string) => `<feed><entry>
<cap:polygon>31.0,35.0 31.0,36.0 32.0,36.0 32.0,35.0 31.0,35.0</cap:polygon>
<cap:areaDesc>Test Hills</cap:areaDesc><cap:event>THUNDERSTORM</cap:event>
<cap:expires>${expires}</cap:expires><cap:onset>${onset}</cap:onset><cap:severity>Moderate</cap:severity>
</entry></feed>`;

describe("meteoalarm", () => {
  const now = new Date("2026-10-24T12:00:00Z");

  it("parses an entry and finds a point inside its polygon", () => {
    const [w] = parseWarnings(xml("2026-10-24T11:00:00+00:00", "2026-10-24T15:00:00+00:00"));
    expect(w).toMatchObject({ event: "THUNDERSTORM", area: "Test Hills", severity: "Moderate" });
    expect(pointInPolygon(31.5, 35.5, w.polygon)).toBe(true);
    expect(pointInPolygon(30.5, 35.5, w.polygon)).toBe(false);
  });

  it("keeps active and soon-starting warnings, drops expired and far-future ones", () => {
    const at = (onset: string, expires: string) => warningsAt(parseWarnings(xml(onset, expires)), 31.5, 35.5, now, 4).length;
    expect(at("2026-10-24T11:00:00+00:00", "2026-10-24T15:00:00+00:00")).toBe(1);
    expect(at("2026-10-24T14:00:00+00:00", "2026-10-24T18:00:00+00:00")).toBe(1);
    expect(at("2026-10-24T08:00:00+00:00", "2026-10-24T10:00:00+00:00")).toBe(0);
    expect(at("2026-10-25T08:00:00+00:00", "2026-10-25T10:00:00+00:00")).toBe(0);
  });

  it("covers Israel only", () => {
    expect(inSafetyCoverage(32.08, 34.78)).toBe(true);
    expect(inSafetyCoverage(48.85, 2.35)).toBe(false);
  });
});
