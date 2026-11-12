import { useEffect, useState } from "react";
import { queryCache } from "@/shared/cache/queryCache";
import {
  api,
  mediaUrl,
  toMaxQualityAvatarUrl,
  toClientTrack,
} from "@/shared/api";
import type { Track } from "@/shared/types";

export interface ArtistAlbumViewModel {
  id: string;
  title: string;
  coverUrl: string;
  releaseDate?: string;
  totalTracks?: number;
  explicit?: boolean;
}

export interface ArtistReleaseViewModel extends ArtistAlbumViewModel {
  releaseType: "single" | "ep";
}

export interface ArtistPageData {
  title: string;
  description: string;
  coverUrl: string;
  geniusImageUrl?: string;
  geniusAka?: string[];
  geniusUsername?: string;
  monthlyListeners?: string;
  verified: boolean;
  followers?: number;
  totalListens?: number;
  totalTracks?: number;
  tracks: Track[];
  popularSongs: Track[];
  albums: ArtistAlbumViewModel[];
  reposts: Track[];
  singles: ArtistReleaseViewModel[];
}

function normalizeSong(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function mergeArtistTracks(...groups: Track[][]): Track[] {
  const seenIds = new Set<string>();
  const seenSongs = new Set<string>();
  return groups.flat().filter((track) => {
    if (!track?.id || seenIds.has(track.id)) return false;
    seenIds.add(track.id);
    const title = normalizeSong(track.title);
    if (!title) return true;
    const artists = normalizeSong(track.artists || track.artistId);
    const duration = track.durationMs ? Math.round(track.durationMs / 2000) : "";
    const songKey = `${title}|${artists}|${duration}`;
    if (seenSongs.has(songKey)) return false;
    seenSongs.add(songKey);
    return true;
  });
}

function formatArtistPage(
  artist: Awaited<ReturnType<typeof api.getArtist>>,
  tracks: Track[],
): ArtistPageData {
  const baseTracks = artist.tracks.map(toClientTrack);
  return {
    title: artist.name,
    monthlyListeners: artist.monthlyListeners,
    followers: artist.followers,
    verified: Boolean(artist.verified),
    description: artist.bio?.trim() || "",
    coverUrl: artist.cover
      ? toMaxQualityAvatarUrl(mediaUrl(artist.cover.url))
      : "",
    geniusImageUrl: artist.geniusImageUrl
      ? mediaUrl(artist.geniusImageUrl)
      : undefined,
    geniusAka: artist.geniusAka,
    geniusUsername: artist.geniusUsername,
    totalTracks: tracks.length,
    tracks,
    popularSongs: baseTracks.slice(0, 5),
    albums: artist.albums.map((album) => ({
      id: album.id,
      title: album.title,
      coverUrl: album.cover ? mediaUrl(album.cover.url) : "",
      ...(album.year ? { releaseDate: String(album.year) } : {}),
      totalTracks: album.totalTracks ?? album.trackCount,
      explicit: album.explicit,
    })),
    reposts: [],
    singles: artist.singles.map((single) => ({
      id: single.id,
      title: single.title,
      coverUrl: single.cover ? mediaUrl(single.cover.url) : "",
      releaseType: single.releaseType,
      ...(single.year ? { releaseDate: String(single.year) } : {}),
      totalTracks: single.totalTracks ?? single.trackCount,
      explicit: single.explicit,
    })),
  };
}

async function loadArtistPage(artistId: string): Promise<ArtistPageData> {
  const artist = await api.getArtist(artistId);
  const baseTracks = artist.tracks.map(toClientTrack);
  const initial = formatArtistPage(artist, baseTracks);

  const releaseIds = Array.from(
    new Set(
      [...artist.albums, ...artist.singles].map((r) => r.id).filter(Boolean),
    ),
  ).slice(0, 12);
  if (releaseIds.length > 0) {
    void (async () => {
      const releaseTracks = (
        await Promise.all(
          releaseIds.map((id) =>
            api
              .getAlbum(id)
              .then((album) => (album.tracks || []).map(toClientTrack))
              .catch(() => [] as Track[]),
          ),
        )
      ).flat();
      const merged = mergeArtistTracks(baseTracks, releaseTracks);
      if (merged.length <= baseTracks.length) return;
      queryCache.set(
        artistCacheKey(artistId),
        formatArtistPage(artist, merged),
        ARTIST_STALE_MS,
      );
    })().catch(() => undefined);
  }

  return initial;
}

const ARTIST_STALE_MS = 10 * 60 * 1000;

function artistCacheKey(id: string): string {
  return `artist:${id}`;
}

export function prefetchArtist(id: string): void {
  const key = artistCacheKey(id);
  if (queryCache.get(key)) return;
  void queryCache
    .fetchWithSwr(key, () => loadArtistPage(id), {
      staleTimeMs: ARTIST_STALE_MS,
    })
    .catch(() => undefined);
}

export function useArtist(id: string | null) {
  const cacheKey = id ? artistCacheKey(id) : null;
  const cached = cacheKey
    ? queryCache.get<ArtistPageData>(cacheKey)
    : undefined;
  const [data, setData] = useState<ArtistPageData | null>(cached ?? null);
  const [loading, setLoading] = useState<boolean>(!cached && Boolean(id));

  useEffect(() => {
    if (!id || !cacheKey) {
      setData(null);
      setLoading(false);
      return;
    }
    const initial = queryCache.get<ArtistPageData>(cacheKey);
    setData(initial ?? null);
    setLoading(!initial);

    let active = true;
    const unsubscribe = queryCache.subscribe<ArtistPageData>(
      cacheKey,
      (updated) => {
        if (!active) return;
        setData(updated);
        setLoading(false);
      },
    );
    void queryCache
      .fetchWithSwr(cacheKey, () => loadArtistPage(id), {
        staleTimeMs: ARTIST_STALE_MS,
      })
      .then(({ data: result }) => {
        if (!active) return;
        setData(result);
        setLoading(false);
      })
      .catch(() => {
        if (!active || queryCache.get(cacheKey)) return;
        setData(null);
        setLoading(false);
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [id, cacheKey]);

  return { data, loading };
}
