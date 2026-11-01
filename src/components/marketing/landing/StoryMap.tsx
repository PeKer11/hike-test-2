import Link from "next/link";

import { RouteMap } from "./RouteMap";

/* Full-bleed map the camera lands on after the clouds part. Route and pins are
   live SVG over the same plate that sits in the phone screen. */
export function StoryMap() {
  return (
    <div className="absolute inset-0" data-story-map>
      <div data-map-inner className="absolute inset-0 will-change-transform">
        <RouteMap
          variant="landscape"
          plate="/images/landing/map-plate.webp"
          animate
          className="absolute inset-0 h-full w-full max-md:hidden"
        />
        <RouteMap
          variant="portrait"
          plate="/images/landing/map-plate.webp"
          animate
          className="absolute inset-0 h-full w-full md:hidden"
        />
        <div className="absolute inset-0 bg-[radial-gradient(70%_60%_at_50%_100%,rgba(251,248,244,0.55),transparent_70%)]" />
      </div>
      <div className="absolute inset-x-0 bottom-[10svh] z-10 flex justify-center">
        <Link
          href="/app"
          className="rounded-full bg-terra px-9 py-4 text-lg font-bold text-cream shadow-[0_10px_30px_rgba(193,95,60,0.5)] transition-colors hover:bg-terra/90"
        >
          Start a free walk
        </Link>
      </div>
    </div>
  );
}
