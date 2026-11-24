import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const search = vi.fn();
vi.mock("@/lib/api/google-places-client", () => ({
  searchTextPlaces: (...a: unknown[]) => search(...a),
  searchNearbyPlaces: vi.fn(async () => []),
}));

import { runWalkTurn } from "@/lib/assistant/walk-turn";

const choice = { provider: "openai", model: "gpt-6.1-sol" } as const;
const place = (name: string, i: number) => ({ name, coordinates: { lat: 32 + i / 1000, lng: 34 } });
const tc = (id: string, name: string, args: object) => ({ id, type: "function" as const, function: { name, arguments: JSON.stringify(args) } });

describe("find_places ids", () => {
  it("a second search never overwrites the ids of the first", async () => {
    search
      .mockResolvedValueOnce([place("Mitzpe Erez", 1), place("Han Zeruniya", 2)])
      .mockResolvedValueOnce([place("Gan Simta", 3), place("Ya'ar Nadiv", 4)]);
    let n = 0;
    const ids = (msgs: Array<{ role: string; content: string | null }>) =>
      msgs.filter((m) => m.role === "tool").map((m) => (JSON.parse(m.content ?? "[]") as Array<{ id: string }>)[0]?.id);
    const call = vi.fn(async (req: { messages: Array<{ role: string; content: string | null }> }) => {
      n += 1;
      if (n === 1) return { content: null, inTok: 1, outTok: 1, toolCalls: [tc("a", "find_places", { query: "one" })] };
      if (n === 2) return { content: null, inTok: 1, outTok: 1, toolCalls: [tc("b", "find_places", { query: "two" })] };
      if (n === 3) {
        const [first] = ids(req.messages);
        // the first id of search 1, and the second place of search 1 (ids are opaque: read them from the output)
        const second = (JSON.parse(req.messages.filter((m) => m.role === "tool")[0].content ?? "[]") as Array<{ id: string }>)[1].id;
        return { content: null, inTok: 1, outTok: 1, toolCalls: [tc("c", "propose_add_stop", { place_id: first }), tc("d", "propose_add_stop", { place_id: second })] };
      }
      return { content: "ok", toolCalls: [], inTok: 1, outTok: 1 };
    });
    const r = await runWalkTurn(
      { history: [{ role: "user", content: "add two" }], position: { lat: 32, lng: 34 }, stops: ["A"], choice },
      call as never,
    );
    expect(r.actions.map((a) => (a.kind === "add-place" ? a.name : a.kind))).toEqual(["Mitzpe Erez", "Han Zeruniya"]);
  });
});
