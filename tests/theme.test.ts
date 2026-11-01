import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { THEME_INIT_SCRIPT, THEME_KEY, applyTheme, isLightOnly, readChoice, resolveTheme } from "@/lib/theme/theme";

// Node's own experimental localStorage can shadow jsdom's, so use a plain store.
function memoryStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", memoryStorage());
});

afterEach(() => {
  document.documentElement.removeAttribute("data-theme");
  vi.unstubAllGlobals();
});

describe("resolveTheme", () => {
  it("follows the device by default", () => {
    expect(resolveTheme("system", "/app", true)).toBe("dark");
    expect(resolveTheme("system", "/app", false)).toBe("light");
  });
  it("explicit choice wins over the device", () => {
    expect(resolveTheme("light", "/app", true)).toBe("light");
    expect(resolveTheme("dark", "/app", false)).toBe("dark");
  });
  it("keeps landing and pricing light", () => {
    expect(isLightOnly("/")).toBe(true);
    expect(isLightOnly("/pricing/")).toBe(true);
    expect(isLightOnly("/app")).toBe(false);
    expect(resolveTheme("dark", "/", true)).toBe("light");
  });
});

describe("storage", () => {
  it("falls back to system when storage throws", () => {
    vi.stubGlobal("localStorage", { getItem: () => { throw new Error("blocked"); } });
    expect(readChoice()).toBe("system");
  });
  it("ignores junk values", () => {
    localStorage.setItem(THEME_KEY, "purple");
    expect(readChoice()).toBe("system");
  });
});

describe("init script", () => {
  it("sets data-theme the same way applyTheme does", () => {
    window.history.pushState({}, "", "/app");
    localStorage.setItem(THEME_KEY, "dark");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(applyTheme()).toBe("dark");
    localStorage.setItem(THEME_KEY, "light");
    new Function(THEME_INIT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
