export type OrsCoordinate = [number, number];

export interface OrsDirectionsRequest {
  coordinates: OrsCoordinate[];
  profile?: "foot-walking" | "foot-hiking" | "cycling-regular" | "driving-car";
  instructions?: boolean;
}

export interface OrsDirectionsStep {
  distance: number;
  duration: number;
  instruction: string;
}

export interface OrsDirectionsSegment {
  distance: number;
  duration: number;
  steps: OrsDirectionsStep[];
}

export interface OrsDirectionsRoute {
  geometry: string;
  summary: {
    distance: number;
    duration: number;
  };
  segments: OrsDirectionsSegment[];
  way_points: number[];
}

export interface OrsDirectionsResponse {
  routes: OrsDirectionsRoute[];
}

export interface OrsOptimizationJob {
  id: number;
  location: OrsCoordinate;
  service?: number;
  priority?: number;
  time_windows?: Array<[number, number]>;
}

export interface OrsOptimizationVehicle {
  id: number;
  profile: "foot-walking" | "foot-hiking" | "cycling-regular" | "driving-car";
  start?: OrsCoordinate;
  end?: OrsCoordinate;
  max_distance?: number;
}

export interface OrsOptimizationRequest {
  jobs: OrsOptimizationJob[];
  vehicles: OrsOptimizationVehicle[];
}

export interface OrsOptimizationStep {
  type: "start" | "job" | "end" | string;
  id: number;
}

export interface OrsOptimizationRoute {
  vehicle: number;
  distance: number;
  duration: number;
  steps: OrsOptimizationStep[];
}

export interface OrsOptimizationSummary {
  cost: number;
  routes: number;
  unassigned: number;
}

export interface OrsOptimizationResponse {
  code: number;
  summary: OrsOptimizationSummary;
  unassigned: Array<{ id: number }>;
  routes: OrsOptimizationRoute[];
}

export interface NominatimPlace {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}
