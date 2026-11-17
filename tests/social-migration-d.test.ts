import { describe, expect, it } from "vitest";

import { functionsIn, grantedToAuthenticated, hasNotAppliedHeader, hasRevokeFromAnon, readMigration, revokedFromAuthenticated } from "./helpers/sql";

const sql = readMigration("20261125100000_nearby_walkers.sql");
const fns = functionsIn(sql);

describe("migration D (nearby walkers), SQL text", () => {
  it("is loudly gated: not applied, counsel + DPIA + explicit OK, flags stay off", () => {
    expect(hasNotAppliedHeader(sql)).toBe(true);
    expect(sql.slice(0, 1400)).toMatch(/lawyer/);
    expect(sql.slice(0, 1400)).toMatch(/DPIA/);
    expect(sql.slice(0, 1400)).toMatch(/explicit OK/);
    expect(sql.slice(0, 1400)).toMatch(/NEXT_PUBLIC_SOCIAL_NEARBY and SOCIAL_NEARBY stay OFF/);
  });

  it("every function is security definer, pinned, revoked from anon; the helper from clients too", () => {
    for (const f of fns) {
      expect(f.body, f.name).toMatch(/security definer/i);
      expect(f.body, f.name).toMatch(/set search_path = public, pg_temp/i);
      expect(hasRevokeFromAnon(sql, f.name), f.name).toBe(true);
    }
    expect(revokedFromAuthenticated(sql, "_insert_walk_request")).toBe(true);
    expect(grantedToAuthenticated(sql, "_insert_walk_request")).toBe(false);
    for (const n of ["send_walk_request", "send_walk_request_nearby", "walking_now", "social_profile_card_by_token"]) expect(grantedToAuthenticated(sql, n), n).toBe(true);
    expect(sql).not.toMatch(/execute\s+format/i);
  });

  it("the nearby branch needs the caller's own live public presence and stays within 2 cells", () => {
    const f = fns.find((x) => x.name === "walking_now")!;
    const nearby = f.body.slice(f.body.indexOf("nearby as ("));
    expect(nearby).toMatch(/m\.audience = 'public'/);
    expect(nearby).toMatch(/m\.expires_at > now\(\)/);
    expect(nearby).toMatch(/p\.audience = 'public'/);
    expect(nearby).toMatch(/abs\(p\.cell_y - m\.cell_y\) <= 2 and abs\(p\.cell_x - m\.cell_x\) <= 2/);
  });

  it("friends are excluded from the nearby branch, blocked pairs and suspended owners too", () => {
    const f = fns.find((x) => x.name === "walking_now")!;
    const nearby = f.body.slice(f.body.indexOf("nearby as ("));
    expect(nearby).toMatch(/not public\.are_friends\(auth\.uid\(\), p\.user_id\)/);
    expect(nearby).toMatch(/not public\.is_blocked\(auth\.uid\(\), p\.user_id\)/);
    expect(nearby).toMatch(/sp\.suspended_at is null/);
    expect(nearby).toMatch(/limit 20/);
  });

  it("strangers get no friend id and no position; the friends branch is unchanged", () => {
    const f = fns.find((x) => x.name === "walking_now")!;
    expect(f.body).toMatch(/null::uuid as friend_id/);
    expect(f.body).toMatch(/'nearby'::text as relation/);
    expect(f.body).toMatch(/'friend'::text as relation/);
    const outputs = f.body.slice(0, f.body.indexOf("language sql"));
    expect(outputs).not.toMatch(/\bcell_|\blat\b|\blng\b/);
  });

  it("a request to a stranger goes by token, within 2 cells, both public, through the shared helper", () => {
    const f = fns.find((x) => x.name === "send_walk_request_nearby")!;
    expect(f.body).toMatch(/p\.token = p_token/);
    expect(f.body).toMatch(/audience = 'public'/);
    expect(f.body).toMatch(/abs\(p\.cell_y - me\.cell_y\) <= 2/);
    expect(f.body).toMatch(/_insert_walk_request\(/);
    expect(fns.find((x) => x.name === "send_walk_request")!.body).toMatch(/are_friends\(auth\.uid\(\), p_to_user\)/);
    expect(fns.find((x) => x.name === "send_walk_request")!.body).toMatch(/_insert_walk_request\(/);
  });

  it("the card by token is for public profiles only (through social_profile_card) and respects blocks", () => {
    const f = fns.find((x) => x.name === "social_profile_card_by_token")!;
    expect(f.body).toMatch(/public\.social_profile_card\(p\.user_id\)/);
    expect(f.body).toMatch(/not public\.is_blocked/);
    expect(f.body).toMatch(/me\.audience = 'public'/);
  });
});
