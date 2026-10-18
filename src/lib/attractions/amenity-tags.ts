/** Amenity tags the companion can send a walker to. */
export function amenityKindOfTags(
  tags: Record<string, string>,
): "drinking_water" | "toilets" | null {
  if (tags.amenity === "drinking_water") return "drinking_water";
  if (tags.amenity === "toilets") return "toilets";
  return null;
}
