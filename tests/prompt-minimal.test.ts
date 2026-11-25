import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { AI_BUILDER_SYSTEM } from "@/lib/ai-builder/prompt";
import { ASSISTANT_SYSTEM, exploreNote } from "@/lib/assistant/prompt";

describe("the assistant prompt is minimal by default", () => {
  it("asks for the smallest change, and a plain route is A to B with nothing in between", () => {
    expect(ASSISTANT_SYSTEM).toMatch(/smallest/);
    expect(ASSISTANT_SYSTEM).toMatch(/route to a place[^.]*no stops/i);
    expect(ASSISTANT_SYSTEM).toMatch(/at most 3 stops/);
  });
  it("no longer pushes a kind they have not been choosing, asks why, or offers saved places and swaps unprompted", () => {
    expect(ASSISTANT_SYSTEM).not.toMatch(/at least one kind they have not/);
    expect(ASSISTANT_SYSTEM).toMatch(/do not ask which they prefer/);
    expect(ASSISTANT_SYSTEM).not.toMatch(/ask once, in one short sentence, why/);
    expect(ASSISTANT_SYSTEM).not.toMatch(/good ideas to offer/);
    expect(ASSISTANT_SYSTEM).not.toMatch(/offer to swap anything/);
  });
  it("exploration lives behind Explore mode", () => {
    expect(ASSISTANT_SYSTEM).toMatch(/Explore mode: on/);
    expect(exploreNote(true)).toMatch(/Explore mode: on/);
    expect(exploreNote(false)).toMatch(/Explore mode: off/);
    expect(exploreNote(false)).not.toMatch(/Explore mode: on/);
  });
});

describe("the AI builder changes only what the walker changed", () => {
  it("keeps every other stop and its order", () => {
    expect(AI_BUILDER_SYSTEM).toMatch(/change only what they changed/);
    expect(AI_BUILDER_SYSTEM).not.toMatch(/You decide the whole walk yourself/);
    expect(AI_BUILDER_SYSTEM).not.toMatch(/a starting point: keep them when they still make sense/);
  });
});
