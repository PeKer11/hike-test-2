import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HikeSearchPanel } from "@/components/route/HikeSearchPanel";

afterEach(() => {
  cleanup();
});

describe("HikeSearchPanel validation", () => {
  it("rejects out-of-range latitude/longitude", () => {
    const onFindHike = vi.fn();
    render(<HikeSearchPanel isSearching={false} onFindHike={onFindHike} />);

    fireEvent.change(screen.getByPlaceholderText("Origin lat"), {
      target: { value: "999" },
    });
    fireEvent.change(screen.getByPlaceholderText("Origin lng"), {
      target: { value: "999" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(screen.getByText("Latitude must be between -90 and 90.")).toBeTruthy();
    expect(screen.getByText("Longitude must be between -180 and 180.")).toBeTruthy();
    expect(onFindHike).not.toHaveBeenCalled();
  });

  it("rejects partial endpoint input", () => {
    const onFindHike = vi.fn();
    render(<HikeSearchPanel isSearching={false} onFindHike={onFindHike} />);

    fireEvent.change(screen.getByPlaceholderText("Endpoint lat (optional)"), {
      target: { value: "31.7" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(screen.getByText("Endpoint longitude is required.")).toBeTruthy();
    expect(onFindHike).not.toHaveBeenCalled();
  });

  it("rejects non-positive max distance", () => {
    const onFindHike = vi.fn();
    render(<HikeSearchPanel isSearching={false} onFindHike={onFindHike} />);

    fireEvent.change(screen.getByPlaceholderText("Max distance km (optional)"), {
      target: { value: "0" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(screen.getByText("Max distance must be greater than 0.")).toBeTruthy();
    expect(onFindHike).not.toHaveBeenCalled();
  });

  it("accepts valid coordinates and submits", () => {
    const onFindHike = vi.fn();
    render(<HikeSearchPanel isSearching={false} onFindHike={onFindHike} />);

    fireEvent.change(screen.getByPlaceholderText("Origin lat"), {
      target: { value: "31.7683" },
    });
    fireEvent.change(screen.getByPlaceholderText("Origin lng"), {
      target: { value: "35.2137" },
    });
    fireEvent.change(screen.getByPlaceholderText("Endpoint lat (optional)"), {
      target: { value: "31.77" },
    });
    fireEvent.change(screen.getByPlaceholderText("Endpoint lng (optional)"), {
      target: { value: "35.22" },
    });
    fireEvent.change(screen.getByPlaceholderText("Max distance km (optional)"), {
      target: { value: "10" },
    });

    fireEvent.click(screen.getByText("Find Best Hike"));

    expect(onFindHike).toHaveBeenCalledTimes(1);
  });
});
