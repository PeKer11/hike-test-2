import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "order", "limit", "eq", "delete"]) chain[m] = () => chain;
  chain.then = (resolve: (v: unknown) => void) => resolve({ data: [] });
  return { createClient: () => ({ from: () => chain }) };
});

import { AssistantChat } from "@/components/assistant/AssistantChat";

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const props = {
  origin: { lat: 32.08, lng: 34.78 },
  isBuilding: false,
  onPlacesChange: vi.fn(),
  onBuild: vi.fn(),
  onFocusPlace: vi.fn(),
  walkReady: false,
  onStart: vi.fn(),
  onSetOrigin: vi.fn(),
};

function failWith(status: number, body: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

async function sendHebrew() {
  render(<AssistantChat {...props} lang="he" />);
  fireEvent.change(screen.getByPlaceholderText(/כיכר הבימה/), { target: { value: "קפה ליד הים" } });
  fireEvent.click(screen.getByRole("button", { name: "שליחה" }));
}

describe("assistant errors in the Hebrew UI", () => {
  it("a provider failure shows a Hebrew line, never the server's English text", async () => {
    failWith(502, { code: "llm_unavailable", error: "The assistant could not answer. Try again." });
    await sendHebrew();
    await waitFor(() => expect(screen.getByText("העוזר לא זמין כרגע, נסו שוב")).toBeTruthy());
    expect(screen.queryByText(/could not answer/)).toBeNull();
  });

  it("an unknown server error shows the generic Hebrew line, not the server's text", async () => {
    failWith(500, { error: "Something odd in English" });
    await sendHebrew();
    await waitFor(() => expect(screen.getByText("משהו השתבש. נסו שוב.")).toBeTruthy());
    expect(screen.queryByText(/odd in English/)).toBeNull();
  });
});

describe("assistant errors in the English UI", () => {
  it("a provider failure shows the English aiDown line", async () => {
    failWith(502, { code: "llm_unavailable", error: "x" });
    render(<AssistantChat {...props} />);
    fireEvent.change(screen.getByPlaceholderText(/Habima/), { target: { value: "cafe" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByText("The assistant isn't available right now, try again.")).toBeTruthy());
  });
});
