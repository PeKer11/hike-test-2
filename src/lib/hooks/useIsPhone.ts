"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639px)";

function subscribe(notify: () => void) {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
}

/** True on a phone-width screen (Tailwind's `max-sm`). False on the server, so the first paint matches. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === "function" && window.matchMedia(QUERY).matches,
    () => false,
  );
}
