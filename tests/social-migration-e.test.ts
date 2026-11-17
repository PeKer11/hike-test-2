import { describe, expect, it } from "vitest";

import { functionsIn, grantedToAuthenticated, hasNotAppliedHeader, hasRevokeFromAnon, readMigration } from "./helpers/sql";
import { TASTE_TAGS } from "@/lib/llm/tasks/taste-summary";

const sql = readMigration("20261126100000_taste_summaries.sql");

describe("migration E (taste summaries), SQL text", () => {
  it("is not applied and says A comes first", () => {
    expect(hasNotAppliedHeader(sql)).toBe(true);
    expect(sql).toMatch(/A 20261118100000_social_profiles\.sql first/);
  });
  it("own rows only, RLS on, closed to anon, delete policy for Forget everything", () => {
    expect(sql).toContain("alter table public.taste_summaries enable row level security");
    expect(sql).toMatch(/revoke all on table public\.taste_summaries from anon, public/);
    for (const op of ["select", "insert", "update", "delete"]) expect(sql).toMatch(new RegExp(`for ${op} to authenticated`));
    expect((sql.match(/auth\.uid\(\) = user_id/g) ?? []).length).toBeGreaterThanOrEqual(5);
    for (const m of sql.matchAll(/create policy "([^"]+)" on (public\.\w+)/g)) expect(sql).toContain(`drop policy if exists "${m[1]}" on ${m[2]}`);
  });
  it("tags are limited to the same 18 as the code, at most 6, and the summary is size-capped", () => {
    for (const tag of TASTE_TAGS) expect(sql).toContain(`'${tag}'`);
    expect(sql).toMatch(/cardinality\(tags\) <= 6/);
    expect(sql).toMatch(/pg_column_size\(summary\) <= 2048/);
  });
  it("the card shows taste tags only when the walker turned show_taste on", () => {
    const f = functionsIn(sql).find((x) => x.name === "social_profile_card")!;
    expect(f.body).toMatch(/security definer/);
    expect(f.body).toMatch(/set search_path = public, pg_temp/);
    expect(f.body).toMatch(/case when sp\.show_taste then coalesce\(\(select ts\.tags/);
    expect(hasRevokeFromAnon(sql, "social_profile_card")).toBe(true);
    expect(grantedToAuthenticated(sql, "social_profile_card")).toBe(true);
  });
});
