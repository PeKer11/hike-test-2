"use client";

import { useRef, useState } from "react";

import { searchBestHike } from "@/lib/optimization/hike-search";
import type {
  ConstraintSet,
  HikeSearchRequest,
  HikeSearchResult,
} from "@/lib/types";

export function useHikeSearch() {
  const [result, setResult] = useState<HikeSearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeRequestIdRef = useRef(0);

  const findHike = async (
    request: HikeSearchRequest,
    constraints?: ConstraintSet,
  ): Promise<HikeSearchResult | null> => {
    activeRequestIdRef.current += 1;
    const requestId = activeRequestIdRef.current;

    setIsSearching(true);
    setError(null);

    try {
      const nextResult = await searchBestHike(request, constraints);
      if (requestId !== activeRequestIdRef.current) {
        return null;
      }

      setResult(nextResult);
      return nextResult;
    } catch (searchError) {
      if (requestId !== activeRequestIdRef.current) {
        return null;
      }

      const message =
        searchError instanceof Error ? searchError.message : "Hike search failed.";
      setError(message);
      setResult(null);
      return null;
    } finally {
      if (requestId === activeRequestIdRef.current) {
        setIsSearching(false);
      }
    }
  };

  const clearSearch = () => {
    setResult(null);
    setError(null);
  };

  const cancelSearch = () => {
    activeRequestIdRef.current += 1;
    setResult(null);
    setError(null);
    setIsSearching(false);
  };

  return {
    result,
    isSearching,
    error,
    findHike,
    clearSearch,
    cancelSearch,
  };
}
