"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";

interface Node { label: string; coordinates: { lat: number; lng: number } }

interface Props {
  nodes: Node[];
  matrix: number[][];
  nnTour: number[];
  optimizedTour: number[];
  view: "graph" | "nn" | "optimized";
}

function TspLayers({ nodes, matrix, nnTour, optimizedTour, view }: Props) {
  const map = useMap();
  const layersRef = useRef<L.Layer[]>([]);

  useEffect(() => {
    // Clear previous layers
    layersRef.current.forEach(l => map.removeLayer(l));
    layersRef.current = [];

    const add = (layer: L.Layer) => {
      layer.addTo(map);
      layersRef.current.push(layer);
    };

    if (nodes.length === 0) return;

    // Helper: index → latlng
    const ll = (i: number): L.LatLngExpression => [nodes[i].coordinates.lat, nodes[i].coordinates.lng];

    // ── Full graph ──────────────────────────────────────────────────────────
    if (view === "graph") {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dist = matrix[i]?.[j] ?? 0;
          add(L.polyline([ll(i), ll(j)], {
            color: "#94a3b8",
            weight: 1,
            opacity: 0.4,
          }).bindPopup(`${nodes[i].label} ↔ ${nodes[j].label}<br>${Math.round(dist)}m`));
        }
      }
    }

    // ── Nearest Neighbor tour ───────────────────────────────────────────────
    if (view === "nn") {
      const path = [0, ...nnTour];
      for (let k = 0; k < path.length - 1; k++) {
        add(L.polyline([ll(path[k]), ll(path[k + 1])], {
          color: "#f97316",
          weight: 3,
          dashArray: "6 4",
        }));
      }
    }

    // ── 2-opt optimized tour ────────────────────────────────────────────────
    if (view === "optimized") {
      const path = [0, ...optimizedTour];
      for (let k = 0; k < path.length - 1; k++) {
        add(L.polyline([ll(path[k]), ll(path[k + 1])], {
          color: "#16a34a",
          weight: 4,
        }));
      }
    }

    // ── Nodes (always shown) ────────────────────────────────────────────────
    nodes.forEach((node, i) => {
      const isOrigin = i === 0;
      const marker = L.circleMarker([node.coordinates.lat, node.coordinates.lng], {
        radius: isOrigin ? 10 : 7,
        color: isOrigin ? "#dc2626" : "#2563eb",
        fillColor: isOrigin ? "#dc2626" : "#93c5fd",
        fillOpacity: 1,
        weight: 2,
      }).bindPopup(`<strong>${isOrigin ? "📍 Start" : `#${i} ${node.label}`}</strong>`);
      add(marker);
    });

    // Fit bounds
    const lls = nodes.map(n => [n.coordinates.lat, n.coordinates.lng] as L.LatLngTuple);
    map.fitBounds(L.latLngBounds(lls), { padding: [30, 30] });
  }, [nodes, matrix, nnTour, optimizedTour, view, map]);

  return null;
}

export default function TspMap(props: Props) {
  const center: L.LatLngExpression = props.nodes[0]
    ? [props.nodes[0].coordinates.lat, props.nodes[0].coordinates.lng]
    : [32.0853, 34.7818];

  return (
    <MapContainer center={center} zoom={14} className="h-full w-full">
      <TileLayer
        attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <TspLayers {...props} />
    </MapContainer>
  );
}
