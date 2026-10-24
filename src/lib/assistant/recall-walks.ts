import type { SavedWalk } from "@/lib/walks/saved-walks";

/** Loads the signed-in walker's own saved walks, newest first (empty when none or on any failure). */
export type LoadWalks = () => Promise<SavedWalk[]>;

/** What the model sees per walk: no coordinates, no place ids. */
export function formatRecalledWalks(walks: SavedWalk[], limit: number, contains?: string) {
  const q = contains?.trim().toLowerCase();
  return walks
    .filter((w) => !q || w.title.toLowerCase().includes(q) || w.stops.some((s) => s.name.toLowerCase().includes(q)))
    .slice(0, limit)
    .map((w) => ({
      title: w.title,
      date: w.createdAt.slice(0, 10),
      areaLabel: w.areaLabel,
      totalMin: w.totalMin,
      stops: w.stops.map((s) => ({ name: s.name, category: s.category })),
    }));
}
