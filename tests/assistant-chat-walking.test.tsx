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

const A = { lat: 32.081, lng: 34.78 };
const reply = (params: Record<string, unknown>) => ({
  chatId: "c1",
  reply: "ok",
  state: { origin: { lat: 32.08, lng: 34.78 }, candidates: [], params: {} },
  action: {
    origin: { lat: 32.08, lng: 34.78 },
    params,
    stops: [{ id: "c1", name: "A", coordinates: A, category: "food", placeId: "p" }],
  },
});

async function sendOnce(responseBody: unknown, extraProps: Record<string, unknown> = {}) {
  const onBuild = vi.fn();
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => responseBody }));
  vi.stubGlobal("fetch", fetchMock);
  render(
    <AssistantChat
      origin={{ lat: 32.08, lng: 34.78 }}
      isBuilding={false}
      onPlacesChange={vi.fn()}
      onBuild={onBuild}
      onFocusPlace={vi.fn()}
      walkReady={false}
      onStart={vi.fn()}
      onSetOrigin={vi.fn()}
      {...extraProps}
    />,
  );
  fireEvent.change(screen.getByPlaceholderText(/Habima/), { target: { value: "I walk 2 km/h" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(onBuild).toHaveBeenCalled());
  return { onBuild, body: JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string) };
}

describe("the assistant chat mid-walk", () => {
  it("sends the walk's remaining stops as queued, with walking: true", async () => {
    const { body } = await sendOnce(reply({}), {
      walking: true,
      queuedPlaces: [{ name: "Old Cathedral", coordinates: A }],
    });
    expect(body.walking).toBe(true);
    expect(body.queued).toEqual([{ name: "Old Cathedral", coordinates: A }]);
  });

  it("marks a stated pace as explicit, and a build without one as not", async () => {
    expect((await sendOnce(reply({ paceMinPerKm: 30 }))).onBuild.mock.calls[0][0]).toMatchObject({
      paceExplicit: true,
      walkingPaceMinPerKm: 30,
    });
    cleanup();
    expect((await sendOnce(reply({}))).onBuild.mock.calls[0][0].paceExplicit).toBe(false);
  });
});
