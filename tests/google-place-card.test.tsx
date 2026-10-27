import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function renderCard(placeId: string) {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY", "test-key");
  const { GooglePlaceCard } = await import("@/components/map/GooglePlaceCard");
  return render(<GooglePlaceCard name="Cafe" lat={32} lng={34} placeId={placeId} />);
}

describe("GooglePlaceCard place id", () => {
  it("never puts a hostile id into the page", async () => {
    const { container } = await renderCard('x" onload="alert(1)');
    expect(container.querySelector("[onload]")).toBeNull();
    expect(container.querySelector("gmp-place-details-compact, gmp-place-details")).toBeNull();
    expect(container.textContent).toMatch(/Could not load Google reviews/);
  });

  it("sets a real id as an attribute", async () => {
    const { container } = await renderCard("ChIJN1t_tDeuEmsRUsoyG83frY4");
    expect(container.querySelector('gmp-place-details-place-request[place="ChIJN1t_tDeuEmsRUsoyG83frY4"]')).not.toBeNull();
  });
});
