import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { getUser, update, eqId } = vi.hoisted(() => ({ getUser: vi.fn(), update: vi.fn(), eqId: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      update: (patch: unknown) => {
        update(patch);
        return { eq: (col: string, id: string) => { eqId(col, id); return Promise.resolve({ error: null }); } };
      },
    }),
  }),
}));

import { POST } from "@/app/api/consent/route";
import { hasLearningConsent } from "@/lib/preferences/consent";

const post = (body: unknown) => POST(new Request("http://x/api/consent", { method: "POST", body: JSON.stringify(body) }));

describe("hasLearningConsent", () => {
  const client = (row: unknown, error: unknown = null) =>
    ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error }) }) }) }) }) as never;

  it("is true only for granted", async () => {
    expect(await hasLearningConsent(client({ learning_consent: "granted" }), "u")).toBe(true);
    expect(await hasLearningConsent(client({ learning_consent: "declined" }), "u")).toBe(false);
    expect(await hasLearningConsent(client({ learning_consent: "unset" }), "u")).toBe(false);
    expect(await hasLearningConsent(client(null), "u")).toBe(false);
  });

  it("counts any failure as no consent", async () => {
    expect(await hasLearningConsent(client({ learning_consent: "granted" }, new Error("down")), "u")).toBe(false);
    expect(await hasLearningConsent({ from: () => { throw new Error("boom"); } } as never, "u")).toBe(false);
  });
});

describe("POST /api/consent", () => {
  it("rejects anything but granted or declined", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect((await post({ consent: "maybe" })).status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("needs a signed-in walker", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await post({ consent: "granted" })).status).toBe(401);
  });

  it("updates only the caller's own profile row", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    expect((await post({ consent: "declined" })).status).toBe(204);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ learning_consent: "declined" }));
    expect(eqId).toHaveBeenCalledWith("id", "u1");
  });
});
