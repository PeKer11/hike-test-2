"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { OVERVIEW_HOLD_MS } from "@/lib/map/route-overview";

/** After the walker lets go of the map, following picks up again this much later. */
export const FOLLOW_RESUME_MS = 15_000;

/**
 * Whether the map should keep following the walker. A drag turns it off, as before, but it no
 * longer stays off for the rest of the walk: it resumes `FOLLOW_RESUME_MS` after the drag ends,
 * when the page becomes visible again (back from another app), or on the re-centre tap.
 * `hold` is the "whole route" view: the map is held off the walker for a long, set time (not the 15 s of a drag), and
 * `held` says so, for the glyph's pressed state. Shared by both map views so they cannot drift.
 */
export function useFollowPause() {
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
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
    setHeld(false);
  }, [clear]);

  /** A drag ended: follow again after a while if nothing else touches the map. */
  const scheduleResume = useCallback(() => {
    clear();
    setHeld(false);
    timer.current = setTimeout(() => {
      timer.current = null;
      setPaused(false);
    }, FOLLOW_RESUME_MS);
  }, [clear]);

  /** Hold the map off the walker for `ms` (default a minute): the "whole route" view. A drag or any resume ends it sooner. */
  const hold = useCallback(
    (ms: number = OVERVIEW_HOLD_MS) => {
      clear();
      setPaused(true);
      setHeld(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        setPaused(false);
        setHeld(false);
      }, ms);
    },
    [clear],
  );

  /** Follow again now. */
  const resume = useCallback(() => {
    clear();
    setPaused(false);
    setHeld(false);
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

  return { paused, held, pause, scheduleResume, hold, resume };
}
