import "server-only";

import {
  fetchPlacesAlongPath,
  fetchPlacesAround,
  fetchPlacesInBboxes,
  fetchPlacesScan,
} from "@/lib/attractions/overpass-client";
import type { Coordinates, NearbyPlace } from "@/lib/types";

/**
 * Where "what is near the walker" comes from. A seam, not a plan: only OSM
 * (Overpass) is implemented. Google Places is deliberately not — its terms
 * forbid showing Places data on a non-Google map, and this one is Leaflet/OSM.
 */
export interface NearbyProvider {
  fetchAlongPath(path: Coordinates[], radiusMeters: number): Promise<NearbyPlace[]>;
  fetchAround(point: Coordinates, radiusMeters: number): Promise<NearbyPlace[]>;
  /** Corridor + notable ring in one request (all places; caller splits by distance). */
  fetchScan(
    points: Coordinates[],
    radiusMeters: number,
    ringRadiusMeters: number,
  ): Promise<NearbyPlace[]>;
  /** Everything in a union of boxes (the tile cache's misses). Optional: no cache without it. */
  fetchInBboxes?(
    bboxes: Array<{ south: number; west: number; north: number; east: number }>,
  ): Promise<NearbyPlace[]>;
}

const osmProvider: NearbyProvider = {
  fetchAlongPath: fetchPlacesAlongPath,
  fetchAround: fetchPlacesAround,
  fetchScan: fetchPlacesScan,
  fetchInBboxes: fetchPlacesInBboxes,
};

/** Reads `NEARBY_PROVIDER` (server-only; default "osm"). Unknown values fall back to OSM. */
export function getNearbyProvider(): NearbyProvider {
  switch (process.env.NEARBY_PROVIDER ?? "osm") {
    default:
      return osmProvider;
  }
}
