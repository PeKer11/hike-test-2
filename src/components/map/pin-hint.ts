/** The line a stop's info window shows about pinning, in the walker's language. */
export function pinHint(lang: string, pinned: boolean): string {
  if (lang === "he") {
    return pinned
      ? "נעוץ — יישאר כשהמסלול ייבנה מחדש. הקישו שוב לביטול."
      : "הקישו כדי לנעוץ — העצירה תישאר גם כשהמסלול ייבנה מחדש.";
  }
  return pinned
    ? "Pinned — kept when the walk is rebuilt. Tap again to unpin."
    : "Tap to pin — keeps this stop when the walk is rebuilt.";
}
