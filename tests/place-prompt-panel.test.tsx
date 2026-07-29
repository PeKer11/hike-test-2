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
});
