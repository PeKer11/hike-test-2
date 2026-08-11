import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlacePromptPanel } from "@/components/route/PlacePromptPanel";
import type { Attraction } from "@/lib/types";

function attraction(id: string, name: string): Attraction {
  return {
    id,
    name,
    coordinates: { lat: 32.57, lng: 34.95 },
    category: "other",
    avgVisitMinutes: 30,
    tags: { source: "prompt" },
  };
}

const FOUND: Attraction[] = [
  attraction("prompt-0-place", "מדרחוב"),
  attraction("prompt-1-place", "גן טייל"),
  attraction("prompt-2-place", "זכרון יעקב"),
];

function renderPanel(
  onAcceptAttractions = vi.fn(),
  onPreview = vi.fn(),
  onFoundPlacesChange = vi.fn(),
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ attractions: FOUND, unresolvedNames: [] }),
    })),
  );

  render(
    <PlacePromptPanel
      nearLocation={null}
      acceptedAttractions={null}
      onAcceptAttractions={onAcceptAttractions}
      onPreview={onPreview}
      onFoundPlacesChange={onFoundPlacesChange}
    />,
  );

  fireEvent.change(screen.getByRole("textbox"), {
    target: { value: "מדרחוב וגן טייל בזכרון יעקב" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Find these places" }));

  return onAcceptAttractions;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PlacePromptPanel", () => {
  it("accepts every found place when nothing is removed", async () => {
    const onAcceptAttractions = renderPanel();

    await screen.findByText("זכרון יעקב");
    fireEvent.click(
      screen.getByRole("button", { name: "Use these stops in my walk" }),
    );

    expect(onAcceptAttractions).toHaveBeenCalledWith(FOUND);
  });

  it("drops a wrongly extracted place from the list and from what is accepted", async () => {
    const onAcceptAttractions = renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Remove זכרון יעקב" }));

    await waitFor(() => {
      expect(screen.queryByText("זכרון יעקב")).toBeNull();
    });
    expect(screen.getByText("מדרחוב")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Use these stops in my walk" }),
    );

    expect(onAcceptAttractions).toHaveBeenCalledWith([FOUND[0], FOUND[1]]);
  });

  it("previews a found place on the map when its name is clicked", async () => {
    const onPreview = vi.fn();
    renderPanel(vi.fn(), onPreview);

    fireEvent.click(await screen.findByRole("button", { name: "גן טייל" }));

    expect(onPreview).toHaveBeenCalledWith(FOUND[1].coordinates, "גן טייל");
  });

  it("reports the remaining places so stale pins leave the map", async () => {
    const onFoundPlacesChange = vi.fn();
    renderPanel(vi.fn(), vi.fn(), onFoundPlacesChange);

    fireEvent.click(await screen.findByRole("button", { name: "Remove זכרון יעקב" }));

    expect(onFoundPlacesChange).toHaveBeenLastCalledWith([FOUND[0], FOUND[1]]);
  });

  it("hides the accept button once every place is removed", async () => {
    renderPanel();

    for (const place of ["מדרחוב", "גן טייל", "זכרון יעקב"]) {
      fireEvent.click(await screen.findByRole("button", { name: `Remove ${place}` }));
    }

    expect(
      screen.queryByRole("button", { name: "Use these stops in my walk" }),
    ).toBeNull();
    expect(screen.getByText(/You removed every place/)).toBeTruthy();
  });

  it("hands a stated walk length up so the time field can start from it", async () => {
    const onDurationDetected = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          attractions: [],
          unresolvedNames: [],
          durationMinutes: 180,
        }),
      })),
    );

    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        onDurationDetected={onDurationDetected}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "יש לי שלוש שעות" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));

    await waitFor(() => expect(onDurationDetected).toHaveBeenCalledWith(180));
  });

  it("leaves the time field alone when no walk length was stated", async () => {
    const onDurationDetected = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          attractions: FOUND,
          unresolvedNames: [],
          durationMinutes: null,
        }),
      })),
    );

    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        onDurationDetected={onDurationDetected}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "מדרחוב וגן טייל" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));

    await screen.findByText("זכרון יעקב");
    expect(onDurationDetected).not.toHaveBeenCalled();
  });

  it("hands the located area up so the coordinate fields can start from it", async () => {
    const onOriginDetected = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          attractions: [],
          unresolvedNames: [],
          contextCoordinates: { lat: 32.5736, lng: 34.9522 },
        }),
      })),
    );

    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        onOriginDetected={onOriginDetected}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "הבימה בזכרון יעקב" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));

    await waitFor(() =>
      expect(onOriginDetected).toHaveBeenCalledWith({
        lat: 32.5736,
        lng: 34.9522,
      }),
    );
  });

  it("leaves the coordinate fields alone when no area was located", async () => {
    const onOriginDetected = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          attractions: FOUND,
          unresolvedNames: [],
          contextCoordinates: null,
        }),
      })),
    );

    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        onOriginDetected={onOriginDetected}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "מדרחוב וגן טייל" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));

    await screen.findByText("זכרון יעקב");
    expect(onOriginDetected).not.toHaveBeenCalled();
  });

  it("does not fill the coordinate fields from an area the API flagged as suspect", async () => {
    const onOriginDetected = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          attractions: FOUND,
          unresolvedNames: [],
          contextCoordinates: { lat: 48.8566, lng: 2.3522 },
          contextLocationSuspect: true,
        }),
      })),
    );

    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        onOriginDetected={onOriginDetected}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "הבימה בזכרון יעקב" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));

    await screen.findByText("זכרון יעקב");
    expect(onOriginDetected).not.toHaveBeenCalled();
  });
});

// Naming three places and allowing three hours is a request for three places,
// not for as many places as three hours holds. The old code read the leftover
// budget as an instruction and there was no way to say otherwise.
describe("PlacePromptPanel — filling leftover time", () => {
  function renderAccepted(
    fillRemainingTime: boolean,
    onFillRemainingTimeChange = vi.fn(),
  ) {
    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={FOUND}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        fillRemainingTime={fillRemainingTime}
        onFillRemainingTimeChange={onFillRemainingTimeChange}
      />,
    );
    return onFillRemainingTimeChange;
  }

  async function acceptStops() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ attractions: FOUND, unresolvedNames: [] }),
      })),
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "מדרחוב וגן טייל" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
    await screen.findByText("זכרון יעקב");
  }

  it("offers the choice once stops have been accepted", async () => {
    renderAccepted(false);
    await acceptStops();

    const toggle = screen.getByRole("checkbox", {
      name: /Add more stops to fill my time/,
    });
    expect((toggle as HTMLInputElement).checked).toBe(false);
    expect(
      screen.getByText(/a walk through exactly these stops/),
    ).toBeTruthy();
  });

  it("reports the walker turning it on", async () => {
    const onChange = renderAccepted(false);
    await acceptStops();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: /Add more stops to fill my time/,
      }),
    );

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("says what it will do once it is on", async () => {
    renderAccepted(true);
    await acceptStops();

    const toggle = screen.getByRole("checkbox", {
      name: /Add more stops to fill my time/,
    });
    expect((toggle as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/use up whatever time is left over/)).toBeTruthy();
  });

  // No accepted stops means no named list to leave alone.
  it("does not ask before any stops are accepted", () => {
    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        onFillRemainingTimeChange={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("checkbox", {
        name: /Add more stops to fill my time/,
      }),
    ).toBeNull();
  });
});

describe("PlacePromptPanel — clarifying an under-specified prompt", () => {
  function stubExtract(
    responses: Record<string, unknown>[],
  ): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => responses.shift() ?? {},
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function renderPanel() {
    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "טיול בזכרון יעקב" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
  }

  it("offers the suggested categories as chips", async () => {
    stubExtract([
      {
        attractions: [],
        unresolvedNames: [],
        needsClarification: true,
        clarificationCategories: ["nature", "landmark", "food"],
      },
    ]);
    renderPanel();

    await screen.findByText(/What kind of walk are you after\?/);
    expect(screen.getByRole("button", { name: "Nature" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "History & landmarks" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Food" })).toBeTruthy();
  });

  it("says nothing when the prompt was specific enough", async () => {
    stubExtract([
      {
        attractions: FOUND,
        unresolvedNames: [],
        needsClarification: false,
        clarificationCategories: [],
      },
    ]);
    renderPanel();

    await screen.findByText("זכרון יעקב");
    expect(screen.queryByText(/What kind of walk are you after\?/)).toBeNull();
  });

  it("re-runs the prompt with the tapped category and takes the question down", async () => {
    const fetchMock = stubExtract([
      {
        attractions: [],
        unresolvedNames: [],
        needsClarification: true,
        clarificationCategories: ["nature", "food"],
      },
      {
        attractions: FOUND,
        unresolvedNames: [],
        needsClarification: false,
        clarificationCategories: [],
        durationMinutes: 120,
        maxEndDistanceKm: 1,
      },
    ]);
    renderPanel();

    await screen.findByText(/What kind of walk are you after\?/);
    fireEvent.click(screen.getByRole("button", { name: "Food" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(
        screen.queryByText(/What kind of walk are you after\?/),
      ).toBeNull(),
    );

    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1][1] as { body: string }).body,
    );
    expect(secondBody.categoryNeeds).toEqual(["food"]);
    expect(secondBody.prompt).toBe("טיול בזכרון יעקב");
  });

  it("does not answer the question until Continue is pressed", async () => {
    const fetchMock = stubExtract([
      {
        attractions: [],
        unresolvedNames: [],
        needsClarification: true,
        clarificationCategories: ["nature", "food"],
      },
    ]);
    renderPanel();

    await screen.findByText(/What kind of walk are you after\?/);
    fireEvent.click(screen.getByRole("button", { name: "Food" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Food" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(
      screen.getByRole("button", { name: "Nature" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("sends every chip the walker ticked, not just the last one", async () => {
    const fetchMock = stubExtract([
      {
        attractions: [],
        unresolvedNames: [],
        needsClarification: true,
        clarificationCategories: ["nature", "food", "museum"],
      },
      { attractions: FOUND, unresolvedNames: [], durationMinutes: 120, maxEndDistanceKm: 1 },
    ]);
    renderPanel();

    await screen.findByText(/What kind of walk are you after\?/);
    fireEvent.click(screen.getByRole("button", { name: "Nature" }));
    fireEvent.click(screen.getByRole("button", { name: "Food" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1][1] as { body: string }).body,
    );
    expect(secondBody.categoryNeeds).toEqual(["nature", "food"]);
  });

  it("un-ticks a chip that is tapped a second time", async () => {
    const fetchMock = stubExtract([
      {
        attractions: [],
        unresolvedNames: [],
        needsClarification: true,
        clarificationCategories: ["nature", "food"],
      },
      { attractions: FOUND, unresolvedNames: [], durationMinutes: 120, maxEndDistanceKm: 1 },
    ]);
    renderPanel();

    await screen.findByText(/What kind of walk are you after\?/);
    fireEvent.click(screen.getByRole("button", { name: "Nature" }));
    fireEvent.click(screen.getByRole("button", { name: "Food" }));
    fireEvent.click(screen.getByRole("button", { name: "Nature" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const secondBody = JSON.parse(
      (fetchMock.mock.calls[1][1] as { body: string }).body,
    );
    expect(secondBody.categoryNeeds).toEqual(["food"]);
  });

  // The extractor keeps only `MAX_CATEGORY_NEEDS` of them, so offering a
  // fourth selection would promise a stop that never gets searched for.
  it("stops the walker selecting more chips than the extractor keeps", async () => {
    stubExtract([
      {
        attractions: [],
        unresolvedNames: [],
        needsClarification: true,
        clarificationCategories: ["nature", "food", "museum", "park"],
      },
    ]);
    renderPanel();

    await screen.findByText(/What kind of walk are you after\?/);
    for (const label of ["Nature", "Food", "Museums"]) {
      fireEvent.click(screen.getByRole("button", { name: label }));
    }

    const overflow = screen.getByRole("button", { name: "Parks" });
    expect((overflow as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(overflow);
    expect(overflow.getAttribute("aria-pressed")).toBe("false");
    expect(
      screen.getByRole("button", { name: "Museums" }).getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("cannot be continued before a chip is ticked", async () => {
    stubExtract([
      {
        attractions: [],
        unresolvedNames: [],
        needsClarification: true,
        clarificationCategories: ["nature", "food"],
      },
    ]);
    renderPanel();

    await screen.findByText(/What kind of walk are you after\?/);
    expect(
      (screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });
});

// The two Phase 2 items meet here: "don't pad a named list" must not turn
// "a walk in Zichron Yaakov" into a two-stop walk with two hours spare.
describe("PlacePromptPanel — an area-only prompt is not a named list", () => {
  function stubOnce(response: Record<string, unknown>) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => response })),
    );
  }

  function renderWith(onFillRemainingTimeChange: (fill: boolean) => void) {
    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        onFillRemainingTimeChange={onFillRemainingTimeChange}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "טיול בזכרון יעקב" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
  }

  it("turns filling on when the prompt only named a town", async () => {
    const onFill = vi.fn();
    stubOnce({
      attractions: FOUND,
      unresolvedNames: [],
      areaOnlyPrompt: true,
      needsClarification: false,
      clarificationCategories: [],
    });
    renderWith(onFill);

    await screen.findByText("זכרון יעקב");
    expect(onFill).toHaveBeenCalledWith(true);
  });

  it("leaves filling alone when the walker named their stops", async () => {
    const onFill = vi.fn();
    stubOnce({
      attractions: FOUND,
      unresolvedNames: [],
      areaOnlyPrompt: false,
    });
    renderWith(onFill);

    await screen.findByText("זכרון יעקב");
    expect(onFill).not.toHaveBeenCalled();
  });
});

// The session log above the prompt box. Separate from `KnownSoFar`: that is
// one conversation's answers and resets per topic, this is every request made
// in this browser session and only drops entries to the cap.
describe("PlacePromptPanel — the session scrollback", () => {
  function stubExtract(
    responses: Record<string, unknown>[],
  ): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => responses.shift() ?? {},
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function renderPanel() {
    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
      />,
    );
  }

  function sendPrompt(text: string) {
    fireEvent.change(screen.getByRole("textbox", { name: "" }), {
      target: { value: text },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
  }

  /** Entries are behind a toggle, so reading the log means opening it. */
  async function openLog() {
    fireEvent.click(await screen.findByRole("button", { name: /Recent requests/ }));
  }

  /**
   * Scoped to the log itself. The prompt box and the error banner hold the same
   * strings, and an unscoped query would pass on either of them.
   */
  function log() {
    return within(screen.getByRole("list", { name: "Recent requests" }));
  }

  const CHIPS_UP = {
    attractions: [],
    unresolvedNames: [],
    needsClarification: true,
    clarificationCategories: ["nature", "food"],
  };

  it("shows nothing before anything has been asked", () => {
    stubExtract([]);
    renderPanel();

    expect(screen.queryByRole("button", { name: /Recent requests/ })).toBeNull();
  });

  it("logs what was found for a prompt that resolved straight away", async () => {
    stubExtract([{ attractions: FOUND, unresolvedNames: [] }]);
    renderPanel();
    sendPrompt("מדרחוב וגן טייל בזכרון יעקב");

    await openLog();
    expect(log().getByText("מדרחוב וגן טייל בזכרון יעקב")).toBeTruthy();
    expect(log().getByText("Found 3 stops")).toBeTruthy();
  });

  it("logs the question when the prompt was too vague to answer", async () => {
    stubExtract([CHIPS_UP]);
    renderPanel();
    sendPrompt("טיול בזכרון יעקב");

    await openLog();
    expect(
      screen.getByText("Asked what kind of walk you're after"),
    ).toBeTruthy();
  });

  it("logs the names it could not place", async () => {
    stubExtract([
      { attractions: [], unresolvedNames: ["בית הקפה של דני"] },
    ]);
    renderPanel();
    sendPrompt("בית הקפה של דני");

    await openLog();
    expect(screen.getByText("Couldn't locate בית הקפה של דני")).toBeTruthy();
  });

  it("logs an empty result rather than dropping the attempt", async () => {
    stubExtract([{ attractions: [], unresolvedNames: [] }]);
    renderPanel();
    sendPrompt("אהה");

    await openLog();
    expect(screen.getByText("Didn't find anything for that")).toBeTruthy();
  });

  // "I typed that and it didn't work" is the thing most worth looking back at.
  it("logs a failed extraction with the reason it failed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "Places service is down." }),
      })),
    );
    renderPanel();
    sendPrompt("מדרחוב");

    await openLog();
    expect(log().getByText("Places service is down.")).toBeTruthy();
  });

  it("logs each turn of a two-turn conversation as its own entry", async () => {
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
      { followUp: true, durationMinutes: 180, maxEndDistanceKm: 1 },
    ]);
    renderPanel();
    sendPrompt("טיול בזכרון יעקב");

    await screen.findByText(/What kind of walk are you after\?/);
    fireEvent.click(screen.getByRole("button", { name: "Food" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    const input = await screen.findByLabelText(
      "How much time do you have, and how far do you want to end up?",
    );
    fireEvent.change(input, { target: { value: "3 hours, up to 1km" } });
    fireEvent.click(screen.getByRole("button", { name: "Build my walk" }));

    await screen.findByRole("button", { name: "Recent requests (3)" });
    await openLog();
    expect(
      screen.getByText("Asked what kind of walk you're after"),
    ).toBeTruthy();
    expect(screen.getByText("טיול בזכרון יעקב — Food")).toBeTruthy();
    expect(screen.getByText("Found 3 stops")).toBeTruthy();
    expect(screen.getByText("3 hours, up to 1km")).toBeTruthy();
    expect(screen.getByText("Built a walk through 3 stops")).toBeTruthy();
  });

  it("drops the oldest entry once six requests have been made", async () => {
    stubExtract(
      ["one", "two", "three", "four", "five", "six"].map(() => ({
        attractions: FOUND,
        unresolvedNames: [],
      })),
    );
    renderPanel();

    const sent = ["one", "two", "three", "four", "five", "six"];
    for (let i = 0; i < sent.length; i++) {
      sendPrompt(sent[i]);
      // The log is collapsed, so the count in the toggle is what says the
      // entry landed. It stops climbing at the cap.
      const expected = Math.min(i + 1, 5);
      await screen.findByRole("button", {
        name: `Recent requests (${expected})`,
      });
    }

    await openLog();
    const entries = log().getAllByRole("listitem");
    expect(entries.map((li) => li.textContent?.split("Found")[0])).toEqual([
      "two",
      "three",
      "four",
      "five",
      "six",
    ]);
  });

  // The accumulator resets per topic; the log does not.
  it("keeps earlier entries when a brand new prompt is run", async () => {
    stubExtract([
      CHIPS_UP,
      { attractions: FOUND, unresolvedNames: [] },
    ]);
    renderPanel();
    sendPrompt("טיול בזכרון יעקב");

    await screen.findByText(/What kind of walk are you after\?/);
    sendPrompt("הבימה בתל אביב");

    await screen.findByRole("button", { name: "Recent requests (2)" });
    await openLog();
    expect(
      screen.getByText("Asked what kind of walk you're after"),
    ).toBeTruthy();
    expect(screen.getByText("טיול בזכרון יעקב")).toBeTruthy();
  });

  it("keeps the log when a new prompt clears what the conversation knew", async () => {
    const fetchMock = stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
      { attractions: FOUND, unresolvedNames: [] },
    ]);
    renderPanel();
    sendPrompt("טיול בזכרון יעקב");

    await screen.findByText(/What kind of walk are you after\?/);
    fireEvent.click(screen.getByRole("button", { name: "Nature" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByText(
      "How much time do you have, and how far do you want to end up?",
    );

    // A fresh prompt: the follow-up question goes away, i.e. `known` reset.
    sendPrompt("הבימה בתל אביב");
    await waitFor(() =>
      expect(screen.queryByText(/How much time do you have/)).toBeNull(),
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    await screen.findByRole("button", { name: "Recent requests (3)" });
    await openLog();
    expect(screen.getByText("טיול בזכרון יעקב — Nature")).toBeTruthy();
  });

  it("shortens a prompt too long to sit above the box", async () => {
    const long = "א".repeat(80);
    stubExtract([{ attractions: FOUND, unresolvedNames: [] }]);
    renderPanel();
    sendPrompt(long);

    await openLog();
    expect(log().getByText(`${"א".repeat(59)}…`)).toBeTruthy();
    expect(log().queryByText(long)).toBeNull();
  });

  it("keeps the entries out of the way until they are asked for", async () => {
    stubExtract([{ attractions: FOUND, unresolvedNames: [] }]);
    renderPanel();
    sendPrompt("מדרחוב");

    const toggle = await screen.findByRole("button", {
      name: "Recent requests (1)",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Found 3 stops")).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Found 3 stops")).toBeTruthy();
  });
});

// Turn two. The walker has answered "what kind of walk?"; the app now asks the
// one thing the clarification never used to ask about — how long they have and
// where they want to end up — and must not lose turn one doing it.
describe("PlacePromptPanel — the follow-up turn", () => {
  function stubExtract(
    responses: Record<string, unknown>[],
  ): ReturnType<typeof vi.fn> {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => responses.shift() ?? {},
    }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  function renderPanel(
    props: Partial<{
      onDurationDetected: (minutes: number) => void;
      onMaxEndDistanceDetected: (km: number) => void;
      onAcceptAttractions: (attractions: Attraction[] | null) => void;
    }> = {},
  ) {
    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={props.onAcceptAttractions ?? vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        onDurationDetected={props.onDurationDetected}
        onMaxEndDistanceDetected={props.onMaxEndDistanceDetected}
      />,
    );
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "טיול בזכרון יעקב" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
  }

  /** Turn one: the chips go up, the walker ticks nature and food, and sends. */
  async function answerTheChips() {
    await screen.findByText(/What kind of walk are you after\?/);
    fireEvent.click(screen.getByRole("button", { name: "Nature" }));
    fireEvent.click(screen.getByRole("button", { name: "Food" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  }

  const CHIPS_UP = {
    attractions: [],
    unresolvedNames: [],
    needsClarification: true,
    clarificationCategories: ["nature", "food", "museum"],
  };

  it("asks about both when the walk has neither a time nor a finish distance", async () => {
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
    ]);
    renderPanel();
    await answerTheChips();

    expect(
      await screen.findByText(
        "How much time do you have, and how far do you want to end up?",
      ),
    ).toBeTruthy();
  });

  it("asks only about the finish distance when the time was already stated", async () => {
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: 180,
        maxEndDistanceKm: null,
      },
    ]);
    renderPanel();
    await answerTheChips();

    expect(
      await screen.findByText(
        "How far from where you start do you want to end up?",
      ),
    ).toBeTruthy();
  });

  it("asks only about the time when the finish distance was already stated", async () => {
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: 1,
      },
    ]);
    renderPanel();
    await answerTheChips();

    expect(
      await screen.findByText("How much time do you have?"),
    ).toBeTruthy();
  });

  it("asks nothing when the original prompt already said both", async () => {
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: 180,
        maxEndDistanceKm: 1,
      },
    ]);
    renderPanel();
    await answerTheChips();

    await screen.findByText("זכרון יעקב");
    expect(screen.queryByText(/How much time do you have/)).toBeNull();
    expect(screen.queryByText(/how far do you want to end up/)).toBeNull();
  });

  // The question is the app's, not the walker's — a prompt that simply didn't
  // mention time is not a reason to start interrogating them.
  it("does not ask when there was no clarifying question to begin with", async () => {
    stubExtract([
      {
        attractions: FOUND,
        unresolvedNames: [],
        needsClarification: false,
        clarificationCategories: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
    ]);
    renderPanel();

    await screen.findByText("זכרון יעקב");
    expect(screen.queryByText(/How much time do you have/)).toBeNull();
  });

  it("fills the time and distance fields from what the walker typed back", async () => {
    const onDurationDetected = vi.fn();
    const onMaxEndDistanceDetected = vi.fn();
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
      {
        followUp: true,
        durationMinutes: 180,
        maxEndDistanceKm: 1,
        categoryNeeds: ["nature", "food"],
      },
    ]);
    renderPanel({ onDurationDetected, onMaxEndDistanceDetected });
    await answerTheChips();

    const input = await screen.findByLabelText(
      "How much time do you have, and how far do you want to end up?",
    );
    fireEvent.change(input, { target: { value: "3 hours, up to 1km" } });
    fireEvent.click(screen.getByRole("button", { name: "Build my walk" }));

    await waitFor(() => expect(onDurationDetected).toHaveBeenCalledWith(180));
    expect(onMaxEndDistanceDetected).toHaveBeenCalledWith(1);
  });

  // The whole reason the accumulator exists: turn two says nothing about
  // nature or food, and sending it must not read as retracting them.
  it("sends turn one's categories along with turn two's text", async () => {
    const fetchMock = stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
      { followUp: true, durationMinutes: 180, maxEndDistanceKm: 1 },
    ]);
    renderPanel();
    await answerTheChips();

    const input = await screen.findByLabelText(
      "How much time do you have, and how far do you want to end up?",
    );
    fireEvent.change(input, { target: { value: "3 hours, up to 1km" } });
    fireEvent.click(screen.getByRole("button", { name: "Build my walk" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const body = JSON.parse((fetchMock.mock.calls[2][1] as { body: string }).body);
    expect(body.categoryNeeds).toEqual(["nature", "food"]);
    expect(body.followUp).toBe(true);
    expect(body.prompt).toBe("3 hours, up to 1km");
  });

  it("tells the endpoint what the earlier turns already established", async () => {
    const fetchMock = stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: 180,
        maxEndDistanceKm: null,
      },
      { followUp: true, durationMinutes: 180, maxEndDistanceKm: 1 },
    ]);
    renderPanel();
    await answerTheChips();

    const input = await screen.findByLabelText(
      "How far from where you start do you want to end up?",
    );
    fireEvent.change(input, { target: { value: "up to 1km" } });
    fireEvent.click(screen.getByRole("button", { name: "Build my walk" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const body = JSON.parse((fetchMock.mock.calls[2][1] as { body: string }).body);
    expect(body.knownDurationMinutes).toBe(180);
    expect(body.knownMaxEndDistanceKm).toBeNull();
  });

  // Turn two names no places. Reading its reply as a place list would empty
  // the one the walker just built.
  it("keeps the stops turn one found", async () => {
    const onAcceptAttractions = vi.fn();
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
      { followUp: true, durationMinutes: 180, maxEndDistanceKm: 1 },
    ]);
    renderPanel({ onAcceptAttractions });
    await answerTheChips();

    const input = await screen.findByLabelText(
      "How much time do you have, and how far do you want to end up?",
    );
    fireEvent.change(input, { target: { value: "3 hours, up to 1km" } });
    fireEvent.click(screen.getByRole("button", { name: "Build my walk" }));

    await waitFor(() =>
      expect(onAcceptAttractions).toHaveBeenCalledWith(FOUND),
    );
    expect(screen.getByText("זכרון יעקב")).toBeTruthy();
  });

  // A walker who dropped a wrong place before answering meant it.
  it("hands over only the stops still on the list", async () => {
    const onAcceptAttractions = vi.fn();
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
      { followUp: true, durationMinutes: 180, maxEndDistanceKm: 1 },
    ]);
    renderPanel({ onAcceptAttractions });
    await answerTheChips();

    fireEvent.click(
      await screen.findByRole("button", { name: "Remove זכרון יעקב" }),
    );
    const input = screen.getByLabelText(
      "How much time do you have, and how far do you want to end up?",
    );
    fireEvent.change(input, { target: { value: "3 hours, up to 1km" } });
    fireEvent.click(screen.getByRole("button", { name: "Build my walk" }));

    await waitFor(() =>
      expect(onAcceptAttractions).toHaveBeenCalledWith([FOUND[0], FOUND[1]]),
    );
  });

  it("takes the question down once it has been answered", async () => {
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
      { followUp: true, durationMinutes: 180, maxEndDistanceKm: 1 },
    ]);
    renderPanel();
    await answerTheChips();

    const input = await screen.findByLabelText(
      "How much time do you have, and how far do you want to end up?",
    );
    fireEvent.change(input, { target: { value: "3 hours, up to 1km" } });
    fireEvent.click(screen.getByRole("button", { name: "Build my walk" }));

    await waitFor(() =>
      expect(screen.queryByText(/How much time do you have/)).toBeNull(),
    );
  });

  it("cannot be sent empty", async () => {
    stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
    ]);
    renderPanel();
    await answerTheChips();

    await screen.findByText(
      "How much time do you have, and how far do you want to end up?",
    );
    expect(
      (screen.getByRole("button", { name: "Build my walk" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  // Starting over is starting over — the old conversation's answers must not
  // leak into the new prompt's.
  it("forgets the conversation when a fresh prompt is run", async () => {
    const fetchMock = stubExtract([
      CHIPS_UP,
      {
        attractions: FOUND,
        unresolvedNames: [],
        durationMinutes: null,
        maxEndDistanceKm: null,
      },
      {
        attractions: FOUND,
        unresolvedNames: [],
        needsClarification: false,
        clarificationCategories: [],
      },
    ]);
    renderPanel();
    await answerTheChips();

    await screen.findByText(
      "How much time do you have, and how far do you want to end up?",
    );
    fireEvent.change(screen.getByRole("textbox", { name: "" }), {
      target: { value: "הבימה בתל אביב" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));

    await waitFor(() =>
      expect(screen.queryByText(/How much time do you have/)).toBeNull(),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

// The persisted half of the log. In-memory stays the render source; the account
// is a hydration seed on mount plus a write mirror on every turn.
describe("PlacePromptPanel — persisted history", () => {
  interface Call {
    url: string;
    method: string;
    body: unknown;
  }

  const STORED = [
    {
      id: "row-1",
      turn: "prompt",
      prompt: "A walk in Jaffa",
      responseSummary: "Found 3 stops",
      timestamp: 1_770_000_000_000,
    },
    {
      id: "row-2",
      turn: "chip",
      prompt: "A walk in Jaffa — Food",
      responseSummary: "Found 4 stops",
      timestamp: 1_770_000_100_000,
    },
  ];

  /**
   * One fetch stub for both endpoints, routed the way the browser would route
   * them, recording every call so the tests can assert on what the panel sent
   * rather than on which of its internals ran.
   */
  function stubApi(history: unknown = []) {
    const calls: Call[] = [];

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({
        url,
        method,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : null,
      });

      if (url === "/api/prompt-history") {
        return { ok: true, json: async () => history };
      }

      return {
        ok: true,
        json: async () => ({ attractions: FOUND, unresolvedNames: [] }),
      };
    });

    vi.stubGlobal("fetch", fetchMock);
    return calls;
  }

  function renderPanel(
    props: { persistHistory?: boolean; isSignedIn?: boolean } = {},
  ) {
    render(
      <PlacePromptPanel
        nearLocation={null}
        acceptedAttractions={null}
        onAcceptAttractions={vi.fn()}
        onPreview={vi.fn()}
        onFoundPlacesChange={vi.fn()}
        {...props}
      />,
    );
  }

  function sendPrompt(text: string) {
    fireEvent.change(screen.getByRole("textbox", { name: "" }), {
      target: { value: text },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
  }

  async function openLog() {
    fireEvent.click(
      await screen.findByRole("button", { name: /Recent requests/ }),
    );
  }

  function log() {
    return within(screen.getByRole("list", { name: "Recent requests" }));
  }

  const historyCalls = (calls: Call[]) =>
    calls.filter((call) => call.url === "/api/prompt-history");

  it("renders the stored requests on mount, oldest first", async () => {
    stubApi(STORED);
    renderPanel({ persistHistory: true, isSignedIn: true });

    await openLog();

    const entries = log().getAllByRole("listitem");
    expect(entries).toHaveLength(2);
    expect(entries[0].textContent).toContain("A walk in Jaffa");
    expect(entries[1].textContent).toContain("A walk in Jaffa — Food");
  });

  // The whole point of the signed-out path staying byte-identical to what it
  // was before any of this existed.
  it("fetches nothing for a walker who is not signed in", async () => {
    const calls = stubApi(STORED);
    renderPanel({ persistHistory: true, isSignedIn: false });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "" })).toBeTruthy();
    });
    expect(historyCalls(calls)).toEqual([]);
    expect(screen.queryByRole("button", { name: /Recent requests/ })).toBeNull();
  });

  it("fetches nothing when the walker has turned persistence off", async () => {
    const calls = stubApi(STORED);
    renderPanel({ persistHistory: false, isSignedIn: true });

    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: "" })).toBeTruthy();
    });
    expect(historyCalls(calls)).toEqual([]);
  });

  it("mirrors a new prompt to the account with the turn it came from", async () => {
    const calls = stubApi([]);
    renderPanel({ persistHistory: true, isSignedIn: true });
    sendPrompt("מדרחוב בזכרון יעקב");

    await openLog();

    const post = historyCalls(calls).find((call) => call.method === "POST");
    expect(post?.body).toEqual({
      turn: "prompt",
      prompt: "מדרחוב בזכרון יעקב",
      responseSummary: "Found 3 stops",
      persistHistory: true,
    });
  });

  it("mirrors nothing when persistence is off, but still logs locally", async () => {
    const calls = stubApi([]);
    renderPanel({ persistHistory: false, isSignedIn: true });
    sendPrompt("מדרחוב בזכרון יעקב");

    await openLog();

    expect(log().getByText("Found 3 stops")).toBeTruthy();
    expect(historyCalls(calls)).toEqual([]);
  });

  // The local append is instant and unconditional; the mirror is a side effect
  // that must never surface as an error the walker has to read.
  it("keeps the local entry when the mirror write fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/prompt-history") {
          throw new Error("offline");
        }
        return {
          ok: true,
          json: async () => ({ attractions: FOUND, unresolvedNames: [] }),
        };
      }),
    );
    renderPanel({ persistHistory: true, isSignedIn: true });
    sendPrompt("מדרחוב בזכרון יעקב");

    await openLog();

    expect(log().getByText("Found 3 stops")).toBeTruthy();
    expect(screen.queryByText(/offline/)).toBeNull();
  });

  // A slow history fetch must not land on top of what the walker did in the
  // meantime: the words they just typed are the thing they are looking at.
  it("never replaces a prompt sent while the history fetch was still in flight", async () => {
    let releaseHistory = () => {};
    const historyLanded = new Promise<void>((resolve) => {
      releaseHistory = resolve;
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === "/api/prompt-history") {
          await historyLanded;
          return { ok: true, json: async () => STORED };
        }
        return {
          ok: true,
          json: async () => ({ attractions: FOUND, unresolvedNames: [] }),
        };
      }),
    );

    renderPanel({ persistHistory: true, isSignedIn: true });
    sendPrompt("מדרחוב בזכרון יעקב");
    await openLog();

    releaseHistory();
    await waitFor(() => {
      expect(log().getAllByRole("listitem")).toHaveLength(1);
    });
    expect(log().getByText("מדרחוב בזכרון יעקב")).toBeTruthy();
  });

  it("clears the list and asks the account to forget it", async () => {
    const calls = stubApi(STORED);
    renderPanel({ persistHistory: true, isSignedIn: true });

    await openLog();
    fireEvent.click(screen.getByRole("button", { name: "Clear history" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Recent requests/ }),
      ).toBeNull();
    });
    expect(
      historyCalls(calls).some((call) => call.method === "DELETE"),
    ).toBe(true);
  });

  // Nothing was ever stored, so there is nothing the button could delete.
  it("offers no clear control for a session-only log", async () => {
    stubApi([]);
    renderPanel({ persistHistory: false, isSignedIn: false });
    sendPrompt("מדרחוב בזכרון יעקב");

    await openLog();

    expect(screen.queryByRole("button", { name: "Clear history" })).toBeNull();
  });
});
