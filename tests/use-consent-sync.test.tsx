import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useConsentSync } from "@/lib/hooks/useConsentSync";

afterEach(() => vi.unstubAllGlobals());

describe("useConsentSync", () => {
  it("sends granted once when signed in and loaded", () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = renderHook(({ on }) => useConsentSync(on, "granted", true), { initialProps: { on: true } });
    rerender({ on: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual({ consent: "granted" });
  });

  it("sends nothing while unset or not loaded, and declined when learning is switched off", () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    renderHook(() => useConsentSync(true, "unset", true));
    renderHook(() => useConsentSync(false, "granted", true));
    expect(fetchMock).not.toHaveBeenCalled();
    renderHook(() => useConsentSync(true, "granted", false));
    expect(JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body)).toEqual({ consent: "declined" });
  });
});
