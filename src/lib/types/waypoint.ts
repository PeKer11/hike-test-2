export interface Coordinates {
  lat: number;
  lng: number;
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface Waypoint {
  id: string;
  name: string;
  coordinates: Coordinates;
  required: boolean;
  isStart: boolean;
  isEnd: boolean;
  timeWindow?: TimeWindow;
}
