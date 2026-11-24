import { act, cleanup, render } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { WalkerMarkerShape } from "@/components/map/WalkerMarker";
import { createHeadingStore } from "@/lib/walk/heading-store";

afterEach(cleanup);
const beam = () => document.querySelector("[data-testid=walker-beam]") as HTMLElement | null;

describe("the beam turned from a heading store", () => {
  it("rotates the beam by writing style.transform; WalkerMarkerShape renders once for 100 store updates", () => {
    const store = createHeadingStore();
    let renders = 0;
    render(
      <Profiler id="m" onRender={() => renders++}>
        <WalkerMarkerShape headingStore={store} />
      </Profiler>,
    );
    const el = beam()!;
    expect(el.style.display).toBe("none"); // no heading yet: hidden, but the element is there
    expect(renders).toBe(1);
    act(() => store.set(10));
    expect(el.style.display).toBe("");
    for (let i = 1; i <= 100; i++) act(() => store.set(10 + i));
    expect(el.style.transform).toBe("rotate(110deg)");
    expect(renders).toBe(1);
    expect(beam()).toBe(el); // the same element, never replaced
  });

  it("hides the beam again when the heading goes away", () => {
    const store = createHeadingStore();
    render(<WalkerMarkerShape headingStore={store} />);
    act(() => store.set(90));
    expect(beam()!.style.display).toBe("");
    act(() => store.set(null));
    expect(beam()!.style.display).toBe("none");
  });

  it("starts at the store's current value", () => {
    const store = createHeadingStore();
    store.set(45);
    render(<WalkerMarkerShape headingStore={store} />);
    expect(beam()!.style.transform).toBe("rotate(45deg)");
  });

  it("has no CSS transition of its own: the loop's easing is the smoothing", () => {
    const store = createHeadingStore();
    store.set(45);
    render(<WalkerMarkerShape headingStore={store} />);
    expect(beam()!.style.transition).toBe("");
  });
});
