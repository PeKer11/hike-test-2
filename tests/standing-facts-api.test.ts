import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockCreateClient = vi.fn();
const mockGetStandingFacts = vi.fn();
const mockDeleteFact = vi.fn();
const mockRestoreSupersededFact = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

vi.mock("@/lib/preferences/fact-store", () => ({
  getStandingFacts: (...args: unknown[]) => mockGetStandingFacts(...args),
  deleteFact: (...args: unknown[]) => mockDeleteFact(...args),
  restoreSupersededFact: (...args: unknown[]) =>
    mockRestoreSupersededFact(...args),
}));

import { DELETE, GET, POST } from "@/app/api/standing-facts/route";

const SIGNED_IN = { data: { user: { id: "user-1" } } };
const SIGNED_OUT = { data: { user: null } };

function fact(overrides: Record<string, unknown> = {}) {
  return {
    id: "fact-meat",
    text: "does not eat meat",
    key: "does not eat meat",
    importance: 3,
    occurrenceCount: 1,
    lastSeenAt: 1_770_000_000_000,
    ...overrides,
  };
}

function deleteRequest(query: string): Request {
  return new Request(`http://localhost/api/standing-facts${query}`, {
    method: "DELETE",
  });
}

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/standing-facts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue(SIGNED_IN);
  mockCreateClient.mockReset();
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } });
  mockGetStandingFacts.mockReset();
  mockGetStandingFacts.mockResolvedValue([]);
  mockDeleteFact.mockReset();
  mockDeleteFact.mockResolvedValue(true);
  mockRestoreSupersededFact.mockReset();
  mockRestoreSupersededFact.mockResolvedValue(true);
});

describe("GET /api/standing-facts", () => {
  it("returns what the app remembers, most recently heard first", async () => {
    mockGetStandingFacts.mockResolvedValue([
      fact({ id: "older", lastSeenAt: 1_000 }),
      fact({ id: "newer", lastSeenAt: 2_000 }),
    ]);

    const body = (await (await GET()).json()) as { id: string }[];

    expect(body.map((entry) => entry.id)).toEqual(["newer", "older"]);
  });

  it("returns an empty list for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValue(SIGNED_OUT);

    expect(await (await GET()).json()).toEqual([]);
    expect(mockGetStandingFacts).not.toHaveBeenCalled();
  });

  it("returns an empty list when Supabase is not configured", async () => {
    mockCreateClient.mockRejectedValue(new Error("not configured"));

    expect(await (await GET()).json()).toEqual([]);
  });
});

describe("DELETE /api/standing-facts", () => {
  it("forgets the named fact for the signed-in walker", async () => {
    const response = await DELETE(deleteRequest("?id=fact-meat"));

    expect(response.status).toBe(204);
    expect(mockDeleteFact).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "fact-meat",
    );
  });

  it("refuses a request that names no fact", async () => {
    const response = await DELETE(deleteRequest(""));

    expect(response.status).toBe(400);
    expect(mockDeleteFact).not.toHaveBeenCalled();
  });

  it("forgets nothing for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValue(SIGNED_OUT);

    expect((await DELETE(deleteRequest("?id=fact-meat"))).status).toBe(204);
    expect(mockDeleteFact).not.toHaveBeenCalled();
  });

  // The row survives and keeps going in front of the model on every walk the
  // walker builds. A 204 here would tell the panel it is gone.
  it("answers 500 when the fact could not be deleted", async () => {
    mockDeleteFact.mockResolvedValue(false);

    const response = await DELETE(deleteRequest("?id=fact-meat"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Could not forget that fact.",
    });
  });
});

// The half of the layered answer that needs an explicit yes. Saying nothing is
// already an answer — the newest statement stands — so nothing here runs
// unless the walker asks for it.
describe("POST /api/standing-facts", () => {
  const RESTORE = {
    action: "restore",
    supersededFactId: "fact-meat",
    newFactId: "fact-new",
  };

  it("puts back the fact the walker says we got wrong", async () => {
    const response = await POST(postRequest(RESTORE));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ restored: true });
    expect(mockRestoreSupersededFact).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "fact-meat",
      "fact-new",
    );
  });

  // `{ restored: false }` inside a 200 is how restoreSupersededFact failed on
  // every real call without anyone noticing — the response was success-shaped
  // and the client only looked at whether the fetch resolved.
  it("answers 500 for a restore that did not happen", async () => {
    mockRestoreSupersededFact.mockResolvedValue(false);

    const response = await POST(postRequest(RESTORE));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      restored: false,
      error: "Could not undo that.",
    });
  });

  it.each([
    ["an unknown action", { ...RESTORE, action: "delete-everything" }],
    ["no superseded fact", { action: "restore", newFactId: "fact-new" }],
    ["no replacement fact", { action: "restore", supersededFactId: "fact-meat" }],
    ["nothing at all", {}],
  ])("refuses a request with %s", async (_label, body) => {
    const response = await POST(postRequest(body));

    expect(response.status).toBe(400);
    expect(mockRestoreSupersededFact).not.toHaveBeenCalled();
  });

  // Not a failure: a signed-out walker has no stored facts to restore, so
  // nothing was refused. Kept at 200 on purpose, unlike a write that was tried
  // and rejected.
  it("restores nothing for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValue(SIGNED_OUT);

    const response = await POST(postRequest(RESTORE));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ restored: false });
    expect(mockRestoreSupersededFact).not.toHaveBeenCalled();
  });
});
