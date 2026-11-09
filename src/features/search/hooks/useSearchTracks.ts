import { useCallback, useEffect, useRef, useState } from "react";
import { api, type ApiTrack } from "@/shared/api";
import { toClientTrack } from "@/shared/api";
import type { Track } from "@/shared/types";

export interface UseSearchTracksOptions {
  enabled?: boolean;
  limit?: number;
  debounceMs?: number;
}

export interface UseSearchTracksResult {
  tracks: Track[];
  loading: boolean;
  hasLoaded: boolean;
  error: Error | null;
  partialWarning?: string;
  runNow: () => void;
}

const TRACK_CACHE_MAX = 40;
const trackCache = new Map<string, Track[]>();

function cacheTracks(key: string, tracks: Track[]) {
  trackCache.delete(key);
  trackCache.set(key, tracks);
  if (trackCache.size > TRACK_CACHE_MAX) {
    const oldest = trackCache.keys().next().value;
    if (oldest) trackCache.delete(oldest);
  }
}

export function useSearchTracks(
  query: string,
  options: UseSearchTracksOptions = {},
): UseSearchTracksResult {
  const { enabled = true, debounceMs = 180 } = options;
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [partialWarning, setPartialWarning] = useState<string | undefined>();

  const latestRequestIdRef = useRef(0);
  const lastFetchedQueryRef = useRef("");
  const trimmed = query.trim();
  const shouldRunSearch = enabled && trimmed.length >= 2;

  const runRequest = useCallback(async (requestId: number, q: string) => {
    const cacheKey = `track:${q.toLowerCase()}`;
    const cached = trackCache.get(cacheKey);
    if (cached) {
      setTracks(cached);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedQueryRef.current = q;
      setHasLoaded(true);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const res = await api.search(q, "track");
      if (requestId !== latestRequestIdRef.current) return;
      const next = res.items
        .filter((it): it is ApiTrack & { type: "track" } => it.type === "track")
        .map(toClientTrack);
      cacheTracks(cacheKey, next);
      setTracks(next);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedQueryRef.current = q;
      setHasLoaded(true);
    } catch (err) {
      if (requestId !== latestRequestIdRef.current) return;
      if (!cached) {
        setTracks([]);
        setError(err instanceof Error ? err : new Error(String(err)));
        setPartialWarning(undefined);
        setHasLoaded(true);
      }
    } finally {
      if (requestId === latestRequestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (trimmed.length < 2) {
      latestRequestIdRef.current += 1;
      setTracks([]);
      setHasLoaded(false);
      setLoading(false);
      setError(null);
      setPartialWarning(undefined);
      lastFetchedQueryRef.current = "";
      return;
    }

    if (!enabled) return;

    if (lastFetchedQueryRef.current === trimmed && tracks.length > 0) {
      setLoading(false);
      setHasLoaded(true);
      return;
    }

    setLoading(true);
    const requestId = ++latestRequestIdRef.current;
    const timer = setTimeout(() => {
      if (lastFetchedQueryRef.current === trimmed && tracks.length > 0) {
        setLoading(false);
        setHasLoaded(true);
        return;
      }
      void runRequest(requestId, trimmed);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [debounceMs, enabled, runRequest, tracks.length, trimmed]);

  const runNow = useCallback(() => {
    if (!shouldRunSearch) return;
    const requestId = ++latestRequestIdRef.current;
    void runRequest(requestId, trimmed);
  }, [runRequest, shouldRunSearch, trimmed]);

  return { tracks, loading, hasLoaded, error, partialWarning, runNow };
}
