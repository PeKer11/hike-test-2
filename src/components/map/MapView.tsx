"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";

import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

import { MapClickHandler } from "@/components/map/MapClickHandler";
import { MapMarkers } from "@/components/map/MapMarkers";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import type { Coordinates, Waypoint } from "@/lib/types";

interface MapViewProps {
  waypoints: Waypoint[];
  routeGeometry: Coordinates[];
  center: Coordinates;
  zoom: number;
  onMapClick: (coordinates: Coordinates) => void;
}

function MapViewport({ center, zoom }: { center: Coordinates; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom]);

  return null;
}

export default function MapView({
  waypoints,
  routeGeometry,
  center,
  zoom,
  onMapClick,
}: MapViewProps) {
  return (
    <MapContainer center={[center.lat, center.lng]} zoom={zoom} className="h-full w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewport center={center} zoom={zoom} />
      <MapMarkers waypoints={waypoints} />
      <RoutePolyline geometry={routeGeometry} />
      <MapClickHandler onMapClick={onMapClick} />
    </MapContainer>
  );
}
