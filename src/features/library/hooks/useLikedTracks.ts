import { useEffect, useSyncExternalStore } from "react";
import { api, getAuthSession, toClientTrack } from "@/shared/api";
import { notifyLibraryChanged } from "./usePlaylists";
import type { Track } from "@/shared/types";

type LikedData = { tracks: Track[]; total: number };
const EMPTY: LikedData = { tracks: [], total: 0 };
let cache: LikedData = EMPTY;
let loaded = false;
let fetchedFromServer = false;
let loadFailed = false;
let request: Promise<void> | null = null;
let reloadQueued = false;
const listeners = new Set<() => void>();
let view = { data: cache, isLoading: true, error: false };

const optimisticOverrides = new Map<string, boolean>();
const desiredLikes = new Map<string, boolean>();
const syncingLikes = new Set<string>();
const likeWaiters = new Map<
  string,
  Array<{ resolve: () => void; reject: (error: unknown) => void }>
>();
const likeSettledEpoch = new Map<string, number>();
let likeEpoch = 0;

function buildView(isLoading: boolean): {
  data: LikedData;
  isLoading: boolean;
  error: boolean;
} {
  const error = loadFailed;
  if (optimisticOverrides.size === 0) return { data: cache, isLoading, error };

  let tracks = cache.tracks.filter(
    (t) => optimisticOverrides.get(t.id) !== false,
  );
  for (const [id, liked] of optimisticOverrides) {
    if (liked && !tracks.some((t) => t.id === id)) {
      tracks = [
        {
          id,
          title: "",
          artists: "",
          artistId: undefined,
          coverUrl: "",
          durationMs: 0,
          playCount: 0,
        } as Track,
        ...tracks,
      ];
    }
  }
  return { data: { tracks, total: tracks.length }, isLoading, error };
}

function emit(isLoading = false) {
  view = buildView(isLoading);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return view;
}

const SERVER_SNAPSHOT = { data: EMPTY, isLoading: true, error: false };
const LIKED_CACHE_KEY = "liner_liked_tracks_cache_v1";

let cacheOwner: string | null | undefined;

function likedCacheKey(owner: string | null) {
  return `${LIKED_CACHE_KEY}:${owner ?? "anonymous"}`;
}

function readLikedCache(owner: string | null): Track[] {
  try {
    const raw = localStorage.getItem(likedCacheKey(owner));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as Track[]) : [];
  } catch {
    return [];
  }
}

function writeLikedCache(owner: string | null, tracks: Track[]) {
  try {
    localStorage.setItem(likedCacheKey(owner), JSON.stringify(tracks));
  } catch {}
}

function hydrateLikedCache(owner: string | null) {
  if (cacheOwner === owner) return;
  cacheOwner = owner;
  loaded = false;
  fetchedFromServer = false;
  loadFailed = false;
  const tracks = readLikedCache(owner);
  cache = tracks.length > 0 ? { tracks, total: tracks.length } : EMPTY;
  emit(false);
}

export function hydrateLikedTracks() {
  hydrateLikedCache(getAuthSession()?.user?.id ?? null);
}

function load(force = false): Promise<void> {
  if (request) {
    if (force) reloadQueued = true;
    return request;
  }
  const session = getAuthSession();
  if (!session?.accessToken) {
    cacheOwner = undefined;
    cache = EMPTY;
    loaded = false;
    fetchedFromServer = false;
    emit(false);
    return Promise.resolve();
  }
  const owner = session.user?.id ?? null;
  hydrateLikedCache(owner);
  if (loaded && !force) return Promise.resolve();

  const hadCache = cache.tracks.length > 0;
  if (!loaded) emit(true);

  const startEpoch = likeEpoch;
  request = (async () => {
    const tracks: Track[] = [];
    let cursor: string | undefined;
    do {
      const page = await api.listLikedTracks(100, cursor);
      tracks.push(
        ...page.items.map(({ track, likedAt }) => ({
          ...toClientTrack(track),
          addedAt: likedAt,
        })),
      );
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    if ((getAuthSession()?.user?.id ?? null) !== owner) return;
    cache = { tracks, total: tracks.length };
    writeLikedCache(owner, tracks);
    loaded = true;
    fetchedFromServer = true;
    loadFailed = false;
    dropConfirmedOverrides(startEpoch);
  })()
    .catch(() => {
      if ((getAuthSession()?.user?.id ?? null) !== owner) return;
      if (!fetchedFromServer && !hadCache) cache = EMPTY;
      loaded = fetchedFromServer;
      loadFailed = true;
    })
    .finally(() => {
      request = null;
      emit(false);
      if (reloadQueued) {
        reloadQueued = false;
        void load(true);
      }
    });
  return request;
}

function dropConfirmedOverrides(startEpoch: number) {
  for (const id of optimisticOverrides.keys()) {
    if (syncingLikes.has(id)) continue;
    if ((likeSettledEpoch.get(id) ?? 0) > startEpoch) continue;
    optimisticOverrides.delete(id);
    likeSettledEpoch.delete(id);
  }
}

export function isTrackLikedNow(trackId: string): boolean {
  const override = optimisticOverrides.get(trackId);
  if (override !== undefined) return override;
  return cache.tracks.some((t) => t.id === trackId);
}

function settleLikeWaiters(trackId: string, error?: unknown) {
  const waiters = likeWaiters.get(trackId) ?? [];
  likeWaiters.delete(trackId);
  for (const waiter of waiters) {
    if (error === undefined) waiter.resolve();
    else waiter.reject(error);
  }
}

async function syncTrackLike(trackId: string, confirmed: boolean) {
  syncingLikes.add(trackId);
  let serverLiked = confirmed;
  let sent = false;
  let failure: unknown;
  try {
    for (;;) {
      const wanted = desiredLikes.get(trackId);
      if (wanted === undefined || wanted === serverLiked) break;
      sent = true;
      if (wanted) await api.likeTrack(trackId);
      else await api.unlikeTrack(trackId);
      serverLiked = wanted;
    }
  } catch (error) {
    failure = error ?? new Error("like sync failed");
  }
  desiredLikes.delete(trackId);
  syncingLikes.delete(trackId);
  likeEpoch += 1;
  likeSettledEpoch.set(trackId, likeEpoch);
  optimisticOverrides.set(trackId, serverLiked);
  emit(false);
  writeLikedCache(getAuthSession()?.user?.id ?? null, view.data.tracks);
  settleLikeWaiters(trackId, failure);
  if (sent) notifyLibraryChanged();
}

export function setTrackLiked(trackId: string, liked: boolean): Promise<void> {
  const settled = new Promise<void>((resolve, reject) => {
    const waiters = likeWaiters.get(trackId) ?? [];
    waiters.push({ resolve, reject });
    likeWaiters.set(trackId, waiters);
  });
  const confirmed = isTrackLikedNow(trackId);
  desiredLikes.set(trackId, liked);
  optimisticOverrides.set(trackId, liked);
  emit(false);
  if (!syncingLikes.has(trackId)) void syncTrackLike(trackId, confirmed);
  return settled;
}

export function toggleTrackLike(trackId: string): {
  liked: boolean;
  settled: Promise<void>;
} {
  const liked = !isTrackLikedNow(trackId);
  return { liked, settled: setTrackLiked(trackId, liked) };
}

export function reloadLikedTracks(): Promise<void> {
  return load(true);
}

export function applyOptimisticLike(trackId: string): () => void {
  const prev = optimisticOverrides.get(trackId);
  optimisticOverrides.set(trackId, true);
  emit(false);
  return () => {
    if (prev === undefined) optimisticOverrides.delete(trackId);
    else optimisticOverrides.set(trackId, prev);
    emit(false);
  };
}

export function applyOptimisticUnlike(trackId: string): () => void {
  const prev = optimisticOverrides.get(trackId);
  optimisticOverrides.set(trackId, false);
  emit(false);
  return () => {
    if (prev === undefined) optimisticOverrides.delete(trackId);
    else optimisticOverrides.set(trackId, prev);
    emit(false);
  };
}

if (typeof window !== "undefined") {
  const handleRefresh = () => {
    const session = getAuthSession();
    if (!session?.accessToken) {
      cache = EMPTY;
      loaded = false;
      fetchedFromServer = false;
      optimisticOverrides.clear();
      likeSettledEpoch.clear();
      emit(false);
    } else {
      void load(true);
    }
  };
  window.addEventListener("library:changed", handleRefresh);
  window.addEventListener("auth:changed", handleRefresh);
}

export const loadLikedTracks = load;
export const subscribeLikedTracks = subscribe;

export function likedTracksSnapshot(): {
  tracks: Track[];
  fromServer: boolean;
} {
  return { tracks: view.data.tracks, fromServer: fetchedFromServer };
}

export function useLikedTracks(params?: {
  limit?: number;
  offset?: number;
  enabled?: boolean;
}) {
  const enabled = params?.enabled ?? true;
  const state = useSyncExternalStore(
    subscribe,
    snapshot,
    () => SERVER_SNAPSHOT,
  );
  useEffect(() => {
    if (enabled) void load();
  }, [enabled]);
  return state;
}

export function useLikedTrackCount() {
  const { data, isLoading } = useLikedTracks();
  return { data: data.total, isLoading };
}
