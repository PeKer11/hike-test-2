import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  bucketOf,
  cleanPoiKeys,
  DELAY_HOURS,
  DELAY_MS,
  delayElapsed,
  K_MIN,
  MAX_KEYS,
  meetsK,
  sanitizeSimilarRows,
  sanitizeSupportRows,
  similarBadgeText,
  supportBadgeText,
} from "@/lib/social/aggregates";

describe("k-anonymity and rounding", () => {
  it("k is 5 and the delay is 48 h", () => {
    expect(K_MIN).toBe(5);
    expect(DELAY_HOURS).toBe(48);
    expect(DELAY_MS).toBe(48 * 3_600_000);
  });

  it("meetsK: 4 no, 5 yes, junk no", () => {
    expect(meetsK(4)).toBe(false);
    expect(meetsK(5)).toBe(true);
    expect(meetsK(Number.NaN)).toBe(false);
    expect(meetsK(Number.POSITIVE_INFINITY)).toBe(false);
    expect(meetsK(-1)).toBe(false);
  });

  it.each([
    [0, null],
    [4, null],
    [5, "5+"],
    [9, "5+"],
    [10, "10+"],
    [24, "10+"],
    [25, "25+"],
    [400, "25+"],
  ])("bucketOf(%s) = %s", (n, want) => {
    expect(bucketOf(n)).toBe(want);
  });

  it("never exposes an exact count", () => {
    for (let n = 0; n < 200; n++) {
      const b = bucketOf(n);
      expect(b === null || ["5+", "10+", "25+"].includes(b)).toBe(true);
    }
  });
});

describe("delay", () => {
  const now = Date.UTC(2026, 9, 12, 12, 0, 0);
  it("a vote exactly 48 h old does not count yet (strictly older is required)", () => {
    expect(delayElapsed(now - DELAY_MS, now)).toBe(false);
  });
  it("one ms older counts", () => {
    expect(delayElapsed(now - DELAY_MS - 1, now)).toBe(true);
  });
  it("fresh and future votes do not count; junk does not count", () => {
    expect(delayElapsed(now, now)).toBe(false);
    expect(delayElapsed(now + 1, now)).toBe(false);
    expect(delayElapsed(Number.NaN, now)).toBe(false);
    expect(delayElapsed(now, Number.NaN)).toBe(false);
  });
});

describe("input and output validation", () => {
  it("cleanPoiKeys keeps OSM keys only, dedupes, caps", () => {
    expect(cleanPoiKeys(["osm-node-1", "osm-node-1", "osm-way-22", "osm-relation-3"])).toEqual(["osm-node-1", "osm-way-22", "osm-relation-3"]);
    expect(cleanPoiKeys(["cafe x@32.0800,34.7800", "node/", "node/abc", "", 5, null, "../etc"])).toEqual([]);
    expect(cleanPoiKeys("osm-node-1")).toEqual([]);
    // The app's real id format is the only one the SQL (poi_key = osm_id) can match; the slash form never does.
    expect(cleanPoiKeys(["node/1", "way/2"])).toEqual([]);
    const many = Array.from({ length: 200 }, (_, i) => `osm-node-${i + 1}`);
    expect(cleanPoiKeys(many)).toHaveLength(MAX_KEYS);
  });

  it("sanitizeSupportRows drops unrequested keys, bad buckets, extra fields", () => {
    const rows = [
      { poi_key: "osm-node-1", supporters_bucket: "10+", user_id: "secret", lat: 1 },
      { poi_key: "osm-node-2", supporters_bucket: "7" },
      { poi_key: "osm-node-9", supporters_bucket: "5+" },
      { poi_key: "osm-node-3", supporters_bucket: "25+" },
      null,
      "x",
    ];
    expect(sanitizeSupportRows(rows, ["osm-node-1", "osm-node-2", "osm-node-3"])).toEqual({
      "osm-node-1": "10+",
      "osm-node-3": "25+",
    });
    expect(sanitizeSupportRows({}, ["osm-node-1"])).toEqual({});
  });

  it("sanitizeSimilarRows keeps at most two known categories", () => {
    const rows = [
      { poi_key: "osm-node-1", reason_categories: ["park", "viewpoint", "museum"] },
      { poi_key: "osm-node-2", reason_categories: ["other", "bogus"] },
      { poi_key: "osm-node-3", reason_categories: "park" },
    ];
    expect(sanitizeSimilarRows(rows, ["osm-node-1", "osm-node-2", "osm-node-3"])).toEqual({
      "osm-node-1": ["park", "viewpoint"],
    });
  });
});

describe("fixed templates", () => {
  it("EN and HE badge text, no user text anywhere", () => {
    expect(supportBadgeText("en", "10+")).toBe("Recommended by walkers (10+)");
    expect(supportBadgeText("he", "5+")).toBe("מומלץ על ידי הולכים (5+)");
    expect(similarBadgeText("en", ["park", "viewpoint"])).toBe("Walkers who also like parks and viewpoints liked this");
    expect(similarBadgeText("he", ["park", "viewpoint"])).toBe("הולכים שגם אוהבים פארקים ותצפיות אהבו את זה");
    expect(similarBadgeText("en", [])).toBe("");
  });
});

// The SQL cannot be executed here, so the constants that matter are pinned by
// reading the migration. A drift between the SQL and the TS twin fails this.
describe("migration matches the TS constants and the plan's protections", () => {
  const sql = readFileSync("supabase/migrations/20261012110000_social_aggregates.sql", "utf8");
  const code = sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

  it("k, delay and buckets", () => {
    expect(code).toContain(`having count(distinct f.user_id) >= ${K_MIN}`);
    expect(code).toContain(`interval '${DELAY_HOURS} hours'`);
    expect(code).toMatch(/s\.n >= 25 then '25\+'/);
    expect(code).toMatch(/s\.n >= 10 then '10\+'/);
    expect(code).toContain("else '5+'");
    expect(code).toContain(`between 1 and ${MAX_KEYS}`);
  });

  it("security definer, pinned search_path, revoked from anon/public, granted to authenticated", () => {
    expect((code.match(/security definer/g) ?? []).length).toBe(2);
    // The two definer functions plus the (invoker) force_insert_timestamps trigger function.
    expect((code.match(/set search_path = public, pg_temp/g) ?? []).length).toBe(3);
    expect(code).toContain("revoke execute on function public.force_insert_timestamps() from public, anon;");
    for (const fn of ["community_place_support", "similar_walkers_places"]) {
      expect(code).toContain(`revoke execute on function public.${fn}(text[]) from public, anon;`);
      expect(code).toContain(`grant execute on function public.${fn}(text[]) to authenticated;`);
    }
  });

  it("return tables expose no user id, coordinates or timestamps", () => {
    const returns = [...code.matchAll(/returns table \(([^)]*)\)/g)].map((m) => m[1]);
    expect(returns).toHaveLength(2);
    for (const r of returns) {
      expect(r).not.toMatch(/user|lat|lng|created|updated|name|opted/);
    }
  });

  it("only public OSM places, never 'other', caller must be opted in", () => {
    expect(code).toContain("f.osm_id is not null and f.osm_id <> ''");
    expect(code).toContain("f.category <> 'other'");
    expect(code).toContain("from public.community_optin me where me.user_id = auth.uid()");
  });

  it("opt-in table: RLS, own-row select/insert/delete, anon revoked", () => {
    expect(code).toContain("alter table public.community_optin enable row level security;");
    expect(code).toContain("revoke all on table public.community_optin from anon, public;");
    expect((code.match(/create policy/g) ?? []).length).toBe(3);
    expect(code).toContain("for delete to authenticated");
  });
});
