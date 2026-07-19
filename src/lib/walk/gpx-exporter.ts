import type { Attraction } from "@/lib/types";
import type { RecordedPoint } from "@/lib/walk/walk-recorder";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function localDateStamp(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function exportToGpx(
  points: RecordedPoint[],
  walkName: string,
  attractions: Attraction[] = [],
): string {
  const safeName = escapeXml(walkName.trim() || "Walk");

  const wpts = attractions
    .map(
      (a) =>
        `  <wpt lat="${a.coordinates.lat}" lon="${a.coordinates.lng}">
    <name>${escapeXml(a.name)}</name>
    <desc>${escapeXml(a.category)}</desc>
    <sym>Flag, Blue</sym>
  </wpt>`,
    )
    .join("\n");

  const trkpts = points
    .map(
      (point) =>
        `      <trkpt lat="${point.lat}" lon="${point.lng}">
        <time>${new Date(point.timestamp).toISOString()}</time>
      </trkpt>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="hiking-route-planner" xmlns="http://www.topografix.com/GPX/1/1">
${wpts}
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGpx(
  points: RecordedPoint[],
  walkName: string,
  attractions: Attraction[] = [],
): void {
  const gpx = exportToGpx(points, walkName, attractions);
  const blob = new Blob([gpx], { type: "application/gpx+xml" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `walk-${localDateStamp(new Date())}.gpx`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function downloadCsv(
  points: RecordedPoint[],
  attractions: Attraction[],
  walkName: string,
): void {
  if (points.length === 0) return;

  const attractionHeaders = attractions.map((a) => `"${a.name.replace(/"/g, '""')}"`);
  const header = ["timestamp", "lat", "lng", "pace_min_per_km", ...attractionHeaders].join(",");

  const rows = points.map((p) => {
    const distances = attractions.map((a) => {
      const d = p.attractionDistances[a.id];
      return d !== undefined ? Math.round(d) : "";
    });
    return [
      new Date(p.timestamp).toISOString(),
      p.lat,
      p.lng,
      p.paceMinPerKm !== null ? p.paceMinPerKm.toFixed(1) : "",
      ...distances,
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `walk-data-${localDateStamp(new Date())}.csv`;

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
