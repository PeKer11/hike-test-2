import type { AttractionCategory, Coordinates } from "@/lib/types";
import type { DiscoveryCollection, DiscoveryItem } from "@/lib/types/discovery";
import { emptyCollection } from "@/lib/walk/discovery-collection";

export const LAT0 = 32.08;
export const LNG0 = 34.78;
const M_LAT = (Math.PI / 180) * 6_371_000;
const M_LNG = M_LAT * Math.cos((LAT0 * Math.PI) / 180);

/** A point `east` / `north` metres from the fixture origin. */
export function at(east: number, north: number): Coordinates {
  return { lat: LAT0 + north / M_LAT, lng: LNG0 + east / M_LNG };
}

export function item(
  id: string,
  coordinates: Coordinates,
  over: Partial<DiscoveryItem> & { category?: AttractionCategory; name?: string; tags?: Record<string, string> } = {},
): DiscoveryItem {
  const { category, name, tags, ...rest } = over;
  return {
    id,
    attraction: {
      id,
      name: name ?? id,
      coordinates,
      category: category ?? "food",
      avgVisitMinutes: 10,
      tags: tags ?? {},
    },
    kind: "poi",
    tier: "registered",
    sources: ["osm"],
    notable: false,
    score: 1,
    frame: null,
    detourMin: 0,
    state: "new",
    ...rest,
  };
}

export function collectionOf(items: DiscoveryItem[]): DiscoveryCollection {
  const col = emptyCollection();
  for (const i of items) col.items.set(i.id, i);
  return col;
}
