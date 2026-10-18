import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlacePromptPanel } from "@/components/route/PlacePromptPanel";

const CHIPS_UP = {
  attractions: [],
  unresolvedNames: [],
  needsClarification: true,
  clarificationCategories: ["nature", "food"],
};
const NO_TIME = { attractions: [], unresolvedNames: [], durationMinutes: null, maxEndDistanceKm: null };
const QUESTION = "How much time do you have, and how far do you want to end up?";

type Reply = { ok: boolean; status?: number; json: () => Promise<unknown> };

function jsonReply(body: unknown): Reply {
  return { ok: true, json: async () => body };
}

function render3(thirdTurn: (signal: AbortSignal | undefined) => Promise<Reply>) {
  const replies = [jsonReply(CHIPS_UP), jsonReply(NO_TIME)];
  const fetchMock = vi.fn(async (_url: string, init?: { signal?: AbortSignal }) =>
    replies.length > 0 ? replies.shift()! : thirdTurn(init?.signal),
  );
  vi.stubGlobal("fetch", fetchMock);
  render(
    <PlacePromptPanel
      nearLocation={null}
      acceptedAttractions={null}
      onAcceptAttractions={vi.fn()}
      onPreview={vi.fn()}
      onFoundPlacesChange={vi.fn()}
    />,
  );
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "walk in town" } });
  fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
  return fetchMock;
}

async function reachFollowUp() {
  await screen.findByText(/What kind of walk are you after\?/);
  fireEvent.click(screen.getByRole("button", { name: "Food" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  const input = await screen.findByLabelText(QUESTION);
  fireEvent.change(input, { target: { value: "3 hours, up to 1km" } });
  fireEvent.click(screen.getByRole("button", { name: "Use these answers" }));
}

beforeEach(() => vi.useRealTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("PlacePromptPanel follow-up reply", () => {
  it("says what it understood and what to press, even with no stops yet", async () => {
    render3(async () =>
      jsonReply({ followUp: true, durationMinutes: 180, maxEndDistanceKm: 1 }),
    );
    await reachFollowUp();

    const status = await screen.findByRole("status");
    expect(status.textContent).toContain("180 min");
    expect(status.textContent).toContain("finish within 1 km");
    expect(status.textContent).toContain("Build My Walk");
    expect(status.textContent).toContain("it will pick the places");
  });

  it("clears the follow-up reply when the walker edits the main prompt", async () => {
    render3(async () => jsonReply({ followUp: true, durationMinutes: 180, maxEndDistanceKm: 1 }));
    await reachFollowUp();
    await screen.findByRole("status");
    fireEvent.change(screen.getByPlaceholderText(/Habima Square/), { target: { value: "something else" } });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("clears the follow-up reply when a new submit starts", async () => {
    const fetchMock = render3(async () =>
      jsonReply({ followUp: true, durationMinutes: 180, maxEndDistanceKm: 1 }),
    );
    await reachFollowUp();
    await screen.findByRole("status");
    fetchMock.mockImplementation(() => new Promise(() => {}) as never);
    // The box empties after each send, so a new submit needs new text.
    fireEvent.change(screen.getByPlaceholderText(/Habima Square/), { target: { value: "another walk" } });
    fireEvent.click(screen.getByRole("button", { name: "Find these places" }));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("waits beyond 45 seconds and shows a friendly timeout after two minutes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render3(
      (signal) =>
        new Promise<Reply>((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    await reachFollowUp();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(45_000);
    });
    expect(screen.queryByText(/That took too long/)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(74_000);
    });
    expect(screen.queryByText(/That took too long/)).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });

    expect(await screen.findByText(/That took too long/)).toBeTruthy();
  });

  it("shows friendly text, not a JSON parse error, when a 502 returns HTML", async () => {
    render3(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token '<'");
      },
    }));
    await reachFollowUp();

    expect(await screen.findByText("Failed to read that.")).toBeTruthy();
    expect(screen.queryByText(/Unexpected token/)).toBeNull();
  });

  it("uses the rate-limit wording for a 429 with no body", async () => {
    render3(async () => ({
      ok: false,
      status: 429,
      json: async () => {
        throw new SyntaxError("empty");
      },
    }));
    await reachFollowUp();

    expect(await screen.findByText(/Too many requests/)).toBeTruthy();
  });
});
