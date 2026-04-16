"use client";

import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";

import { MapContainer, TileLayer, useMap } from "react-leaflet";
import { useEffect } from "react";

import { MapClickHandler } from "@/components/map/MapClickHandler";
import { CurrentPositionMarker } from "@/components/map/CurrentPositionMarker";
import { MapMarkers } from "@/components/map/MapMarkers";
import { RoutePolyline } from "@/components/map/RoutePolyline";
import type { Coordinates, Waypoint } from "@/lib/types";

interface MapViewProps {
  waypoints: Waypoint[];
  routeGeometry: Coordinates[];
  center: Coordinates;
  zoom: number;
  onMapClick: (coordinates: Coordinates) => void;
  currentPosition?: Coordinates;
  followPosition?: boolean;
}

function MapViewport({ center, zoom }: { center: Coordinates; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom]);

  return null;
}

function MapSizeInvalidator() {
  const map = useMap();

  useEffect(() => {
    const invalidate = () => {
      map.invalidateSize();
    };

    const frameId = window.requestAnimationFrame(() => {
      invalidate();
      window.setTimeout(invalidate, 150);
    });

    window.addEventListener("resize", invalidate);
    window.addEventListener("orientationchange", invalidate);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", invalidate);
      window.removeEventListener("orientationchange", invalidate);
    };
  }, [map]);

  return null;
}

function PositionFollower({
  currentPosition,
  followPosition = false,
}: {
  currentPosition?: Coordinates;
  followPosition?: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!followPosition || !currentPosition) {
      return;
    }

    map.panTo([currentPosition.lat, currentPosition.lng]);
  }, [currentPosition, followPosition, map]);

  return null;
}

export default function MapView({
  waypoints,
  routeGeometry,
  center,
  zoom,
  onMapClick,
  currentPosition,
  followPosition,
}: MapViewProps) {
  return (
    <div className="absolute inset-0">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="h-full w-full"
        style={{ height: "100%", width: "100%" }}
      >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewport center={center} zoom={zoom} />
      <MapSizeInvalidator />
      <PositionFollower
        currentPosition={currentPosition}
        followPosition={followPosition}
      />
      <MapMarkers waypoints={waypoints} />
      {currentPosition ? <CurrentPositionMarker position={currentPosition} /> : null}
      <RoutePolyline geometry={routeGeometry} />
      <MapClickHandler onMapClick={onMapClick} />
      </MapContainer>
    </div>
  );
}
