"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * Adds data-source credits to the map's attribution control while they apply
 * (e.g. ESA WorldCover while satellite finds are on screen) and removes them
 * again. The tile layer's own credit is untouched.
 */
export function ExtraAttribution({ texts }: { texts: string[] }) {
  const map = useMap();
  const joined = texts.join("\n");
  useEffect(() => {
    const list = joined === "" ? [] : joined.split("\n");
    for (const t of list) map.attributionControl?.addAttribution(t);
    return () => {
      for (const t of list) map.attributionControl?.removeAttribution(t);
    };
  }, [map, joined]);
  return null;
}
