"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** After the walker lets go of the map, following picks up again this much later. */
export const FOLLOW_RESUME_MS = 15_000;

/**
 * Whether the map should keep following the walker. A drag turns it off, as before, but it no
 * longer stays off for the rest of the walk: it resumes `FOLLOW_RESUME_MS` after the drag ends,
 * when the page becomes visible again (back from another app), or on the re-centre tap.
 * Shared by both map views so they cannot drift.
 */
export function useFollowPause() {
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  /** A drag started. */
  const pause = useCallback(() => {
    clear();
    setPaused(true);
  }, [clear]);

  /** A drag ended: follow again after a while if nothing else touches the map. */
  const scheduleResume = useCallback(() => {
    clear();
    timer.current = setTimeout(() => {
      timer.current = null;
      setPaused(false);
    }, FOLLOW_RESUME_MS);
  }, [clear]);

  /** Follow again now. */
  const resume = useCallback(() => {
    clear();
    setPaused(false);
  }, [clear]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") resume();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clear();
    };
  }, [resume, clear]);

  return { paused, pause, scheduleResume, resume };
}
