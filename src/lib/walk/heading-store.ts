/**
 * A tiny external store for the walker's heading. The beam turns 60 times a second while the phone turns; routing that
 * through React state re-rendered the whole planner each time. The store lets the marker write its rotation straight to
 * the DOM and leaves React out of it.
 */
export interface HeadingStore {
  /** The heading shown now (unwrapped degrees clockwise from north), or null when there is none. */
  get(): number | null;
  set(value: number | null): void;
  /** Called on every change; returns the unsubscribe. */
  subscribe(listener: (value: number | null) => void): () => void;
}

export function createHeadingStore(): HeadingStore {
  let value: number | null = null;
  const listeners = new Set<(v: number | null) => void>();
  return {
    get: () => value,
    set(next) {
      if (next === value) return;
      value = next;
      for (const l of [...listeners]) l(next);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
