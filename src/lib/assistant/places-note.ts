import type { SavedPlace } from "@/lib/places/saved-places";

const MAX_NAMES = 12;

const names = (places: SavedPlace[]) =>
  places
    .slice(0, MAX_NAMES)
    .map((p) => p.label.replace(/[\r\n;]+/g, " ").trim().slice(0, 60))
    .filter(Boolean)
    .join("; ");

/** Prompt line about the walker's saved places (wishlist and already visited); empty when there are none. */
export function placesNote(places: SavedPlace[]): string {
  const wishlist = places.filter((p) => !p.visitedAt);
  const visited = places.filter((p) => p.visitedAt);
  const parts: string[] = [];
  if (wishlist.length) parts.push(`Places they saved and want to visit: ${names(wishlist)}.`);
  if (visited.length) parts.push(`Places they already visited (do not propose again unless asked): ${names(visited)}.`);
  return parts.length ? `\n${parts.join(" ")}` : "";
}
