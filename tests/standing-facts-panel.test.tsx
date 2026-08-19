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

function stubApi(facts: unknown, deleteResult: "ok" | "refused" | "throws" = "ok") {
  const calls: Call[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? "GET";
      calls.push({ url, method });

      if (method === "DELETE") {
        if (deleteResult === "throws") throw new Error("offline");
        // What the route now answers when the row survived the delete.
        return deleteResult === "ok"
          ? { ok: true, status: 204, json: async () => ({}) }
          : { ok: false, status: 500, json: async () => ({}) };
      }

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

  // The optimistic removal has to be reversible. A fact that survived the
  // delete still goes in front of the model on every walk the walker builds,
  // and an empty row where it used to be tells them the opposite.
  it("puts the fact back and says so when the account refuses the delete", async () => {
    stubApi([fact()], "refused");
    renderPanel();

    await open();
    fireEvent.click(
      screen.getByRole("button", { name: 'Forget "does not eat meat"' }),
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain(
      "does not eat meat",
    );
    expect(list().getByText(/does not eat meat/)).toBeTruthy();
  });

  it("puts the fact back when the delete never reaches the account", async () => {
    stubApi([fact()], "throws");
    renderPanel();

    await open();
    fireEvent.click(
      screen.getByRole("button", { name: 'Forget "does not eat meat"' }),
    );

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(list().getByText(/does not eat meat/)).toBeTruthy();
  });

  it("restores a refused delete to its place in the newest-heard order", async () => {
    stubApi(
      [
        fact({ id: "fact-dog", text: "always walks with a dog" }),
        fact({ lastSeenAt: Date.now() - 3 * DAY_MS }),
      ],
      "refused",
    );
    renderPanel();

    await open();
    fireEvent.click(
      screen.getByRole("button", { name: 'Forget "always walks with a dog"' }),
    );

    await screen.findByRole("alert");
    expect(
      list()
        .getAllByRole("listitem")
        .map((item) => item.textContent?.slice(0, 12)),
    ).toEqual(["always walks", "does not eat"]);
  });

  it("says nothing when the delete lands", async () => {
    stubApi([fact(), fact({ id: "fact-dog", text: "always walks with a dog" })]);
    renderPanel();

    await open();
    fireEvent.click(
      screen.getByRole("button", { name: 'Forget "does not eat meat"' }),
    );

    await waitFor(() => {
      expect(list().queryByText(/does not eat meat/)).toBeNull();
    });
    expect(screen.queryByRole("alert")).toBeNull();
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
