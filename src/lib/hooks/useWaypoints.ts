"use client";

import { useState } from "react";

import type { Coordinates, TimeWindow, Waypoint } from "@/lib/types";

function createWaypointId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

interface AddWaypointInput {
  coordinates: Coordinates;
  name?: string;
}

export function useWaypoints(initialWaypoints: Waypoint[] = []) {
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initialWaypoints);

  const addWaypoint = ({ coordinates, name }: AddWaypointInput): Waypoint => {
    const nextWaypoint: Waypoint = {
      id: createWaypointId(),
      name: name?.trim() || `Waypoint ${waypoints.length + 1}`,
      coordinates,
      required: false,
      isStart: false,
      isEnd: false,
    };

    setWaypoints((current) => [...current, nextWaypoint]);
    return nextWaypoint;
  };

  const updateWaypoint = (id: string, updates: Partial<Waypoint>) => {
    setWaypoints((current) =>
      current.map((waypoint) =>
        waypoint.id === id ? { ...waypoint, ...updates } : waypoint,
      ),
    );
  };

  const removeWaypoint = (id: string) => {
    setWaypoints((current) => current.filter((waypoint) => waypoint.id !== id));
  };

  const reorderWaypoints = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) {
      return;
    }

    setWaypoints((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      if (!moved) {
        return current;
      }
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const toggleRequired = (id: string) => {
    setWaypoints((current) =>
      current.map((waypoint) =>
        waypoint.id === id
          ? { ...waypoint, required: !waypoint.required }
          : waypoint,
      ),
    );
  };

  const setStartWaypoint = (id: string) => {
    setWaypoints((current) =>
      current.map((waypoint) => ({
        ...waypoint,
        isStart: waypoint.id === id,
        isEnd: waypoint.id === id ? false : waypoint.isEnd,
      })),
    );
  };

  const setEndWaypoint = (id: string) => {
    setWaypoints((current) =>
      current.map((waypoint) => ({
        ...waypoint,
        isEnd: waypoint.id === id,
        isStart: waypoint.id === id ? false : waypoint.isStart,
      })),
    );
  };

  const setWaypointTimeWindow = (id: string, timeWindow?: TimeWindow) => {
    setWaypoints((current) =>
      current.map((waypoint) =>
        waypoint.id === id ? { ...waypoint, timeWindow } : waypoint,
      ),
    );
  };

  const clearWaypoints = () => {
    setWaypoints([]);
  };

  return {
    waypoints,
    setWaypoints,
    addWaypoint,
    updateWaypoint,
    removeWaypoint,
    reorderWaypoints,
    toggleRequired,
    setStartWaypoint,
    setEndWaypoint,
    setWaypointTimeWindow,
    clearWaypoints,
  };
}
