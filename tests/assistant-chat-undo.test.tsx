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

describe("undo send", () => {
  it("aborts the request, removes the message and puts the text back", async () => {
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        signal = init.signal as AbortSignal;
        return new Promise((_resolve, reject) => signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
      }),
    );
    render(<AssistantChat {...props} />);
    const box = screen.getByPlaceholderText(/Habima/) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: "cafe near the sea" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Undo send" })).toBeTruthy());
    expect(box.value).toBe("");

    fireEvent.click(screen.getByRole("button", { name: "Undo send" }));

    await waitFor(() => expect(box.value).toBe("cafe near the sea"));
    expect(signal?.aborted).toBe(true);
    expect(screen.queryByText("cafe near the sea", { selector: "p, div, span" })).toBeNull();
    expect(screen.queryByText(/Could not reach/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Undo send" })).toBeNull();
  });
});
