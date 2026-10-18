import type { Coordinates, NearbyPlace } from "@/lib/types";
import type { DiscoveryItem } from "@/lib/types/discovery";
import type { AmenityItem } from "@/lib/walk/companion/amenity-detour";
import { amenityItemsFromPlaces } from "@/lib/walk/companion/companion-glue";
import { foodAmenityItems } from "@/lib/walk/companion/habit-ticker";

interface ChatDiscovery {
  amenities: () => NearbyPlace[];
  frameOf: (p: Coordinates) => { alongM: number; lateralM: number } | null;
  items: () => DiscoveryItem[];
}

/**
 * Amenities for the walk chat. The lookup is on-device, so unlike the companion's
 * tick it does not wait for habit-learning consent before including food places.
 */
export const chatAmenityItems = (discovery: ChatDiscovery): AmenityItem[] => [
  ...amenityItemsFromPlaces(discovery.amenities(), (p) => discovery.frameOf(p)),
  ...foodAmenityItems(discovery.items()),
];
