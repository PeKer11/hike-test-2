import { describe, expect, it } from "vitest";

import {
  appendExchange,
  clearExchanges,
  getRecentExchanges,
} from "@/lib/history/exchange-store";

type Result = { data: unknown; error: unknown };
type Client = Parameters<typeof getRecentExchanges>[0];

interface ReadCall {
  columns: string;
  filters: { op: string; column: string; value: unknown }[];
  order: { column: string; ascending: boolean } | null;
  limit: number | null;
}

/**
 * A stand-in for the PostgREST builder covering the three shapes this module
 * uses. It records what was asked for so the tests can assert on the query the
 * store actually sends — the row cap and the age cutoff are the feature, and
 * they only exist in that query.
 */
function fakeReadClient(result: Result) {
  const call: ReadCall = {
    columns: "",
    filters: [],
    order: null,
    limit: null,
  };

  const builder = {
    select(columns: string) {
      call.columns = columns;
      return builder;
    },
    eq(column: string, value: unknown) {
      call.filters.push({ op: "eq", column, value });
      return builder;
    },
    gt(column: string, value: unknown) {
      call.filters.push({ op: "gt", column, value });
      return builder;
    },
    order(column: string, options: { ascending: boolean }) {
      call.order = { column, ascending: options.ascending };
      return builder;
    },
    async limit(count: number) {
      call.limit = count;
      return result;
    },
  };

  return {
    client: { from: () => builder } as unknown as Client,
    call,
  };
}

function fakeWriteClient(result: Result) {
  const inserted: unknown[] = [];
  const deleteFilters: { column: string; value: unknown }[] = [];

  const builder = {
    async insert(row: unknown) {
      inserted.push(row);
      return result;
    },
    delete() {
      return {
        async eq(column: string, value: unknown) {
          deleteFilters.push({ column, value });
          return result;
        },
      };
    },
  };

  return {
    client: { from: () => builder } as unknown as Client,
    inserted,
    deleteFilters,
  };
}

/** A client whose very first call throws — Supabase not configured at all. */
const explodingClient = {
  from() {
    throw new Error("Supabase is not configured.");
  },
} as unknown as Client;

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "row-1",
    turn: "prompt",
    prompt_text: "A walk in Zichron Yaakov",
    response_summary: "Found 2 stops",
    created_at: "2026-08-10T10:00:00.000Z",
    ...overrides,
  };
}

describe("appendExchange", () => {
  it("writes the turn, the prompt and the summary for the given user", async () => {
    const { client, inserted } = fakeWriteClient({ data: null, error: null });

    const written = await appendExchange(client, "user-1", {
      turn: "chip",
      prompt: "A walk in Jaffa — Food",
      responseSummary: "Found 3 stops",
    });

    expect(written).toBe(true);
    expect(inserted).toEqual([
      {
        user_id: "user-1",
        turn: "chip",
        prompt_text: "A walk in Jaffa — Food",
        response_summary: "Found 3 stops",
      },
    ]);
  });

  // The table's char_length checks would reject the row outright, and losing
  // the whole entry is worse than losing the tail of a sentence.
  it("clamps a prompt longer than the column allows instead of losing the row", async () => {
    const { client, inserted } = fakeWriteClient({ data: null, error: null });

    await appendExchange(client, "user-1", {
      turn: "prompt",
      prompt: "x".repeat(600),
      responseSummary: "y".repeat(300),
    });

    const written = inserted[0] as { prompt_text: string; response_summary: string };
    expect(written.prompt_text).toHaveLength(500);
    expect(written.response_summary).toHaveLength(200);
  });

  it.each([
    ["an empty prompt", { prompt: "   ", responseSummary: "Found 2 stops" }],
    ["an empty summary", { prompt: "A walk", responseSummary: "" }],
  ])("writes nothing for %s", async (_label, overrides) => {
    const { client, inserted } = fakeWriteClient({ data: null, error: null });

    const written = await appendExchange(client, "user-1", {
      turn: "prompt",
      ...overrides,
    });

    expect(written).toBe(false);
    expect(inserted).toEqual([]);
  });

  it("refuses a turn the exchange_turn enum does not have", async () => {
    const { client, inserted } = fakeWriteClient({ data: null, error: null });

    const written = await appendExchange(client, "user-1", {
      turn: "followUp" as "follow_up",
      prompt: "A walk",
      responseSummary: "Found 2 stops",
    });

    expect(written).toBe(false);
    expect(inserted).toEqual([]);
  });

  it.each([
    ["a rejected write", { data: null, error: new Error("rls") }],
  ])("reports %s as not written rather than throwing", async (_label, result) => {
    const { client } = fakeWriteClient(result);

    expect(
      await appendExchange(client, "user-1", {
        turn: "prompt",
        prompt: "A walk",
        responseSummary: "Found 2 stops",
      }),
    ).toBe(false);
  });

  it("swallows a client that cannot be built at all", async () => {
    expect(
      await appendExchange(explodingClient, "user-1", {
        turn: "prompt",
        prompt: "A walk",
        responseSummary: "Found 2 stops",
      }),
    ).toBe(false);
  });
});

describe("getRecentExchanges", () => {
  it("returns the stored rows oldest first, the order the log reads in", async () => {
    const { client } = fakeReadClient({
      data: [
        row({ id: "newest", created_at: "2026-08-10T12:00:00.000Z" }),
        row({ id: "middle", created_at: "2026-08-10T11:00:00.000Z" }),
        row({ id: "oldest", created_at: "2026-08-10T10:00:00.000Z" }),
      ],
      error: null,
    });

    const exchanges = await getRecentExchanges(client, "user-1");

    expect(exchanges.map((entry) => entry.id)).toEqual([
      "oldest",
      "middle",
      "newest",
    ]);
  });

  it("maps a row onto the shape the panel renders", async () => {
    const { client } = fakeReadClient({
      data: [
        row({
          id: "row-9",
          turn: "follow_up",
          prompt_text: "3 hours, up to 1km",
          response_summary: "Built a walk through 2 stops",
          created_at: "2026-08-10T10:00:00.000Z",
        }),
      ],
      error: null,
    });

    expect(await getRecentExchanges(client, "user-1")).toEqual([
      {
        id: "row-9",
        turn: "follow_up",
        prompt: "3 hours, up to 1km",
        responseSummary: "Built a walk through 2 stops",
        timestamp: Date.parse("2026-08-10T10:00:00.000Z"),
      },
    ]);
  });

  // The cap is the whole point of the feature. The trim trigger enforces it on
  // write; this is the read-side half, and it is what keeps the window bounded
  // if the trigger is ever missing.
  it("asks for at most the window's worth of rows, newest first", async () => {
    const { client, call } = fakeReadClient({ data: [], error: null });

    await getRecentExchanges(client, "user-1");

    expect(call.limit).toBe(5);
    expect(call.order).toEqual({ column: "created_at", ascending: false });
  });

  it("filters out anything older than thirty days", async () => {
    const { client, call } = fakeReadClient({ data: [], error: null });

    await getRecentExchanges(client, "user-1", new Date("2026-08-12T09:00:00.000Z"));

    expect(call.filters).toContainEqual({
      op: "gt",
      column: "created_at",
      value: "2026-07-13T09:00:00.000Z",
    });
  });

  it("scopes the read to the given user", async () => {
    const { client, call } = fakeReadClient({ data: [], error: null });

    await getRecentExchanges(client, "user-7");

    expect(call.filters).toContainEqual({
      op: "eq",
      column: "user_id",
      value: "user-7",
    });
  });

  it("never selects a column the design says is not stored", async () => {
    const { client, call } = fakeReadClient({ data: [], error: null });

    await getRecentExchanges(client, "user-1");

    expect(call.columns).not.toMatch(/lat|lng|coordinates|attractions/);
  });

  it.each([
    ["a failed read", { data: null, error: new Error("boom") }],
    ["no rows", { data: [], error: null }],
    ["a non-array payload", { data: { id: "row-1" }, error: null }],
  ])("returns an empty log for %s", async (_label, result) => {
    const { client } = fakeReadClient(result);

    expect(await getRecentExchanges(client, "user-1")).toEqual([]);
  });

  it.each([
    ["an unknown turn", { turn: "shout" }],
    ["a missing prompt", { prompt_text: null }],
    ["a missing summary", { response_summary: 42 }],
    ["an unparseable timestamp", { created_at: "not a date" }],
    ["a missing id", { id: null }],
  ])("drops a row with %s and keeps the rest", async (_label, overrides) => {
    const { client } = fakeReadClient({
      data: [row(overrides), row({ id: "good" })],
      error: null,
    });

    const exchanges = await getRecentExchanges(client, "user-1");

    expect(exchanges.map((entry) => entry.id)).toEqual(["good"]);
  });

  it("swallows a client that cannot be built at all", async () => {
    expect(await getRecentExchanges(explodingClient, "user-1")).toEqual([]);
  });
});

describe("clearExchanges", () => {
  it("deletes only the given user's rows", async () => {
    const { client, deleteFilters } = fakeWriteClient({
      data: null,
      error: null,
    });

    expect(await clearExchanges(client, "user-3")).toBe(true);
    expect(deleteFilters).toEqual([{ column: "user_id", value: "user-3" }]);
  });

  it("reports a failed delete rather than throwing", async () => {
    const { client } = fakeWriteClient({ data: null, error: new Error("rls") });

    expect(await clearExchanges(client, "user-3")).toBe(false);
  });

  it("swallows a client that cannot be built at all", async () => {
    expect(await clearExchanges(explodingClient, "user-1")).toBe(false);
  });
});
