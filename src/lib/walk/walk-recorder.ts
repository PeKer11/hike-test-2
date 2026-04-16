import type { PaceUpdate } from "@/lib/walk/walk-tracker";

export interface RecordedPoint {
  lat: number;
  lng: number;
  timestamp: number; // ms since epoch
  paceMinPerKm: number | null;
}

export class WalkRecorder {
  private readonly intervalMs: number;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private points: RecordedPoint[] = [];

  constructor(intervalMs: number = 30_000) {
    this.intervalMs = intervalMs;
  }

  start(getLatestUpdate: () => PaceUpdate | null): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(() => {
      const update = getLatestUpdate();
      if (update === null) return;

      this.points.push({
        lat: update.currentPosition.lat,
        lng: update.currentPosition.lng,
        timestamp: update.timestamp,
        paceMinPerKm: update.paceMinPerKm,
      });
    }, this.intervalMs);
  }

  stop(): RecordedPoint[] {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    return [...this.points];
  }

  clear(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.points = [];
  }

  get pointCount(): number {
    return this.points.length;
  }
}
