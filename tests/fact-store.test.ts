import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExtractStandingFacts = vi.fn();

// The one real external boundary on this path. Everything else — the scorer,
// the dedupe key, the contradiction match — is the project's own code and runs
// for real.
vi.mock("@/lib/api/gemini-client", () => ({
  extractStandingFacts: (...args: unknown[]) => mockExtractStandingFacts(...args),
}));

import { MAX_STANDING_FACTS } from "@/lib/preferences/fact-extractor";
import {
  deleteFact,
  getStandingFacts,
  learnFactsFromText,
  restoreSupersededFact,
} from "@/lib/preferences/fact-store";

type Row = Record<string, unknown>;
type Client = Parameters<typeof getStandingFacts>[0];

const NOW = new Date("2026-08-12T09:00:00.000Z");

let nextId = 0;

/**
 * A small in-memory stand-in for the `standing_facts` table, honouring the
 * filters and the unique-ish semantics the store actually relies on.
 *
 * A fake rather than a mock on purpose: the interesting behaviour here is which
 * rows end up in the table after a sentence is read, and a mock that only
 * records calls would pass just as happily with the upsert branch inverted.
 */
function fakeFactsTable(
  initial: Row[] = [],
  reject: { insert?: boolean; update?: boolean; delete?: boolean } = {},
) {
  const rows: Row[] = initial.map((row) => ({ ...row }));

  function builder() {
    const filters: { column: string; value: unknown }[] = [];
    let mode: "select" | "update" | "delete" | "insert" = "select";
    let payload: Row = {};

    const matching = () =>
      rows.filter((row) =>
        filters.every((filter) => row[filter.column] === filter.value),
      );

    const run = () => {
      if (mode === "update") {
        if (reject.update) return { data: null, error: new Error("update") };
        for (const row of matching()) Object.assign(row, payload);
        return { data: null, error: null };
      }

      if (mode === "delete") {
        if (reject.delete) return { data: null, error: new Error("delete") };

        const toDelete = matching();
        const deletedIds = new Set(toDelete.map((row) => row.id));

        // Mirrors the real migration's `on delete set null` on
        // `superseded_by`, and its `standing_facts_supersede_shape` check —
        // both fire as part of the same delete statement. Simulated on a copy
        // first, the same as a real transaction: a row left with
        // `superseded_at` set but `superseded_by` nulled by the cascade fails
        // the same way Postgres fails it, so a store function that deletes
        // the successor before clearing the retired row's own columns is
        // caught here instead of only against the real database.
        const survivors = rows
          .filter((row) => !deletedIds.has(row.id))
          .map((row) => ({ ...row }));
        for (const row of survivors) {
          if (deletedIds.has(row.superseded_by)) {
            row.superseded_by = null;
          }
        }
        // Loose nullish checks on purpose: `storedRow()` fixtures leave
        // `superseded_by` as `undefined` rather than explicitly `null`, the
        // same as a row Postgres returns before either column is ever set.
        const violated = survivors.some(
          (row) => (row.superseded_at == null) !== (row.superseded_by == null),
        );
        if (violated) {
          return {
            data: null,
            error: Object.assign(
              new Error(
                'new row for relation "standing_facts" violates check constraint "standing_facts_supersede_shape"',
              ),
              { code: "23514" },
            ),
          };
        }

        rows.length = 0;
        rows.push(...survivors);
        return { data: null, error: null };
      }

      if (mode === "insert") {
        if (reject.insert) return { data: null, error: new Error("insert") };

        // Mirrors `standing_facts_user_key`: unique on (user_id, fact_key)
        // only among active rows, since 2026-08-20. A superseded row is
        // history, not a reservation — it must not block a walker re-stating
        // the same fact after reversing it. Checked before the row exists so
        // a fact colliding only with itself never trips this.
        const collides = rows.some(
          (row) =>
            row.user_id === payload.user_id &&
            row.fact_key === payload.fact_key &&
            (row.superseded_at ?? null) === null,
        );
        if (collides) {
          return {
            data: null,
            error: Object.assign(
              new Error(
                'duplicate key value violates unique constraint "standing_facts_user_key"',
              ),
              { code: "23505" },
            ),
          };
        }

        // The column defaults the same way the migration does, so an inserted
        // row reads back as active rather than as undefined.
        const row = {
          id: `generated-${nextId++}`,
          superseded_at: null,
          superseded_by: null,
          ...payload,
        };
        rows.push(row);
        return { data: { id: row.id }, error: null };
      }

      return { data: matching(), error: null };
    };

    const chain = {
      select(_columns?: string) {
        return chain;
      },
      insert(values: Row) {
        mode = "insert";
        payload = values;
        return chain;
      },
      update(values: Row) {
        mode = "update";
        payload = values;
        return chain;
      },
      delete() {
        mode = "delete";
        return chain;
      },
      eq(column: string, value: unknown) {
        filters.push({ column, value });
        return chain;
      },
      is(column: string, value: unknown) {
        filters.push({ column, value: value ?? null });
        return chain;
      },
      async maybeSingle() {
        return run();
      },
      then(resolve: (value: unknown) => unknown) {
        return Promise.resolve(run()).then(resolve);
      },
    };

    return chain;
  }

  return {
    client: { from: () => builder() } as unknown as Client,
    rows,
  };
}

function storedRow(overrides: Row = {}): Row {
  return {
    id: "fact-meat",
    user_id: "user-1",
    fact_text: "does not eat meat",
    fact_key: "does not eat meat",
    importance: 3,
    occurrence_count: 1,
    last_seen_at: "2026-08-01T09:00:00.000Z",
    superseded_at: null,
    ...overrides,
  };
}

function extracted(overrides: Row = {}): Row {
  return {
    text: "always walks with a dog",
    importance: 2,
    replaces: null,
    ...overrides,
  };
}

/** Rows the walker is currently on record as saying. */
const active = (rows: Row[]) => rows.filter((row) => !row.superseded_at);

beforeEach(() => {
  nextId = 0;
  mockExtractStandingFacts.mockReset();
  mockExtractStandingFacts.mockResolvedValue([]);
});

describe("getStandingFacts", () => {
  it("returns the walker's active facts in the shape the scorer reads", async () => {
    const { client } = fakeFactsTable([storedRow()]);

    expect(await getStandingFacts(client, "user-1")).toEqual([
      {
        id: "fact-meat",
        text: "does not eat meat",
        key: "does not eat meat",
        importance: 3,
        occurrenceCount: 1,
        lastSeenAt: Date.parse("2026-08-01T09:00:00.000Z"),
      },
    ]);
  });

  // A superseded row exists only so a contradiction can be undone. Letting it
  // reach a walk is the bug the column exists to prevent.
  it("leaves out a fact the walker has since reversed", async () => {
    const { client } = fakeFactsTable([
      storedRow(),
      storedRow({
        id: "fact-old",
        fact_text: "eats no fish",
        fact_key: "eats no fish",
        superseded_at: "2026-08-05T09:00:00.000Z",
      }),
    ]);

    const facts = await getStandingFacts(client, "user-1");

    expect(facts.map((fact) => fact.id)).toEqual(["fact-meat"]);
  });

  it("scopes the read to the given walker", async () => {
    const { client } = fakeFactsTable([
      storedRow(),
      storedRow({ id: "someone-else", user_id: "user-2" }),
    ]);

    const facts = await getStandingFacts(client, "user-1");

    expect(facts.map((fact) => fact.id)).toEqual(["fact-meat"]);
  });

  // PostgREST can hand a numeric back as a string, and a row predating a column
  // reads as null. Neither is a reason to lose the fact.
  it("reads a count that arrived as a string, and fills in a missing one", async () => {
    const { client } = fakeFactsTable([
      storedRow({ occurrence_count: "4" }),
      storedRow({
        id: "fact-dog",
        fact_text: "walks with a dog",
        fact_key: "walks with a dog",
        occurrence_count: null,
      }),
    ]);

    const facts = await getStandingFacts(client, "user-1");

    expect(facts[0].occurrenceCount).toBe(4);
    expect(facts[1].occurrenceCount).toBe(1);
  });

  it("derives the dedupe key from the text when the stored one is missing", async () => {
    const { client } = fakeFactsTable([
      storedRow({ fact_text: "Does not eat MEAT!", fact_key: null }),
    ]);

    expect((await getStandingFacts(client, "user-1"))[0].key).toBe(
      "does not eat meat",
    );
  });

  it("returns nothing for a walker with no facts", async () => {
    const { client } = fakeFactsTable([]);

    expect(await getStandingFacts(client, "user-1")).toEqual([]);
  });
});

describe("learnFactsFromText", () => {
  it("stores a fact the walker has never stated before", async () => {
    mockExtractStandingFacts.mockResolvedValue([extracted()]);
    const { client, rows } = fakeFactsTable([]);

    const result = await learnFactsFromText(client, "user-1", "I walk my dog", NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "user-1",
      fact_text: "always walks with a dog",
      fact_key: "always walks with a dog",
      importance: 2,
    });
    expect(result.facts.map((fact) => fact.text)).toEqual([
      "always walks with a dog",
    ]);
  });

  // The key is what the unique index dedupes on. Storing the raw text there
  // means the next rewording of the same fact inserts a second row instead of
  // counting the first.
  it("stores the normalized key, not the phrasing the model used", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "Always walks with a Dog!" }),
    ]);
    const { client, rows } = fakeFactsTable([]);

    await learnFactsFromText(client, "user-1", "…", NOW);

    expect(rows[0].fact_text).toBe("Always walks with a Dog!");
    expect(rows[0].fact_key).toBe("always walks with a dog");
  });

  it("counts a reworded repeat against the row the first phrasing created", async () => {
    mockExtractStandingFacts
      .mockResolvedValueOnce([extracted({ text: "Always walks with a Dog!" })])
      .mockResolvedValueOnce([extracted({ text: "always walks with a dog" })]);
    const { client, rows } = fakeFactsTable([]);

    await learnFactsFromText(client, "user-1", "…", NOW);
    await learnFactsFromText(client, "user-1", "…", NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0].occurrence_count).toBe(2);
  });

  // Repetition is the accumulated-evidence term the scorer multiplies by; a
  // second row for the same fact would split that evidence in half instead.
  it("counts a repeat statement instead of storing it twice", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "Does not eat meat.", importance: 1 }),
    ]);
    const { client, rows } = fakeFactsTable([storedRow({ occurrence_count: 2 })]);

    await learnFactsFromText(client, "user-1", "no meat for me", NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0].occurrence_count).toBe(3);
    expect(rows[0].last_seen_at).toBe(NOW.toISOString());
  });

  // Churning the displayed text every time the model rewords the same fact
  // makes the walker's own list look unstable.
  it("keeps the first phrasing when the same fact comes back reworded", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "Does not eat meat.", importance: 1 }),
    ]);
    const { client, rows } = fakeFactsTable([storedRow()]);

    await learnFactsFromText(client, "user-1", "no meat for me", NOW);

    expect(rows[0].fact_text).toBe("does not eat meat");
  });

  it("takes the stronger reading of importance on a repeat", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "walks with a dog", importance: 3 }),
    ]);
    const { client, rows } = fakeFactsTable([
      storedRow({
        id: "fact-dog",
        fact_text: "walks with a dog",
        fact_key: "walks with a dog",
        importance: 1,
      }),
    ]);

    await learnFactsFromText(client, "user-1", "my dog needs the walk", NOW);

    expect(rows[0].importance).toBe(3);
  });

  it("does not weaken a stored importance", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "does not eat meat", importance: 1 }),
    ]);
    const { client, rows } = fakeFactsTable([storedRow({ importance: 3 })]);

    await learnFactsFromText(client, "user-1", "no meat", NOW);

    expect(rows[0].importance).toBe(3);
  });

  it("hands the model what the walker is already on record as saying", async () => {
    const { client } = fakeFactsTable([storedRow()]);

    await learnFactsFromText(client, "user-1", "a walk in Jaffa", NOW);

    const [, known] = mockExtractStandingFacts.mock.calls[0];
    expect(known).toEqual([
      expect.objectContaining({ text: "does not eat meat" }),
    ]);
  });

  it("writes nothing when the text contains no fact, which is the normal case", async () => {
    mockExtractStandingFacts.mockResolvedValue([]);
    const { client, rows } = fakeFactsTable([]);

    const result = await learnFactsFromText(client, "user-1", "2 hours in Jaffa", NOW);

    expect(rows).toEqual([]);
    expect(result.contradictions).toEqual([]);
  });

  it("reads nothing out of empty text without calling the model", async () => {
    const { client } = fakeFactsTable([]);

    await learnFactsFromText(client, "user-1", "   ", NOW);

    expect(mockExtractStandingFacts).not.toHaveBeenCalled();
  });

  // Learning is a side effect of a request the walker made for something else.
  it.each([
    ["the model call fails", () => mockExtractStandingFacts.mockRejectedValue(new Error("429"))],
    ["the model returns nonsense", () => mockExtractStandingFacts.mockResolvedValue("not a list")],
  ])("costs the fact and not the request when %s", async (_label, arrange) => {
    arrange();
    const { client } = fakeFactsTable([]);

    await expect(
      learnFactsFromText(client, "user-1", "I walk my dog", NOW),
    ).resolves.toEqual({ facts: [], contradictions: [] });
  });

  it("keeps going when one fact of several fails to write", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "always walks with a dog" }),
      extracted({ text: "cannot manage stairs", importance: 3 }),
    ]);
    const { client, rows } = fakeFactsTable([], { insert: true });

    const result = await learnFactsFromText(client, "user-1", "…", NOW);

    expect(rows).toEqual([]);
    expect(result.facts).toEqual([]);
  });
});

// Ariel's call, layered: the newest statement wins immediately and the walker
// is handed the reversal to undo. Saying nothing leaves the new fact standing.
describe("learnFactsFromText — contradictions", () => {
  it("retires the fact a new statement reverses", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "eats meat", importance: 3, replaces: "does not eat meat" }),
    ]);
    const { client, rows } = fakeFactsTable([storedRow()]);

    const result = await learnFactsFromText(client, "user-1", "I eat meat again", NOW);

    const retired = rows.find((row) => row.id === "fact-meat");
    expect(retired?.superseded_at).toBe(NOW.toISOString());
    expect(retired?.superseded_by).toBe(result.contradictions[0].newFactId);
  });

  it("reports the contradiction so the walker can be offered the undo", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "eats meat", importance: 3, replaces: "does not eat meat" }),
    ]);
    const { client } = fakeFactsTable([storedRow()]);

    const result = await learnFactsFromText(client, "user-1", "I eat meat again", NOW);

    expect(result.contradictions).toEqual([
      {
        supersededFactId: "fact-meat",
        supersededText: "does not eat meat",
        newFactId: expect.any(String),
        newText: "eats meat",
      },
    ]);
  });

  // The keep-latest fallback: nothing waits on an answer, so the walk planned
  // moments later already reads the new fact and not the reversed one.
  it("leaves only the newest statement standing", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "eats meat", importance: 3, replaces: "does not eat meat" }),
    ]);
    const { client } = fakeFactsTable([storedRow()]);

    const result = await learnFactsFromText(client, "user-1", "I eat meat again", NOW);

    expect(result.facts.map((fact) => fact.text)).toEqual(["eats meat"]);
  });

  it("retires nothing when the reversal names a fact that is not on record", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "eats meat", importance: 3, replaces: "hates the sea" }),
    ]);
    const { client, rows } = fakeFactsTable([storedRow()]);

    const result = await learnFactsFromText(client, "user-1", "…", NOW);

    expect(active(rows)).toHaveLength(2);
    expect(result.contradictions).toEqual([]);
  });

  it("retires nothing for an ordinary new fact", async () => {
    mockExtractStandingFacts.mockResolvedValue([extracted()]);
    const { client, rows } = fakeFactsTable([storedRow()]);

    const result = await learnFactsFromText(client, "user-1", "…", NOW);

    expect(rows.every((row) => row.superseded_at === null)).toBe(true);
    expect(result.contradictions).toEqual([]);
  });

  // Otherwise a sentence stating two related facts could retire the first one
  // it just wrote, on the strength of its own second clause.
  it("cannot retire a fact the same sentence just created", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "walks alone", importance: 1 }),
      extracted({ text: "walks with friends", importance: 1, replaces: "walks alone" }),
    ]);
    const { client } = fakeFactsTable([]);

    const result = await learnFactsFromText(client, "user-1", "…", NOW);

    expect(result.contradictions).toEqual([]);
    expect(result.facts).toHaveLength(2);
  });

  it("does not report a contradiction it failed to write", async () => {
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "eats meat", importance: 3, replaces: "does not eat meat" }),
    ]);
    const { client } = fakeFactsTable([storedRow()], { update: true });

    const result = await learnFactsFromText(client, "user-1", "…", NOW);

    expect(result.contradictions).toEqual([]);
  });

  // Found live 2026-08-20: a third statement reversing a reversal wrote
  // nothing at all, because the key was still held by the first, now-retired
  // row. Fixed by making `standing_facts_user_key` unique only among active
  // rows (migration `20260820090000_standing_facts_partial_key.sql`) — this
  // is the fake's model of that index, exercised across three real turns
  // rather than three rows handed in as a fixture.
  it("lets a walker re-state a fact after reversing it", async () => {
    const { client, rows } = fakeFactsTable([storedRow()]);

    mockExtractStandingFacts.mockResolvedValueOnce([
      extracted({ text: "eats meat", importance: 3, replaces: "does not eat meat" }),
    ]);
    await learnFactsFromText(client, "user-1", "I eat meat again", NOW);

    const later = new Date(NOW.getTime() + 60_000);
    mockExtractStandingFacts.mockResolvedValueOnce([
      extracted({ text: "does not eat meat", importance: 3, replaces: "eats meat" }),
    ]);
    const result = await learnFactsFromText(
      client,
      "user-1",
      "actually I don't eat meat",
      later,
    );

    expect(result.facts.map((fact) => fact.text)).toEqual(["does not eat meat"]);
    expect(active(rows)).toHaveLength(1);
    // A fresh row, not the original come back to life: same key, different id.
    expect(active(rows)[0].fact_text).toBe("does not eat meat");
    expect(active(rows)[0].id).not.toBe("fact-meat");
  });
});

describe("learnFactsFromText — the cap", () => {
  function manyFacts(count: number): Row[] {
    return Array.from({ length: count }, (_unused, index) =>
      storedRow({
        id: `fact-${index}`,
        fact_text: `fact number ${index}`,
        fact_key: `fact number ${index}`,
        importance: 3,
        // The last one is both the oldest and the weakest.
        last_seen_at:
          index === count - 1
            ? "2024-01-01T00:00:00.000Z"
            : "2026-08-11T09:00:00.000Z",
      }),
    );
  }

  it("drops the weakest fact rather than growing past the cap", async () => {
    const existing = manyFacts(MAX_STANDING_FACTS);
    const weakestId = existing[existing.length - 1].id;
    mockExtractStandingFacts.mockResolvedValue([
      extracted({ text: "always walks with a dog", importance: 3 }),
    ]);
    const { client, rows } = fakeFactsTable(existing);

    const result = await learnFactsFromText(client, "user-1", "…", NOW);

    expect(active(rows)).toHaveLength(MAX_STANDING_FACTS);
    expect(rows.some((row) => row.id === weakestId)).toBe(false);
    expect(result.facts.map((fact) => fact.text)).toContain(
      "always walks with a dog",
    );
  });

  it("evicts nothing while the walker is under the cap", async () => {
    mockExtractStandingFacts.mockResolvedValue([extracted()]);
    const { client, rows } = fakeFactsTable(manyFacts(3));

    await learnFactsFromText(client, "user-1", "…", NOW);

    expect(rows).toHaveLength(4);
  });
});

describe("deleteFact", () => {
  it("forgets one fact by the walker's own hand", async () => {
    const { client, rows } = fakeFactsTable([storedRow()]);

    expect(await deleteFact(client, "user-1", "fact-meat")).toBe(true);
    expect(rows).toEqual([]);
  });

  it("cannot delete another walker's fact", async () => {
    const { client, rows } = fakeFactsTable([
      storedRow({ id: "theirs", user_id: "user-2" }),
    ]);

    await deleteFact(client, "user-1", "theirs");

    expect(rows).toHaveLength(1);
  });

  it("reports a rejected delete rather than throwing", async () => {
    const { client } = fakeFactsTable([storedRow()], { delete: true });

    expect(await deleteFact(client, "user-1", "fact-meat")).toBe(false);
  });
});

describe("restoreSupersededFact", () => {
  const RETIRED = storedRow({
    superseded_at: "2026-08-12T09:00:00.000Z",
    superseded_by: "fact-new",
  });
  const SUCCESSOR = storedRow({
    id: "fact-new",
    fact_text: "eats meat",
    fact_key: "eats meat",
  });

  it("puts the retired fact back and drops the one that replaced it", async () => {
    const { client, rows } = fakeFactsTable([RETIRED, SUCCESSOR]);

    expect(
      await restoreSupersededFact(client, "user-1", "fact-meat", "fact-new"),
    ).toBe(true);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: "fact-meat",
      superseded_at: null,
      superseded_by: null,
    });
  });

  it("does not touch either row when the retired fact cannot be un-superseded", async () => {
    const { client, rows } = fakeFactsTable([RETIRED, SUCCESSOR], {
      update: true,
    });

    expect(
      await restoreSupersededFact(client, "user-1", "fact-meat", "fact-new"),
    ).toBe(false);
    expect(rows.find((row) => row.id === "fact-meat")?.superseded_at).toBe(
      "2026-08-12T09:00:00.000Z",
    );
    expect(rows.find((row) => row.id === "fact-new")).toBeDefined();
  });

  it("still un-supersedes the retired fact when the successor cannot then be deleted", async () => {
    // The two writes are separate round-trips, not one transaction — a walker
    // who hits this gets their fact back with the successor still on record
    // rather than the restore appearing to do nothing, which is the failure
    // this whole fix replaced. Rare in practice: the delete that follows a
    // just-succeeded update almost never fails.
    const { client, rows } = fakeFactsTable([RETIRED, SUCCESSOR], {
      delete: true,
    });

    expect(
      await restoreSupersededFact(client, "user-1", "fact-meat", "fact-new"),
    ).toBe(false);
    expect(
      rows.find((row) => row.id === "fact-meat")?.superseded_at,
    ).toBeNull();
    expect(rows.find((row) => row.id === "fact-new")).toBeDefined();
  });
});
