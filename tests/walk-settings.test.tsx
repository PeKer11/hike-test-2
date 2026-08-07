import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalkSettingsPanel } from "@/components/WalkSettingsPanel";
import { useWalkSettings } from "@/lib/hooks/useWalkSettings";
import { DEFAULT_WALK_SETTINGS, type WalkSettings } from "@/lib/types/walk-settings";

const STORAGE_KEY = "walk-settings";

const AUTO_RESUME_LABEL = "Start the new walk for me";

function renderSettings(overrides: Partial<WalkSettings> = {}) {
  const onChange = vi.fn();
  render(
    <WalkSettingsPanel
      settings={{ ...DEFAULT_WALK_SETTINGS, ...overrides }}
      onChange={onChange}
    />,
  );
  return { onChange };
}

function autoResumeCheckbox() {
  return screen.getByLabelText(AUTO_RESUME_LABEL) as HTMLInputElement;
}

afterEach(cleanup);

// The hook reads and writes localStorage directly, and the test environment's
// own implementation is not dependable here — so each test gets a fresh
// in-memory one rather than sharing a store between tests.
let store: Record<string, string> = {};

beforeEach(() => {
  store = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    },
  });
});

describe("autoResumeAfterRebuild default and migration", () => {
  it("defaults on, so a walker who never opens settings keeps the old auto-resume", () => {
    expect(DEFAULT_WALK_SETTINGS.autoResumeAfterRebuild).toBe(true);

    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.autoResumeAfterRebuild).toBe(true);
  });

  it("fills the flag in as on for a stored blob written before it existed", () => {
    // A real pre-flag blob: pace modes and an interval, no auto-resume field.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        slowPaceMode: "ask",
        fastPaceMode: "off",
        paceCheckIntervalMs: 90_000,
        preferenceLearningEnabled: false,
      }),
    );

    const { result } = renderHook(() => useWalkSettings());

    expect(result.current.settings.autoResumeAfterRebuild).toBe(true);
    // The rest of the blob survives the fill-in.
    expect(result.current.settings.slowPaceMode).toBe("ask");
    expect(result.current.settings.preferenceLearningEnabled).toBe(false);
  });

  it("fills the flag in as on for a blob that predates the pace split entirely", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ paceCheckEnabled: false, paceCheckIntervalMs: 60_000 }),
    );

    const { result } = renderHook(() => useWalkSettings());

    // Turning pace checking off is not the same as turning auto-resume off:
    // nothing rebuilds, so the flag is simply unused, not opted out of.
    expect(result.current.settings.autoResumeAfterRebuild).toBe(true);
    expect(result.current.settings.slowPaceMode).toBe("off");
  });

  it("keeps a stored opt-out instead of defaulting it back on", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_WALK_SETTINGS, autoResumeAfterRebuild: false }),
    );

    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.autoResumeAfterRebuild).toBe(false);
  });

  it("persists an opt-out so the next walk starts from it", () => {
    const { result } = renderHook(() => useWalkSettings());

    act(() => {
      result.current.setSettings({ autoResumeAfterRebuild: false });
    });

    expect(result.current.settings.autoResumeAfterRebuild).toBe(false);
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "{}",
    ) as WalkSettings;
    expect(stored.autoResumeAfterRebuild).toBe(false);
  });
});

describe("auto-resume settings checkbox", () => {
  it("is checked, and explains that tracking picks straight up, when auto-resume is on", () => {
    renderSettings({ autoResumeAfterRebuild: true });

    expect(autoResumeCheckbox().checked).toBe(true);
    expect(screen.getByText(/tracking picks straight up/i)).toBeTruthy();
  });

  it("is unchecked, and explains that the walker presses Start Walk, when opted out", () => {
    renderSettings({ autoResumeAfterRebuild: false });

    expect(autoResumeCheckbox().checked).toBe(false);
    expect(screen.getByText(/wait for you to press Start Walk/i)).toBeTruthy();
  });

  it("reports the opt-out without touching the pace modes", () => {
    const { onChange } = renderSettings({ autoResumeAfterRebuild: true });

    fireEvent.click(autoResumeCheckbox());

    expect(onChange).toHaveBeenCalledWith({ autoResumeAfterRebuild: false });
  });

  it("reports opting back in", () => {
    const { onChange } = renderSettings({ autoResumeAfterRebuild: false });

    fireEvent.click(autoResumeCheckbox());

    expect(onChange).toHaveBeenCalledWith({ autoResumeAfterRebuild: true });
  });
});
