import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StandingFactsPanel } from "@/components/StandingFactsPanel";

interface Call {
  url: string;
  method: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function fact(overrides: Record<string, unknown> = {}) {
  return {
    id: "fact-meat",
    text: "does not eat meat",
    key: "does not eat meat",
    importance: 3,
    occurrenceCount: 1,
    lastSeenAt: Date.now(),
    ...overrides,
  };
}

function stubApi(facts: unknown) {
  const calls: Call[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET" });
      return { ok: true, json: async () => facts };
    }),
  );

  return calls;
}

function renderPanel(
  props: { isSignedIn?: boolean; learnPreferences?: boolean } = {},
) {
  render(<StandingFactsPanel isSignedIn learnPreferences {...props} />);
}

async function open() {
  fireEvent.click(
    await screen.findByRole("button", { name: /Things I remember about you/ }),
  );
}

const list = () =>
  within(screen.getByRole("list", { name: "Things I remember about you" }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StandingFactsPanel", () => {
  it("shows what the app remembers, with when it was last heard", async () => {
    stubApi([
      fact(),
      fact({
        id: "fact-dog",
        text: "always walks with a dog",
        lastSeenAt: Date.now() - 3 * DAY_MS,
      }),
    ]);
    renderPanel();

    await open();

    expect(list().getByText(/does not eat meat/)).toBeTruthy();
    expect(list().getByText("heard today")).toBeTruthy();
    expect(list().getByText("heard 3 days ago")).toBeTruthy();
  });

  // Nothing to inspect is nothing to show; an empty "here is what I know about
  // you" box is worse than none.
  it("shows nothing for a walker with no facts on record", async () => {
    stubApi([]);
    renderPanel();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Things I remember about you/ }),
      ).toBeNull();
    });
  });

  it("fetches nothing for a walker who is not signed in", async () => {
    const calls = stubApi([fact()]);
    renderPanel({ isSignedIn: false });

    await waitFor(() => {
      expect(calls).toEqual([]);
    });
    expect(
      screen.queryByRole("button", { name: /Things I remember about you/ }),
    ).toBeNull();
  });

  // The point of the whole panel: a memory that changes results has to be
  // removable by the person it is about.
  it("forgets a fact the walker deletes, here and on the account", async () => {
    const calls = stubApi([fact()]);
    renderPanel();

    await open();
    fireEvent.click(
      screen.getByRole("button", { name: 'Forget "does not eat meat"' }),
    );

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Things I remember about you/ }),
      ).toBeNull();
    });
    expect(calls).toContainEqual({
      url: "/api/standing-facts?id=fact-meat",
      method: "DELETE",
    });
  });

  it("keeps the other facts when one is deleted", async () => {
    stubApi([fact(), fact({ id: "fact-dog", text: "always walks with a dog" })]);
    renderPanel();

    await open();
    fireEvent.click(
      screen.getByRole("button", { name: 'Forget "does not eat meat"' }),
    );

    await waitFor(() => {
      expect(list().queryByText(/does not eat meat/)).toBeNull();
    });
    expect(list().getByText(/always walks with a dog/)).toBeTruthy();
  });

  // Learning off stops new facts being recorded; it does not stop the stored
  // ones being used, and saying otherwise would be a lie.
  it("says the stored facts are still used when learning is off", async () => {
    stubApi([fact()]);
    renderPanel({ learnPreferences: false });

    await open();

    expect(screen.getByText(/these are still used/i)).toBeTruthy();
  });

  it("survives a failed read without breaking the page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    renderPanel();

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /Things I remember about you/ }),
      ).toBeNull();
    });
  });
});
