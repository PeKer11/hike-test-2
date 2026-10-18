import { describe, expect, it, vi } from "vitest";

import { pickVoice, speak, type SynthLike } from "@/lib/walk/tts";

const enVoice = { lang: "en-US" };
const heVoice = { lang: "he_IL" };

function synth(voices: Array<{ lang: string }>) {
  const s = { getVoices: () => voices, speak: vi.fn(), cancel: vi.fn() };
  return s as typeof s & SynthLike;
}
const utter = (t: string) => ({ text: t, lang: "", voice: null as unknown });

describe("pickVoice", () => {
  it("matches Hebrew by he / iw and English by en", () => {
    expect(pickVoice([enVoice, heVoice], "he")).toBe(heVoice);
    expect(pickVoice([{ lang: "iw-IL" }], "he")).toEqual({ lang: "iw-IL" });
    expect(pickVoice([enVoice], "he")).toBeNull();
    expect(pickVoice([heVoice, enVoice], "en")).toBe(enVoice);
  });
});

describe("speak", () => {
  it("does nothing when the walker has not opted in (default off)", () => {
    const s = synth([enVoice]);
    expect(speak("hi", "en", false, s, utter)).toBe(false);
    expect(s.speak).not.toHaveBeenCalled();
  });
  it("speaks an English question with an English voice", () => {
    const s = synth([enVoice]);
    expect(speak("Water ahead?", "en", true, s, utter)).toBe(true);
    expect(s.cancel).toHaveBeenCalled();
    expect(s.speak).toHaveBeenCalledWith(expect.objectContaining({ lang: "en-US", voice: enVoice }));
  });
  it("speaks Hebrew only with a Hebrew voice", () => {
    expect(speak("מים?", "he", true, synth([enVoice]), utter)).toBe(false);
    const s = synth([enVoice, heVoice]);
    expect(speak("מים?", "he", true, s, utter)).toBe(true);
    expect(s.speak).toHaveBeenCalledWith(expect.objectContaining({ lang: "he-IL", voice: heVoice }));
  });
  it("is silent without speech support or text", () => {
    expect(speak("x", "en", true, null, utter)).toBe(false);
    expect(speak("  ", "en", true, synth([enVoice]), utter)).toBe(false);
  });
});
