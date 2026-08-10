import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
