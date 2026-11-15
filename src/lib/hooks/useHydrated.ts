import { useSyncExternalStore } from "react";

const subscribe = () => () => undefined;

/**
 * False in the server HTML and until React has hydrated the page, true after.
 *
 * Why it exists: a form that is rendered on the server can be typed into and
 * tapped before its handlers are attached. On a slow phone or tablet that
 * window lasts seconds. The tap then does nothing (a disabled button), or the
 * browser submits the form itself, and hydration later wipes what was typed.
 * Controls that depend on a handler should stay disabled until this is true.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
