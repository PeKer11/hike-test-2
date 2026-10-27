/** A log line for an error with coordinates (and other long decimals) blanked out. */
export const redactForLog = (e: unknown): string =>
  (e instanceof Error ? `${e.name}: ${e.message}` : String(e)).replace(/-?\d{1,3}\.\d{3,}/g, "~").slice(0, 300);
