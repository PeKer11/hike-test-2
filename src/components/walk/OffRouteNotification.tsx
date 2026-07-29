interface OffRouteNotificationProps {
  visible: boolean;
  deviationMeters: number;
}

export function OffRouteNotification({
  visible,
  deviationMeters,
}: OffRouteNotificationProps) {
  if (!visible) {
    return null;
  }

  return (
    // Absolute, not fixed: it belongs to the planner frame, which is only
    // viewport-sized while expanded.
    <div className="absolute top-4 left-1/2 z-[500] -translate-x-1/2 animate-pulse rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
      Off route - {deviationMeters}m from path
    </div>
  );
}
