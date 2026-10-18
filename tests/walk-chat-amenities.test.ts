import { describe, expect, it } from "vitest";

import { chatAmenityItems } from "@/lib/walk/chat/amenities";
import { at, item } from "./helpers/discovery";

describe("chatAmenityItems", () => {
  it("includes food places without any consent flag, next to OSM amenities", () => {
    const cafe = item("cafe-1", at(10, 10), { category: "food", tags: { amenity: "cafe" } });
    const out = chatAmenityItems({
      amenities: () => [
        { id: "w", name: "Tap", coordinates: at(5, 5), tags: { amenity: "drinking_water" } } as never,
      ],
      frameOf: () => ({ alongM: 0, lateralM: 0 }),
      items: () => [cafe],
    });
    const kinds = out.map((a) => a.kind);
    expect(kinds).toContain("drinking_water");
    expect(kinds).toContain("cafe");
  });
});
