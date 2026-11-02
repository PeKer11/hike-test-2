import { describe, expect, it } from "vitest";

import { recognitionLang, textLang } from "@/lib/speech/recognition";

describe("speech language choice", () => {
  it("dictates Hebrew when Hebrew was typed or the browser is Hebrew", () => {
    expect(recognitionLang("שלום", "en-US")).toBe("he");
    expect(recognitionLang("", "he-IL")).toBe("he");
    expect(recognitionLang("", "iw")).toBe("he");
  });
  it("dictates English otherwise", () => {
    expect(recognitionLang("a cafe", "en-US")).toBe("en");
  });
  it("reads a reply in the language it is written in", () => {
    expect(textLang("הנה מסלול")).toBe("he");
    expect(textLang("Here is a route")).toBe("en");
  });
});
