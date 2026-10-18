import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConsentGate } from "@/components/onboarding/ConsentGate";
import { useWalkSettings } from "@/lib/hooks/useWalkSettings";

let store: Record<string, string> = {};
beforeEach(() => {
  store = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        store = {};
      },
    },
  });
});
afterEach(cleanup);

describe("learning consent + language settings", () => {
  it("defaults to unset consent, learning off, auto language", () => {
    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.learningConsent).toBe("unset");
    expect(result.current.settings.preferenceLearningEnabled).toBe(false);
    expect(result.current.settings.uiLanguage).toBe("auto");
    expect(result.current.loaded).toBe(true);
  });

  it("a pre-consent blob with learning on comes back off", () => {
    window.localStorage.setItem(
      "walk-settings",
      JSON.stringify({ preferenceLearningEnabled: true }),
    );
    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.preferenceLearningEnabled).toBe(false);
    expect(result.current.settings.learningConsent).toBe("unset");
  });

  it("learning cannot be enabled without a granted consent", () => {
    const { result } = renderHook(() => useWalkSettings());
    act(() => result.current.setSettings({ preferenceLearningEnabled: true }));
    expect(result.current.settings.preferenceLearningEnabled).toBe(false);
    act(() =>
      result.current.setSettings({ learningConsent: "granted", preferenceLearningEnabled: true }),
    );
    expect(result.current.settings.preferenceLearningEnabled).toBe(true);
    act(() => result.current.setSettings({ learningConsent: "declined" }));
    expect(result.current.settings.preferenceLearningEnabled).toBe(false);
  });

  it("persists the chosen language and rejects junk", () => {
    const { result } = renderHook(() => useWalkSettings());
    act(() => result.current.setSettings({ uiLanguage: "he" }));
    expect(JSON.parse(window.localStorage.getItem("walk-settings")!).uiLanguage).toBe("he");
    act(() => result.current.setSettings({ uiLanguage: "fr" as never }));
    expect(result.current.settings.uiLanguage).toBe("auto");
  });
});

describe("ConsentGate", () => {
  it("renders Hebrew with rtl and answers yes/no", () => {
    const onAnswer = vi.fn();
    const onLanguage = vi.fn();
    render(<ConsentGate lang="he" onAnswer={onAnswer} onLanguage={onLanguage} />);
    expect(screen.getByRole("dialog").getAttribute("dir")).toBe("rtl");
    fireEvent.click(screen.getByText("כן, התאימו לי את ההליכות"));
    expect(onAnswer).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText("לא תודה, בלי התאמה אישית"));
    expect(onAnswer).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByText("English"));
    expect(onLanguage).toHaveBeenCalledWith("en");
  });
});

describe("consent copy states what the AI sees (R1)", () => {
  it("says the typed request and nearby place names are sent, and that GPS, name, contact and habits are not", async () => {
    const { CONSENT_COPY } = await import("@/components/onboarding/ConsentGate");
    const en = CONSENT_COPY.en.ai;
    expect(en).toMatch(/type in the request box/);
    expect(en).toMatch(/names of nearby places/);
    expect(en).toMatch(/never gets your exact GPS/);
    expect(en).toMatch(/never your name or contact/);
    expect(en).toMatch(/habits.*never sent/);
    expect(en).not.toMatch(/only rough times/);
    const he = CONSENT_COPY.he.ai;
    expect(he).toContain("שמות המקומות הסמוכים");
    expect(he).toContain("מיקום ה־GPS המדויק");
    expect(he).toContain("שמכם או פרטי הקשר");
    expect(he).toContain("לא נשלחים ל־AI");
    expect(en).toMatch(/OpenStreetMap ids|OpenStreetMap\)/);
    expect(en).toMatch(/saved in your request history/);
    expect(he).toContain("OpenStreetMap");
    expect(he).toContain("בהיסטוריית הבקשות");
  });
});

describe("stored blobs and blocked storage (R1)", () => {
  it("an old blob with learning explicitly off maps to declined (not re-asked); true or missing stays unset", () => {
    window.localStorage.setItem("walk-settings", JSON.stringify({ preferenceLearningEnabled: false }));
    expect(renderHook(() => useWalkSettings()).result.current.settings.learningConsent).toBe("declined");
    window.localStorage.setItem("walk-settings", JSON.stringify({ preferenceLearningEnabled: true }));
    expect(renderHook(() => useWalkSettings()).result.current.settings.learningConsent).toBe("unset");
    window.localStorage.setItem("walk-settings", JSON.stringify({}));
    expect(renderHook(() => useWalkSettings()).result.current.settings.learningConsent).toBe("unset");
    // An explicit consent in the blob always wins.
    window.localStorage.setItem("walk-settings", JSON.stringify({ learningConsent: "granted", preferenceLearningEnabled: false }));
    expect(renderHook(() => useWalkSettings()).result.current.settings.learningConsent).toBe("granted");
  });

  it("changing an unrelated setting does not turn an unanswered consent into declined", () => {
    const { result } = renderHook(() => useWalkSettings());
    act(() => result.current.setSettings({ calloutLevel: "quiet" }));
    expect(result.current.settings.learningConsent).toBe("unset");
  });

  it("a blocked localStorage cannot lock the consent screen", () => {
    const { result } = renderHook(() => useWalkSettings());
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => {
          throw new Error("QuotaExceededError");
        },
      },
    });
    act(() => result.current.setSettings({ learningConsent: "granted", preferenceLearningEnabled: true }));
    expect(result.current.settings.learningConsent).toBe("granted");
  });
});
