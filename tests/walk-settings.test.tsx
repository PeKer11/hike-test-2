import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalkSettingsPanel } from "@/components/WalkSettingsPanel";
import { useWalkSettings } from "@/lib/hooks/useWalkSettings";
import { DEFAULT_WALK_SETTINGS, type WalkSettings } from "@/lib/types/walk-settings";

const STORAGE_KEY = "walk-settings";

const AUTO_RESUME_LABEL = "Start the new walk for me";

function disclosure() {
  return screen.getByRole("button", { name: /walk settings/i });
}

/**
 * Renders the panel and opens it, because the controls are behind a disclosure
 * that starts closed. Every test below is about a control, not about the
 * disclosure — the disclosure gets its own describe block.
 */
function renderSettings(overrides: Partial<WalkSettings> = {}) {
  const onChange = vi.fn();
  render(
    <WalkSettingsPanel
      settings={{ ...DEFAULT_WALK_SETTINGS, ...overrides }}
      onChange={onChange}
    />,
  );
  fireEvent.click(disclosure());
  return { onChange };
}

/** A named group inside the open panel — `<section aria-labelledby>`. */
function section(name: string) {
  return screen.getByRole("region", { name });
}

function deviationSelect() {
  return screen.getByLabelText(/strayed from the path/i) as HTMLSelectElement;
}

function autoResumeToggle() {
  return screen.getByLabelText(AUTO_RESUME_LABEL);
}

/** `Toggle` renders a button, not an `<input>` — checked state lives in `aria-pressed`. */
function isOn(toggle: HTMLElement) {
  return toggle.getAttribute("aria-pressed") === "true";
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

describe("pace mode defaults", () => {
  it("leaves both directions alone for a walker who has never opened settings", () => {
    expect(DEFAULT_WALK_SETTINGS.slowPaceMode).toBe("off");
    expect(DEFAULT_WALK_SETTINGS.fastPaceMode).toBe("off");

    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.slowPaceMode).toBe("off");
    expect(result.current.settings.fastPaceMode).toBe("off");
  });

  it("still migrates a pre-split blob to auto rather than to the new default", () => {
    // The new-walker default and the migration fallback answer different
    // questions: this walker had pace checking on, and turning it off under
    // them would be a silent behaviour change.
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ paceCheckEnabled: true, paceCheckIntervalMs: 60_000 }),
    );

    const { result } = renderHook(() => useWalkSettings());

    expect(result.current.settings.slowPaceMode).toBe("auto");
    expect(result.current.settings.fastPaceMode).toBe("auto");
  });
});

describe("deviationMode default, migration and control", () => {
  it("defaults to ask — being off route may mean lost, or may mean a shop", () => {
    expect(DEFAULT_WALK_SETTINGS.deviationMode).toBe("ask");

    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.deviationMode).toBe("ask");
  });

  it("fills the field in as ask for a blob written before it existed", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        slowPaceMode: "auto",
        fastPaceMode: "off",
        paceCheckIntervalMs: 90_000,
      }),
    );

    const { result } = renderHook(() => useWalkSettings());

    // Nothing happened off-route before this field, so there is no earlier
    // preference to respect — only someone who has never been asked.
    expect(result.current.settings.deviationMode).toBe("ask");
    expect(result.current.settings.slowPaceMode).toBe("auto");
  });

  it("keeps a stored opt-out instead of defaulting it back to ask", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_WALK_SETTINGS, deviationMode: "off" }),
    );

    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.deviationMode).toBe("off");
  });

  it("persists a change so the next walk starts from it", () => {
    const { result } = renderHook(() => useWalkSettings());

    act(() => {
      result.current.setSettings({ deviationMode: "auto" });
    });

    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "{}",
    ) as WalkSettings;
    expect(stored.deviationMode).toBe("auto");
  });

  it("reports the walker's choice from the off-route row", () => {
    const { onChange } = renderSettings({ deviationMode: "ask" });

    fireEvent.change(deviationSelect(), { target: { value: "auto" } });

    expect(onChange).toHaveBeenCalledWith({ deviationMode: "auto" });
  });

  it("shows the walker the mode they are actually on", () => {
    renderSettings({ deviationMode: "off" });

    expect(deviationSelect().value).toBe("off");
  });
});

describe("continueHeadingOnSilence default and migration", () => {
  it("defaults off — this is a rebuild taken on silence, not a yes", () => {
    expect(DEFAULT_WALK_SETTINGS.continueHeadingOnSilence).toBe(false);

    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.continueHeadingOnSilence).toBe(false);
  });

  it("fills the flag in as off for a blob written before it existed", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ deviationMode: "ask", autoResumeAfterRebuild: false }),
    );

    const { result } = renderHook(() => useWalkSettings());

    expect(result.current.settings.continueHeadingOnSilence).toBe(false);
    // The rest of the blob survives the fill-in.
    expect(result.current.settings.deviationMode).toBe("ask");
    expect(result.current.settings.autoResumeAfterRebuild).toBe(false);
  });

  it("keeps a stored opt-in instead of defaulting it back off", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_WALK_SETTINGS,
        continueHeadingOnSilence: true,
      }),
    );

    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.continueHeadingOnSilence).toBe(true);
  });

  it("persists an opt-in so the next walk starts from it", () => {
    const { result } = renderHook(() => useWalkSettings());

    act(() => {
      result.current.setSettings({ continueHeadingOnSilence: true });
    });

    expect(result.current.settings.continueHeadingOnSilence).toBe(true);
    const stored = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "{}",
    ) as WalkSettings;
    expect(stored.continueHeadingOnSilence).toBe(true);
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

describe("first render matches what the server can render", () => {
  // The panel renders the stored settings as text, so if the first client
  // render read localStorage it would disagree with the server-rendered
  // markup and React would throw a hydration mismatch. The server has no
  // localStorage, so the only safe first render is the defaults.
  it("renders the defaults before effects run, even with a stored blob", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_WALK_SETTINGS,
        autoResumeAfterRebuild: false,
        slowPaceMode: "off",
      }),
    );

    let firstRender: WalkSettings | null = null;
    function Probe() {
      const { settings } = useWalkSettings();
      firstRender ??= settings;
      return null;
    }
    render(<Probe />);

    expect(firstRender).toEqual(DEFAULT_WALK_SETTINGS);
  });

  it("still lands on the stored settings once mounted", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_WALK_SETTINGS, autoResumeAfterRebuild: false }),
    );

    const { result } = renderHook(() => useWalkSettings());

    expect(result.current.settings.autoResumeAfterRebuild).toBe(false);
  });
});

describe("auto-resume settings toggle", () => {
  it("is on, and explains that tracking picks straight up, when auto-resume is on", () => {
    renderSettings({ autoResumeAfterRebuild: true });

    expect(isOn(autoResumeToggle())).toBe(true);
    expect(screen.getByText(/tracking picks straight up/i)).toBeTruthy();
  });

  it("is off, and explains that the walker presses Start Walk, when opted out", () => {
    renderSettings({ autoResumeAfterRebuild: false });

    expect(isOn(autoResumeToggle())).toBe(false);
    expect(screen.getByText(/wait for you to press Start Walk/i)).toBeTruthy();
  });

  it("reports the opt-out without touching the pace modes", () => {
    const { onChange } = renderSettings({ autoResumeAfterRebuild: true });

    fireEvent.click(autoResumeToggle());

    expect(onChange).toHaveBeenCalledWith({ autoResumeAfterRebuild: false });
  });

  it("reports opting back in", () => {
    const { onChange } = renderSettings({ autoResumeAfterRebuild: false });

    fireEvent.click(autoResumeToggle());

    expect(onChange).toHaveBeenCalledWith({ autoResumeAfterRebuild: true });
  });
});

// Deliberately a second flag rather than a second job for preference learning:
// "remember what I like" and "show me what I typed" are different promises.
describe("history persistence setting", () => {
  function historyToggle() {
    return screen.getByLabelText("Keep my recent requests");
  }

  it("defaults on for a walker who has never opened settings", () => {
    expect(DEFAULT_WALK_SETTINGS.historyPersistenceEnabled).toBe(true);

    const { result } = renderHook(() => useWalkSettings());
    expect(result.current.settings.historyPersistenceEnabled).toBe(true);
  });

  it("fills in as on for a stored blob written before it existed", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        slowPaceMode: "ask",
        preferenceLearningEnabled: false,
      }),
    );

    const { result } = renderHook(() => useWalkSettings());

    // Nothing was persisted before the flag existed, so a missing field is not
    // an opt-out from anything.
    expect(result.current.settings.historyPersistenceEnabled).toBe(true);
  });

  it("keeps a stored opt-out instead of defaulting it back on", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_WALK_SETTINGS,
        historyPersistenceEnabled: false,
      }),
    );

    const { result } = renderHook(() => useWalkSettings());

    expect(result.current.settings.historyPersistenceEnabled).toBe(false);
  });

  it("does not move when preference learning is turned off", () => {
    const { result } = renderHook(() => useWalkSettings());

    act(() => {
      result.current.setSettings({ preferenceLearningEnabled: false });
    });

    expect(result.current.settings.historyPersistenceEnabled).toBe(true);
  });

  it("persists an opt-out so the next session starts from it", () => {
    const { result } = renderHook(() => useWalkSettings());

    act(() => {
      result.current.setSettings({ historyPersistenceEnabled: false });
    });

    expect(
      JSON.parse(store[STORAGE_KEY]).historyPersistenceEnabled,
    ).toBe(false);
  });

  it("is on, and says the list survives, when persistence is on", () => {
    renderSettings({ historyPersistenceEnabled: true });

    expect(isOn(historyToggle())).toBe(true);
    expect(screen.getByText(/stay in the Recent requests list/i)).toBeTruthy();
  });

  it("is off, and says the requests are forgotten, when opted out", () => {
    renderSettings({ historyPersistenceEnabled: false });

    expect(isOn(historyToggle())).toBe(false);
    expect(screen.getByText(/forgotten when you close the tab/i)).toBeTruthy();
  });

  it("reports the opt-out without touching preference learning", () => {
    const { onChange } = renderSettings({ historyPersistenceEnabled: true });

    fireEvent.click(historyToggle());

    expect(onChange).toHaveBeenCalledWith({ historyPersistenceEnabled: false });
  });
});

// The settings surface was reorganized on 2026-08-23: every control now sits
// in a named group, and the whole thing lives behind a disclosure. These tests
// are about where a control is and whether it is reachable, not about what it
// does — the blocks above already own that, and none of them changed.
describe("the settings disclosure", () => {
  function renderClosed(overrides: Partial<WalkSettings> = {}) {
    const onChange = vi.fn();
    render(
      <WalkSettingsPanel
        settings={{ ...DEFAULT_WALK_SETTINGS, ...overrides }}
        onChange={onChange}
      />,
    );
    return { onChange };
  }

  it("starts closed, so the walk form is not buried under seven settings", () => {
    renderClosed();

    expect(disclosure().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText(AUTO_RESUME_LABEL)).toBeNull();
    expect(screen.queryByRole("region")).toBeNull();
  });

  it("leaves no control behind to be changed while it is closed", () => {
    // The distinction that matters for a hidden control: it is gone from the
    // page, not merely invisible while still wired to onChange.
    const { onChange } = renderClosed();

    // Toggle renders a <button aria-pressed>, not an <input type="checkbox">
    // — the disclosure button itself uses aria-expanded, not aria-pressed, so
    // this still distinguishes "no settings toggle rendered" from "the panel
    // has a button on it at all".
    expect(
      document.querySelectorAll("[aria-pressed]"),
    ).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(screen.queryAllByRole("spinbutton")).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("opens onto every control the panel had before it was grouped", () => {
    renderClosed();

    fireEvent.click(disclosure());

    expect(disclosure().getAttribute("aria-expanded")).toBe("true");
    for (const label of [
      "When I fall behind",
      "When I'm ahead",
      "How often we check your pace (seconds)",
      "When I've strayed from the path",
      AUTO_RESUME_LABEL,
      "Remember my preferences",
      "Keep my recent requests",
    ]) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it("closes again on a second press", () => {
    renderClosed();

    fireEvent.click(disclosure());
    fireEvent.click(disclosure());

    expect(disclosure().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText(AUTO_RESUME_LABEL)).toBeNull();
  });
});

describe("which group each control lands in", () => {
  it("keeps both pace directions and the check interval under the pace heading", () => {
    renderSettings();

    const pace = within(section("If my pace drifts"));
    expect(pace.getByLabelText("When I fall behind")).toBeTruthy();
    expect(pace.getByLabelText("When I'm ahead")).toBeTruthy();
    expect(
      pace.getByLabelText("How often we check your pace (seconds)"),
    ).toBeTruthy();
  });

  it("no longer leaves the pace interval sitting under the off-route heading", () => {
    // Where it used to render: below the off-route group, under no heading of
    // its own, reading as though going off route were what got checked every
    // 60 seconds.
    renderSettings();

    const offRoute = within(section("If I go off route"));
    expect(offRoute.getByLabelText("When I've strayed from the path")).toBeTruthy();
    expect(
      offRoute.queryByLabelText("How often we check your pace (seconds)"),
    ).toBeNull();
  });

  it("files auto-resume under the rebuild, not under pace — both rebuilds read it", () => {
    renderSettings();

    expect(
      within(section("When we reshape your walk")).getByLabelText(
        AUTO_RESUME_LABEL,
      ),
    ).toBeTruthy();
    expect(
      within(section("If my pace drifts")).queryByLabelText(AUTO_RESUME_LABEL),
    ).toBeNull();
  });

  it("gives the two cross-walk memory toggles a heading of their own", () => {
    renderSettings();

    const memory = within(section("What we remember between walks"));
    expect(memory.getByLabelText("Remember my preferences")).toBeTruthy();
    expect(memory.getByLabelText("Keep my recent requests")).toBeTruthy();
  });

  it("leads the memory group with the toggle that changes what gets built", () => {
    // Preference learning quietly changes the walks we hand back; keeping the
    // requests only shows the walker their own words. The more consequential
    // one goes first.
    renderSettings();

    // The only buttons in this group are the two Toggles — the disclosure
    // button lives outside this section entirely.
    const toggles = within(
      section("What we remember between walks"),
    ).getAllByRole("button");

    expect(toggles).toHaveLength(2);
    expect(toggles[0]).toBe(screen.getByLabelText("Remember my preferences"));
    expect(toggles[1]).toBe(screen.getByLabelText("Keep my recent requests"));
  });

  it("only offers the silence-heading toggle when there's a question to leave unanswered", () => {
    renderSettings({ deviationMode: "ask" });
    expect(
      screen.getByLabelText(/don't answer but keep walking one way/i),
    ).toBeTruthy();
  });

  it("hides the silence-heading toggle for auto and off modes", () => {
    renderSettings({ deviationMode: "auto" });
    expect(
      screen.queryByLabelText(/don't answer but keep walking one way/i),
    ).toBeNull();

    cleanup();
    renderSettings({ deviationMode: "off" });
    expect(
      screen.queryByLabelText(/don't answer but keep walking one way/i),
    ).toBeNull();
  });

  it("reports a change to the silence-heading toggle", () => {
    const { onChange } = renderSettings({
      deviationMode: "ask",
      continueHeadingOnSilence: false,
    });

    fireEvent.click(
      screen.getByLabelText(/don't answer but keep walking one way/i),
    );

    expect(onChange).toHaveBeenCalledWith({ continueHeadingOnSilence: true });
  });

  it("still reports a change made from inside a group", () => {
    // Grouping is presentation: a control moved into a section must still be
    // wired to the same onChange it always was.
    const { onChange } = renderSettings({ autoResumeAfterRebuild: true });

    fireEvent.click(
      within(section("When we reshape your walk")).getByLabelText(
        AUTO_RESUME_LABEL,
      ),
    );

    expect(onChange).toHaveBeenCalledWith({ autoResumeAfterRebuild: false });
  });
});
