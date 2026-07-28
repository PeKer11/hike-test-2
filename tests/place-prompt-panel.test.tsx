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

function renderPanel(onAcceptAttractions = vi.fn()) {
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
});
