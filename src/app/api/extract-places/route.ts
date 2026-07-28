import { NextResponse } from "next/server";

import { extractPlaceNames } from "@/lib/api/gemini-client";
import { searchPlaces } from "@/lib/api/nominatim-client";
import {
  buildExtractionResult,
  type GeocodedPlaceName,
} from "@/lib/places/place-extractor";
import type { Coordinates } from "@/lib/types";

interface ExtractPlacesRequest {
  prompt: string;
  nearLocation?: Coordinates;
}

const MAX_PROMPT_LENGTH = 1000;
// Nominatim allows 1 request/sec — geocode the names serially with a margin.
const GEOCODE_DELAY_MS = 1100;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toBias(value: Coordinates | undefined): Coordinates | undefined {
  if (!value) return undefined;
  const { lat, lng } = value;
  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return undefined;
  }
  return { lat, lng };
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ExtractPlacesRequest;

    const prompt =
      typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return NextResponse.json(
        { error: "prompt is required." },
        { status: 400 },
      );
    }

    if (prompt.length > MAX_PROMPT_LENGTH) {
      return NextResponse.json(
        { error: `prompt must be ${MAX_PROMPT_LENGTH} characters or fewer.` },
        { status: 400 },
      );
    }

    const bias = toBias(body.nearLocation);
    const names = await extractPlaceNames(prompt);

    const entries: GeocodedPlaceName[] = [];
    for (const [index, name] of names.entries()) {
      if (index > 0) {
        await delay(GEOCODE_DELAY_MS);
      }

      let coordinates: Coordinates | null = null;
      try {
        const [match] = await searchPlaces(name, 1, bias);
        const lat = Number(match?.lat);
        const lng = Number(match?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
          coordinates = { lat, lng };
        }
      } catch {
        // A single geocoding failure shouldn't sink the whole prompt — the
        // name falls through to `unresolvedNames` instead.
      }

      entries.push({ name, coordinates });
    }

    const { attractions, unresolvedNames } = buildExtractionResult(entries);

    return NextResponse.json({
      extractedNames: names,
      attractions,
      unresolvedNames,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to extract places.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
