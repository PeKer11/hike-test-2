"use client";

import { useState } from "react";

import { ConstraintPanel } from "@/components/constraints";
import { DynamicMap } from "@/components/map";
import { HikeSearchPanel, RouteResults } from "@/components/route";
import { Button, Card } from "@/components/ui";
import { PlaceSearch, WaypointList } from "@/components/waypoints";
import {
  useConstraints,
  useHikeSearch,
  useMapInteraction,
  useRouteCalculation,
  useWaypoints,
} from "@/lib/hooks";
import type { Coordinates } from "@/lib/types";

type PlannerMode = "manual" | "hike-search";

export default function HomePage() {
  const [plannerMode, setPlannerMode] = useState<PlannerMode>("manual");
  const {
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
  } = useWaypoints();
  const {
    constraints,
    toggleMaxDistance,
    setMaxDistanceKm,
    toggleTimeWindows,
    setDefaultTimeWindow,
    toggleFixedStartEnd,
  } = useConstraints();
  const { route, isLoading, error, calculateRoute, clearRoute, applyRoute } =
    useRouteCalculation();
  const { isSearching, error: hikeSearchError, findHike, cancelSearch } =
    useHikeSearch();
  const { center, zoom, clickMode, setClickMode, focusOn } = useMapInteraction();

  const handleMapClick = (coordinates: Coordinates) => {
    if (plannerMode !== "manual") {
      return;
    }

    if (clickMode === "add-waypoint") {
      addWaypoint({
        coordinates,
      });
      return;
    }

    const nextWaypoint = addWaypoint({
      coordinates,
      name: clickMode === "set-start" ? "Custom Start" : "Custom End",
    });

    if (clickMode === "set-start") {
      setStartWaypoint(nextWaypoint.id);
    } else {
      setEndWaypoint(nextWaypoint.id);
    }

    setClickMode("add-waypoint");
  };

  return (
    <main className="flex h-screen w-screen overflow-hidden">
      <aside className="h-full w-full max-w-[400px] overflow-y-auto border-r border-slate-200 bg-slate-50 p-4">
        <div className="mb-4 space-y-1">
          <h1 className="text-xl font-bold text-slate-900">Hiking Route Planner</h1>
          <p className="text-xs text-slate-500">
            Add waypoints, configure constraints, and generate an optimized walking route.
          </p>
        </div>

        <div className="space-y-4">
          <Card className="space-y-2">
            <div className="text-sm font-semibold text-slate-900">Planning mode</div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={plannerMode === "manual" ? "primary" : "secondary"}
                onClick={() => setPlannerMode("manual")}
              >
                Manual Planner
              </Button>
              <Button
                variant={plannerMode === "hike-search" ? "primary" : "secondary"}
                onClick={() => setPlannerMode("hike-search")}
              >
                Find Me a Hike
              </Button>
            </div>
          </Card>

          {plannerMode === "manual" ? (
            <>
              <PlaceSearch
                onSelectPlace={(place) => {
                  addWaypoint({
                    coordinates: place.coordinates,
                    name: place.name,
                  });
                  focusOn(place.coordinates, 14);
                }}
              />

              <Card className="space-y-2">
                <div className="text-sm font-semibold text-slate-900">Map click mode</div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={clickMode === "add-waypoint" ? "primary" : "secondary"}
                    onClick={() => setClickMode("add-waypoint")}
                  >
                    Add
                  </Button>
                  <Button
                    variant={clickMode === "set-start" ? "primary" : "secondary"}
                    onClick={() => setClickMode("set-start")}
                  >
                    Start
                  </Button>
                  <Button
                    variant={clickMode === "set-end" ? "primary" : "secondary"}
                    onClick={() => setClickMode("set-end")}
                  >
                    End
                  </Button>
                </div>
              </Card>

              <WaypointList
                waypoints={waypoints}
                onRename={(id, name) => updateWaypoint(id, { name })}
                onToggleRequired={toggleRequired}
                onSetStart={setStartWaypoint}
                onSetEnd={setEndWaypoint}
                onDelete={removeWaypoint}
                onReorder={reorderWaypoints}
                onSetTimeWindow={setWaypointTimeWindow}
              />

              <ConstraintPanel
                constraints={constraints}
                isCalculating={isLoading}
                onToggleMaxDistance={toggleMaxDistance}
                onSetMaxDistanceKm={setMaxDistanceKm}
                onToggleTimeWindows={toggleTimeWindows}
                onSetDefaultTimeWindow={setDefaultTimeWindow}
                onToggleFixedStartEnd={toggleFixedStartEnd}
                onCalculateRoute={() => {
                  void calculateRoute(waypoints, constraints);
                }}
              />
            </>
          ) : (
            <HikeSearchPanel
              isSearching={isSearching}
              onFindHike={({ origin, endpoint, maxDistanceKm }) => {
                void (async () => {
                  cancelSearch();
                  const searchConstraints =
                    maxDistanceKm && maxDistanceKm > 0
                      ? {
                          ...constraints,
                          maxDistance: {
                            enabled: true,
                            maxKm: maxDistanceKm,
                          },
                        }
                      : constraints;

                  const result = await findHike(
                    {
                      origin,
                      endpoint,
                      preferences:
                        maxDistanceKm && maxDistanceKm > 0
                          ? { maxDistanceMeters: maxDistanceKm * 1000 }
                          : undefined,
                    },
                    searchConstraints,
                  );

                  if (!result) {
                    return;
                  }

                  applyRoute(result.route);
                  setWaypoints(result.route.orderedWaypoints);
                  const firstPoint = result.route.geometry[0];
                  if (firstPoint) {
                    focusOn(firstPoint, 13);
                  }
                })();
              }}
            />
          )}

          <Card className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                clearRoute();
              }}
            >
              Clear Route
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearWaypoints();
                clearRoute();
                cancelSearch();
              }}
            >
              Clear All
            </Button>
          </Card>

          <RouteResults route={route} error={hikeSearchError ?? error} />
        </div>
      </aside>

      <section className="h-full flex-1">
        <DynamicMap
          waypoints={waypoints}
          routeGeometry={route?.geometry ?? []}
          center={center}
          zoom={zoom}
          onMapClick={handleMapClick}
        />
      </section>
    </main>
  );
}
