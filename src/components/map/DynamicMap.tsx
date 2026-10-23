import dynamic from "next/dynamic";

const loading = () => (
  <div className="flex h-full w-full items-center justify-center bg-cream text-charcoal/60">
    Loading map...
  </div>
);

// v2: Google map whenever a browser key is set, unless NEXT_PUBLIC_MAP_PROVIDER=leaflet; otherwise the Leaflet/OSM map (v1).
const useGoogle = process.env.NEXT_PUBLIC_MAP_PROVIDER !== "leaflet" && !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

const DynamicMap = dynamic(() => (useGoogle ? import("./GoogleMapView") : import("./MapView")), {
  ssr: false,
  loading,
});

export { DynamicMap };
