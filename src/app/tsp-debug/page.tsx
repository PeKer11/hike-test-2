"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const TspMap = dynamic(() => import("./TspMap"), { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-slate-400">Loading map…</div> });

interface Node { label: string; coordinates: { lat: number; lng: number } }
interface DebugData {
  debug: {
    allNodes: Node[];
    matrix: number[][];
    nnTourIndices: number[];
    optimizedTourIndices: number[];
  };
  orderedAttractions: { name: string }[];
  droppedAttractions: { name: string }[];
  totalDistanceMeters: number;
  totalWalkingMinutes: number;
  totalVisitMinutes: number;
}

type ViewMode = "graph" | "nn" | "optimized";

export default function TspDebugPage() {
  const params = useSearchParams();
  const [lat, setLat] = useState(params.get("lat") ?? "32.0853");
  const [lng, setLng] = useState(params.get("lng") ?? "34.7818");
  const [minutes, setMinutes] = useState(params.get("minutes") ?? "90");
  const [radius, setRadius] = useState(params.get("radius") ?? "1500");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DebugData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("optimized");

  // Auto-run when launched from the walk plan
  useEffect(() => {
    if (params.get("lat")) void run();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setError(null);
    setData(null);
    setLoading(true);
    try {
      const res = await fetch("/api/tsp-debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          availableMinutes: parseInt(minutes),
          radiusMeters: parseInt(radius),
        }),
      });
      const json = (await res.json()) as DebugData & { error?: string };
      if (json.error) { setError(json.error); return; }
      setData(json);
      setView("optimized");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="flex w-80 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white p-4">
        <h1 className="text-lg font-bold text-slate-900">TSP Visualizer</h1>

        <div className="space-y-2 text-sm">
          <label className="block font-medium text-slate-700">Latitude</label>
          <input value={lat} onChange={e => setLat(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5" />
          <label className="block font-medium text-slate-700">Longitude</label>
          <input value={lng} onChange={e => setLng(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5" />
          <label className="block font-medium text-slate-700">Minutes available</label>
          <input type="number" value={minutes} onChange={e => setMinutes(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5" />
          <label className="block font-medium text-slate-700">Radius (m)</label>
          <input type="number" value={radius} onChange={e => setRadius(e.target.value)} className="w-full rounded border border-slate-300 px-2 py-1.5" />
        </div>

        <button
          onClick={run}
          disabled={loading}
          className="rounded-md bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-emerald-300"
        >
          {loading ? "Running TSP…" : "Run TSP"}
        </button>

        {error && <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">{error}</p>}

        {data && (
          <>
            {/* View toggle */}
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase text-slate-500">Show</p>
              {(["graph", "nn", "optimized"] as ViewMode[]).map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`w-full rounded px-3 py-1.5 text-left text-sm font-medium transition ${view === v ? "bg-emerald-100 text-emerald-800" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {v === "graph" && "🕸 Full graph (all edges)"}
                  {v === "nn" && "🟠 Nearest Neighbor tour"}
                  {v === "optimized" && "🟢 2-opt optimized tour"}
                </button>
              ))}
            </div>

            {/* Stats */}
            <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
              <p><span className="font-semibold">Nodes:</span> {data.debug.allNodes.length} ({data.debug.allNodes.length - 1} attractions)</p>
              <p><span className="font-semibold">Selected:</span> {data.orderedAttractions.length}</p>
              <p><span className="font-semibold">Dropped:</span> {data.droppedAttractions.length}</p>
              <p><span className="font-semibold">Distance:</span> {(data.totalDistanceMeters / 1000).toFixed(2)} km</p>
              <p><span className="font-semibold">Walk time:</span> {Math.round(data.totalWalkingMinutes)} min</p>
              <p><span className="font-semibold">Visit time:</span> {Math.round(data.totalVisitMinutes)} min</p>
            </div>

            {/* Ordered list */}
            <div>
              <p className="mb-1 text-xs font-semibold uppercase text-slate-500">Final order</p>
              <ol className="space-y-1">
                {data.orderedAttractions.map((a, i) => (
                  <li key={i} className="text-xs text-slate-700">{i + 1}. {a.name}</li>
                ))}
              </ol>
              {data.droppedAttractions.length > 0 && (
                <>
                  <p className="mb-1 mt-2 text-xs font-semibold uppercase text-rose-400">Dropped (no time)</p>
                  <ul className="space-y-1">
                    {data.droppedAttractions.map((a, i) => (
                      <li key={i} className="text-xs text-slate-400 line-through">{a.name}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </>
        )}
      </aside>

      {/* Map */}
      <main className="flex-1">
        {data ? (
          <TspMap nodes={data.debug.allNodes} matrix={data.debug.matrix} nnTour={data.debug.nnTourIndices} optimizedTour={data.debug.optimizedTourIndices} view={view} />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            {loading ? "Fetching attractions and running TSP…" : "Enter coordinates and click Run TSP"}
          </div>
        )}
      </main>
    </div>
  );
}
