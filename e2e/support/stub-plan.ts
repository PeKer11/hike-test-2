/** The stubbed walk-plan upstream and start point shared by the phone-walk specs (same data as walk-hud.spec.ts). */
export const ORIGIN = { lat: "32.0779", lng: "34.7742" };

export const STUBBED_PLAN = {
  orderedAttractions: [
    {
      id: "node/1",
      name: "Dizengoff Square",
      coordinates: { lat: 32.078, lng: 34.7743 },
      category: "landmark",
      avgVisitMinutes: 15,
      tags: {},
    },
    {
      id: "node/2",
      name: "Bauhaus Center",
      coordinates: { lat: 32.0791, lng: 34.7736 },
      category: "museum",
      avgVisitMinutes: 25,
      tags: {},
    },
  ],
  segments: [
    {
      from: { name: "origin", coordinates: { lat: 32.0779, lng: 34.7742 } },
      to: {
        id: "node/1",
        name: "Dizengoff Square",
        coordinates: { lat: 32.078, lng: 34.7743 },
        category: "landmark",
        avgVisitMinutes: 15,
        tags: {},
      },
      distanceMeters: 120,
      walkingMinutes: 2,
    },
    {
      from: {
        id: "node/1",
        name: "Dizengoff Square",
        coordinates: { lat: 32.078, lng: 34.7743 },
        category: "landmark",
        avgVisitMinutes: 15,
        tags: {},
      },
      to: {
        id: "node/2",
        name: "Bauhaus Center",
        coordinates: { lat: 32.0791, lng: 34.7736 },
        category: "museum",
        avgVisitMinutes: 25,
        tags: {},
      },
      distanceMeters: 340,
      walkingMinutes: 5,
    },
  ],
  totalDistanceMeters: 460,
  totalMinutes: 47,
  feasible: true,
  droppedAttractions: [],
  geometry: [
    { lat: 32.0779, lng: 34.7742 },
    { lat: 32.078, lng: 34.7743 },
    { lat: 32.0791, lng: 34.7736 },
  ],
  warnings: [],
};
