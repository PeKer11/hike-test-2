export function timeToSeconds(time: string): number | null {
  const parts = time.split(":").map(Number);
  const [hours, minutes] = parts;
  if (
    parts.length < 2 ||
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const seconds = parts[2] ?? 0;
  return hours * 3600 + minutes * 60 + (Number.isNaN(seconds) ? 0 : seconds);
}

export function secondsToTime(totalSeconds: number): string {
  const clampedSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(clampedSeconds / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((clampedSeconds % 3600) / 60)
    .toString()
    .padStart(2, "0");

  return `${hours}:${minutes}`;
}

export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds)) {
    return "Unknown duration";
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes} min`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}
