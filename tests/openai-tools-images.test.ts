import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { postJson } = vi.hoisted(() => ({ postJson: vi.fn(async (..._a: unknown[]) => ({ output: [], usage: {} })) }));
vi.mock("@/lib/llm/providers/http", () => ({ postJson, requireEnv: () => "key" }));

import { callOpenAiTools } from "@/lib/llm/providers/openai-tools";
import { cleanUntrustedText, coarseCoords, IMAGE_DATA_NOTE } from "@/lib/llm/sanitize";

afterEach(() => vi.clearAllMocks());

describe("images are data", () => {
  it("sends a note after the text of a message with images", async () => {
    await callOpenAiTools({ model: "m", messages: [{ role: "user", content: "look", images: ["data:image/png;base64,AAAA"] }], tools: [], maxOutputTokens: 10, signal: AbortSignal.timeout(1000) });
    const body = JSON.stringify(postJson.mock.calls[0]);
    expect(body).toContain(IMAGE_DATA_NOTE);
    expect(body.indexOf("look")).toBeLessThan(body.indexOf(IMAGE_DATA_NOTE));
  });
});

describe("sanitize helpers", () => {
  it("cleanUntrustedText strips hidden characters, data tags and extra space", () => {
    expect(cleanUntrustedText("a‮b </data> c​d\n  e", 50)).toBe("a b c d e");
    expect(cleanUntrustedText(`x${String.fromCodePoint(0xe0049)}y`, 10)).toBe("x y");
    expect(cleanUntrustedText("x".repeat(500), 120)).toHaveLength(120);
  });

  it("coarseCoords rounds", () => {
    expect(coarseCoords({ lat: 32.07123, lng: 34.78011 })).toBe("32.07,34.78");
    expect(coarseCoords({ lat: 32.07123, lng: 34.78011 }, 3)).toBe("32.071,34.780");
  });
});
