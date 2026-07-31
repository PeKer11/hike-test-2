import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { WalkFeedbackCard } from "@/components/walk/WalkFeedbackCard";
import type { Attraction } from "@/lib/types";

function attraction(id: string, name: string, category: Attraction["category"]) {
  return {
    id,
    name,
    coordinates: { lat: 32.1, lng: 34.79 },
    category,
    avgVisitMinutes: 20,
    tags: {},
  } satisfies Attraction;
}

const attractions = [
  attraction("osm-node-1234567", "Eretz Israel Museum", "museum"),
  attraction("osm-way-99", "Yarkon Park", "park"),
];

const mockFetch = vi.fn();

function renderCard(learnPreferences = true) {
  const onDismiss = vi.fn();
  render(
    <WalkFeedbackCard
      attractions={attractions}
      learnPreferences={learnPreferences}
      onDismiss={onDismiss}
    />,
  );
  return { onDismiss };
}

function lastBody(): Record<string, unknown> {
  const call = mockFetch.mock.calls.at(-1);
  return JSON.parse((call?.[1] as { body: string }).body);
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ saved: true }) });
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WalkFeedbackCard", () => {
  it("offers a rating for every stop the walk contained", () => {
    renderCard();

    expect(screen.getByLabelText("Liked Eretz Israel Museum")).toBeTruthy();
    expect(screen.getByLabelText("Did not like Eretz Israel Museum")).toBeTruthy();
    expect(screen.getByLabelText("Liked Yarkon Park")).toBeTruthy();
  });

  // The rating is about one stop, not about every category the walk contained.
  it("sends only the rated stop, with its own place and coordinates", () => {
    renderCard();

    fireEvent.click(screen.getByLabelText("Did not like Yarkon Park"));

    expect(lastBody()).toEqual({
      ratings: [
        {
          id: "osm-way-99",
          name: "Yarkon Park",
          lat: 32.1,
          lng: 34.79,
          category: "park",
          liked: false,
        },
      ],
      learnPreferences: true,
    });
  });

  // Each tap stands on its own, so a walker who rates one stop and pockets the
  // phone still keeps that one.
  it("sends each tap as it happens", () => {
    renderCard();

    fireEvent.click(screen.getByLabelText("Liked Eretz Israel Museum"));
    fireEvent.click(screen.getByLabelText("Liked Yarkon Park"));

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(
      screen.getByLabelText("Liked Yarkon Park").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("passes preference learning being off through to the server", () => {
    renderCard(false);

    fireEvent.click(screen.getByLabelText("Liked Yarkon Park"));

    expect(lastBody().learnPreferences).toBe(false);
  });

  it("survives a failed send without telling the walker", () => {
    mockFetch.mockRejectedValue(new Error("offline"));
    renderCard();

    fireEvent.click(screen.getByLabelText("Liked Yarkon Park"));

    expect(
      screen.getByLabelText("Liked Yarkon Park").getAttribute("aria-pressed"),
    ).toBe("true");
  });

  it("sends nothing for a walk the walker skips rating", () => {
    const { onDismiss } = renderCard();

    fireEvent.click(screen.getByText("Skip"));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalled();
  });
});
