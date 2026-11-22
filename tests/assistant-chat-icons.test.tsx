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

describe("the assistant chat icons", () => {
  it("shows the standing defaults as a sliders icon with a visible Preferences label (no gear)", () => {
    render(<AssistantChat {...props} />);
    const button = screen.getByRole("button", { name: "Assistant preferences" });
    expect(button.textContent).toBe("Preferences");
    expect(button.querySelector("svg circle")).not.toBeNull(); // the slider knobs are Rings
    expect(button.querySelector("svg[fill=currentColor]")).toBeNull(); // the old gear was a filled polygon
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("says Preferences in Hebrew too", () => {
    render(<AssistantChat {...props} lang="he" />);
    expect(screen.getByRole("button", { name: "העדפות העוזר" }).textContent).toBe("העדפות");
  });

  it("draws Add image and Custom Walk with icons from the set, not emoji", () => {
    render(<AssistantChat {...props} />);
    const add = screen.getByRole("button", { name: "Add image" });
    expect(add.querySelector("svg")).not.toBeNull();
    expect(add.textContent).toBe("Add image");
    const custom = screen.getByRole("button", { name: "Custom Walk" });
    expect(custom.querySelector("svg")).not.toBeNull();
    expect(custom.textContent).toBe("Custom Walk");
  });

  it("draws a warning sign at the start of a reply as the warning icon, with the words after it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ chatId: "c1", reply: "⚠ Changed by the assistant: pace.", state: { origin: props.origin, candidates: [], params: {} } }) })));
    render(<AssistantChat {...props} />);
    fireEvent.change(screen.getByPlaceholderText(/Habima/), { target: { value: "hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    const text = await waitFor(() => screen.getByText(/Changed by the assistant: pace\./));
    expect(text.textContent).toBe("Changed by the assistant: pace.");
    expect(text.querySelector("svg")).not.toBeNull();
  });
});
