import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/session", () => ({ updateSession: vi.fn(async () => ({ response: new Response(null), user: null })) }));

import proxy from "@/proxy";
import { redactForLog } from "@/lib/utils/redact";

describe("redactForLog", () => {
  it("blanks coordinates", () => {
    expect(redactForLog(new Error("point 34.78123,32.0712"))).not.toMatch(/\d\.\d{3}/);
    expect(redactForLog("32.07123")).toBe("~");
  });
});

describe("api origin check", () => {
  const req = (method: string, headers: Record<string, string> = {}) =>
    new NextRequest("https://traike.test/api/assistant", { method, headers });

  it("refuses a cross-site POST", async () => {
    const res = await proxy(req("POST", { origin: "https://evil.example" }));
    expect(res.status).toBe(403);
    expect((await proxy(req("POST", { "sec-fetch-site": "cross-site" }))).status).toBe(403);
  });

  it("lets a same-origin POST and a GET through", async () => {
    expect((await proxy(req("POST", { origin: "https://traike.test" }))).status).not.toBe(403);
    expect((await proxy(req("GET", { origin: "https://evil.example" }))).status).not.toBe(403);
  });
});
