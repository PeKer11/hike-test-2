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

export function exportToGpx(points: RecordedPoint[], walkName: string): string {
  const safeName = escapeXml(walkName.trim() || "Walk");
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
  <trk>
    <name>${safeName}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGpx(points: RecordedPoint[], walkName: string): void {
  const gpx = exportToGpx(points, walkName);
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
