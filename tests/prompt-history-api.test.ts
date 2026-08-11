import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockCreateClient = vi.fn();
const mockAppendExchange = vi.fn();
const mockGetRecentExchanges = vi.fn();
const mockClearExchanges = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// The store is mocked at the Supabase boundary's edge rather than reimplemented:
// its own behaviour is covered in exchange-store.test.ts, and what this file is
// about is which requests reach it at all.
vi.mock("@/lib/history/exchange-store", () => ({
  appendExchange: (...args: unknown[]) => mockAppendExchange(...args),
  getRecentExchanges: (...args: unknown[]) => mockGetRecentExchanges(...args),
  clearExchanges: (...args: unknown[]) => mockClearExchanges(...args),
}));

import { DELETE, GET, POST } from "@/app/api/prompt-history/route";

function postRequest(body: unknown): Request {
  return new Request("http://localhost/api/prompt-history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  turn: "prompt",
  prompt: "A walk in Zichron Yaakov",
  responseSummary: "Found 2 stops",
  persistHistory: true,
};

const SIGNED_IN = { data: { user: { id: "user-1" } } };
const SIGNED_OUT = { data: { user: null } };

beforeEach(() => {
  mockGetUser.mockReset();
  mockGetUser.mockResolvedValue(SIGNED_IN);
  mockCreateClient.mockReset();
  mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } });
  mockAppendExchange.mockReset();
  mockAppendExchange.mockResolvedValue(true);
  mockGetRecentExchanges.mockReset();
  mockGetRecentExchanges.mockResolvedValue([]);
  mockClearExchanges.mockReset();
  mockClearExchanges.mockResolvedValue(true);
});

describe("POST /api/prompt-history", () => {
  it("stores the exchange for the signed-in walker", async () => {
    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(204);
    expect(mockAppendExchange).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      {
        turn: "prompt",
        prompt: "A walk in Zichron Yaakov",
        responseSummary: "Found 2 stops",
      },
    );
  });

  it.each([
    ["persistence turned off", { persistHistory: false }],
    ["no persistence setting sent", { persistHistory: undefined }],
    ["a turn the enum does not have", { turn: "shout" }],
  ])("stores nothing when there is %s", async (_label, overrides) => {
    const response = await POST(postRequest({ ...VALID_BODY, ...overrides }));

    expect(response.status).toBe(204);
    expect(mockAppendExchange).not.toHaveBeenCalled();
  });

  it("stores nothing for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValue(SIGNED_OUT);

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(204);
    expect(mockAppendExchange).not.toHaveBeenCalled();
  });

  it("stores nothing when Supabase is not configured", async () => {
    mockCreateClient.mockRejectedValue(
      new Error("NEXT_PUBLIC_SUPABASE_URL is not configured."),
    );

    const response = await POST(postRequest(VALID_BODY));

    expect(response.status).toBe(204);
    expect(mockAppendExchange).not.toHaveBeenCalled();
  });

  // The panel does not await this call, so a 500 would be invisible to the
  // walker and useless to everyone else.
  it("answers 204 even when the write is rejected", async () => {
    mockAppendExchange.mockResolvedValue(false);

    expect((await POST(postRequest(VALID_BODY))).status).toBe(204);
  });

  it("answers 204 for a body that is not JSON at all", async () => {
    const response = await POST(
      new Request("http://localhost/api/prompt-history", {
        method: "POST",
        body: "not json",
      }),
    );

    expect(response.status).toBe(204);
    expect(mockAppendExchange).not.toHaveBeenCalled();
  });
});

describe("GET /api/prompt-history", () => {
  it("returns the walker's stored exchanges", async () => {
    const stored = [
      {
        id: "row-1",
        turn: "prompt",
        prompt: "A walk in Jaffa",
        responseSummary: "Found 3 stops",
        timestamp: 1_770_000_000_000,
      },
    ];
    mockGetRecentExchanges.mockResolvedValue(stored);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(stored);
    expect(mockGetRecentExchanges).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
  });

  it("returns an empty log for a walker who is not signed in", async () => {
    mockGetUser.mockResolvedValue(SIGNED_OUT);

    const response = await GET();

    expect(await response.json()).toEqual([]);
    expect(mockGetRecentExchanges).not.toHaveBeenCalled();
  });

  it("returns an empty log when Supabase is not configured", async () => {
    mockCreateClient.mockRejectedValue(new Error("not configured"));

    expect(await (await GET()).json()).toEqual([]);
    expect(mockGetRecentExchanges).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/prompt-history", () => {
  it("clears the walker's stored exchanges", async () => {
    const response = await DELETE();

    expect(response.status).toBe(204);
    expect(mockClearExchanges).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
    );
  });

  it("answers 204 without clearing anything when signed out", async () => {
    mockGetUser.mockResolvedValue(SIGNED_OUT);

    expect((await DELETE()).status).toBe(204);
    expect(mockClearExchanges).not.toHaveBeenCalled();
  });

  it("answers 204 when the delete is rejected", async () => {
    mockClearExchanges.mockResolvedValue(false);

    expect((await DELETE()).status).toBe(204);
  });
});
