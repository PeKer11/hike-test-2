import type { Page } from "@playwright/test";

/**
 * Patterns React and Next use to say "the server and the client disagreed".
 *
 * A production build does not print the friendly sentence -- React 19 minifies
 * it down to an error number and a link -- so both forms are listed. 418/423
 * are the hydration-mismatch pair, 425 is the text-content variant, which is
 * precisely the shape the `useWalkSettings` bug took: settings read from
 * localStorage rendered as text the server could not have produced.
 */
const HYDRATION_PATTERNS = [
  /hydrat/i,
  /did not match/i,
  /server rendered HTML/i,
  /Minified React error #(418|421|423|425)/,
  /react\.dev\/errors\/(418|421|423|425)/,
];

export interface ConsoleWatch {
  /** Everything the page logged at error level, plus any uncaught exception. */
  errors: string[];
  /** The subset of `errors` that is a hydration complaint. */
  hydrationErrors: string[];
}

/**
 * Start listening before the first navigation.
 *
 * Hydration errors are logged once, during the first client render, so a
 * listener attached after `page.goto` resolves has already missed them. Call
 * this on a fresh page and navigate afterwards.
 */
export function watchConsole(page: Page): ConsoleWatch {
  const watch: ConsoleWatch = { errors: [], hydrationErrors: [] };

  const record = (text: string) => {
    watch.errors.push(text);
    if (HYDRATION_PATTERNS.some((pattern) => pattern.test(text))) {
      watch.hydrationErrors.push(text);
    }
  };

  page.on("console", (message) => {
    if (message.type() === "error") record(message.text());
  });

  // An uncaught exception never reaches the console listener above, and a
  // component that throws while hydrating fails exactly this way.
  page.on("pageerror", (error) => record(`pageerror: ${error.message}`));

  return watch;
}

/**
 * Console noise this suite tolerates.
 *
 * Deliberately short. Every entry is something the browser reports about the
 * network rather than about the app's own code -- an OpenStreetMap tile the
 * runner could not reach says nothing about whether the page hydrated. Anything
 * originating in this app belongs in the failure list, not here.
 */
const IGNORED_ERROR_PATTERNS = [
  /Failed to load resource/i,
  /net::ERR_/i,
  /tile\.openstreetmap/i,
];

export function appErrors(watch: ConsoleWatch): string[] {
  return watch.errors.filter(
    (text) => !IGNORED_ERROR_PATTERNS.some((pattern) => pattern.test(text)),
  );
}
