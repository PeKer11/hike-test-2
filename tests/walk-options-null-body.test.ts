import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/ors-client", () => ({ getDirections: vi.fn() }));

import { POST } from "@/app/api/walk-options/route";

function post(rawBody: string): Request {
  return new Request("http://localhost/api/walk-options", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "7.7.7.7" },
    body: rawBody,
  });
}

describe("POST /api/walk-options body shape", () => {
  it.each([["null"], ["[]"], ['"x"'], ["42"], ["true"], ["not json"]])(
    "answers 400, not 500, for the body %s",
    async (raw) => {
      const response = await POST(post(raw));
      expect(response.status).toBe(400);
    },
  );

  it("still 400s an empty object through the field validation", async () => {
    const response = await POST(post("{}"));
    expect(response.status).toBe(400);
  });
});
