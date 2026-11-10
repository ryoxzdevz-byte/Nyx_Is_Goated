import { api, toClientTrack } from "@/shared/api";
import type { ApiTrack } from "@/shared/contracts";
import type { Track } from "@/shared/types";
import type { PopularItem } from "./usePopularTracks";
import { loadWithRetry, useSessionOwner } from "./sessionAwareLoad";
import { freshFor, useCachedResource } from "@/shared/cache/useCachedResource";

const HISTORY_LIMIT = 100;
const LIKED_LIMIT = 50;
const MAX_ARTISTS = 4;
const MAX_RELEASES = 6;
const MAX_RELEASES_PER_ARTIST = 2;
const MAX_TRACKS_PER_RELEASE = 8;

const EMPTY_ITEMS: PopularItem[] = [];
const LATEST_POLICY = {
  isFresh: freshFor(10 * 60_000),
  revalidateOnFocus: true,
  sessionOnly: true,
};

export interface ArtistSignal {
  id: string;
  name: string;
  score: number;
}

interface HistorySignal {
  completionRate?: number;
  completed?: boolean;
  playedDurationMs?: number;
  track?: unknown;
}

function addArtist(
  scores: Map<string, ArtistSignal>,
  id: string | undefined,
  name: string,
  weight: number,
) {
  if (!id || !name) return;
  const key = id.trim();
  if (!key) return;
  const existing = scores.get(key);
  if (existing) {
    existing.score += weight;
    if (!existing.name) existing.name = name;
    return;
  }
  scores.set(key, { id: key, name, score: weight });
}

export function rankArtists(
  history: HistorySignal[],
  likedTracks: Track[] = [],
): ArtistSignal[] {
  const scores = new Map<string, ArtistSignal>();

  for (const entry of history) {
    const track = toClientTrack(entry.track);
    const completion = Math.max(
      0,
      Math.min(1, entry.completionRate ?? (entry.completed ? 1 : 0)),
    );
    const played =
      track.durationMs > 0
        ? Math.min(1, (entry.playedDurationMs ?? 0) / track.durationMs)
        : 0;
    const weight = 1 + completion + played + (entry.completed ? 0.5 : 0);
    const artists = track.artistList?.length
      ? track.artistList
      : [{ id: track.artistId, name: track.artists }];
    artists.forEach((artist, index) => {
      addArtist(scores, artist.id, artist.name, weight * (index === 0 ? 1 : 0.6));
    });
  }

  for (const track of likedTracks) {
    const artists = track.artistList?.length
      ? track.artistList
      : [{ id: track.artistId, name: track.artists }];
    artists.forEach((artist, index) => {
      addArtist(scores, artist.id, artist.name, index === 0 ? 2 : 1.2);
    });
  }

  return [...scores.values()].sort((a, b) => b.score - a.score);
}

function releaseYear(value?: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function trackReleaseDate(track: ApiTrack): number {
  const raw = track as ApiTrack & {
    releaseDate?: string;
    addedAt?: string;
  };
  const value = raw.releaseDate ?? raw.addedAt;
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadHistory(): Promise<{
  history: HistorySignal[];
  likedTracks: Track[];
  seedTrackId?: string;
}> {
  const [history, liked] = await Promise.allSettled([
    loadWithRetry(
      () => api.getHistory(undefined, HISTORY_LIMIT),
      () => true,
    ),
    api.listLikedTracks(LIKED_LIMIT),
  ]);

  const historyItems = history.status === "fulfilled" ? history.value.items ?? [] : [];
  const seed = historyItems
    .map((entry) => toClientTrack(entry.track))
    .find((track) => track.id);

  return {
    history: historyItems,
    likedTracks:
      liked.status === "fulfilled"
        ? (liked.value.items ?? []).map((entry) =>
            toClientTrack(entry.track ?? entry),
          )
        : [],
    seedTrackId: seed?.id,
  };
}

async function findSimilarArtists(
  seedTrackId: string | undefined,
  knownArtistIds: Set<string>,
): Promise<ArtistSignal[]> {
  if (!seedTrackId) return [];
  try {
    const response = await api.getRadio(seedTrackId, { k: 20 });
    const scores = new Map<string, ArtistSignal>();
    for (const track of response.items ?? []) {
      for (const artist of track.artists ?? []) {
        if (!artist.id || knownArtistIds.has(artist.id)) continue;
        const existing = scores.get(artist.id);
        if (existing) existing.score += 1;
        else scores.set(artist.id, { ...artist, score: 1 });
      }
    }
    return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 2);
  } catch {
    return [];
  }
}

export async function loadLatestForYou(limit = 20): Promise<PopularItem[]> {
  const { history, likedTracks, seedTrackId } = await loadHistory();
  const topArtists = rankArtists(history, likedTracks).slice(0, MAX_ARTISTS);
  if (topArtists.length === 0) return EMPTY_ITEMS;

  const topIds = new Set(topArtists.map((artist) => artist.id));
  const [topDetails, similarArtists] = await Promise.all([
    Promise.all(
      topArtists.map((artist) =>
        api.getArtist(artist.id).catch(() => null),
      ),
    ),
    findSimilarArtists(seedTrackId, topIds),
  ]);
  const similarDetails = await Promise.all(
    similarArtists.map((artist) =>
      api.getArtist(artist.id).catch(() => null),
    ),
  );
  const details = [...topDetails, ...similarDetails];

  type Candidate = {
    track: ApiTrack;
    artistRank: number;
    date: number;
    releaseYear: number;
  };

  const candidates: Candidate[] = [];
  const fallback: Candidate[] = [];
  const releasesToLoad: {
    id: string;
    artistRank: number;
    year: number;
  }[] = [];
  const seenReleaseIds = new Set<string>();

  details.forEach((detail, artistRank) => {
    if (!detail) return;

    const rawTracks = detail.tracks ?? [];
    const datedTracks = rawTracks
      .map((track) => ({ track, date: trackReleaseDate(track) }))
      .filter((entry) => entry.date > 0)
      .sort((a, b) => b.date - a.date);

    if (datedTracks.length >= 3) {
      for (const entry of datedTracks.slice(0, MAX_RELEASES_PER_ARTIST * 3)) {
        candidates.push({
          track: entry.track,
          artistRank,
          date: entry.date,
          releaseYear: new Date(entry.date).getFullYear(),
        });
      }
      return;
    }

    for (const track of rawTracks.slice(0, 2)) {
      fallback.push({ track, artistRank, date: 0, releaseYear: 0 });
    }

    const releases = [...(detail.singles ?? []), ...(detail.albums ?? [])]
      .filter((release) => release.id)
      .sort((a, b) => releaseYear(b.year) - releaseYear(a.year));

    let picked = 0;
    for (const release of releases) {
      if (picked >= MAX_RELEASES_PER_ARTIST) break;
      if (seenReleaseIds.has(release.id)) continue;
      seenReleaseIds.add(release.id);
      releasesToLoad.push({
        id: release.id,
        artistRank,
        year: releaseYear(release.year),
      });
      picked += 1;
    }
  });

  const releaseResults = await Promise.all(
    releasesToLoad.slice(0, MAX_RELEASES).map((release) =>
      api
        .getAlbum(release.id)
        .then((album) => ({ album, release }))
        .catch(() => null),
    ),
  );

  for (const result of releaseResults) {
    if (!result) continue;
    const albumDate = result.album.tracks
      .map(trackReleaseDate)
      .find((date) => date > 0);
    for (const track of result.album.tracks.slice(0, MAX_TRACKS_PER_RELEASE)) {
      candidates.push({
        track,
        artistRank: result.release.artistRank,
        date: albumDate ?? 0,
        releaseYear: result.release.year,
      });
    }
  }

  if (candidates.length < limit) {
    candidates.push(...fallback);
  }

  candidates.sort((a, b) => {
    if (b.date !== a.date) return b.date - a.date;
    if (b.releaseYear !== a.releaseYear) {
      return b.releaseYear - a.releaseYear;
    }
    return a.artistRank - b.artistRank;
  });

  const seenTracks = new Set<string>();
  const items: PopularItem[] = [];
  for (const candidate of candidates) {
    if (!candidate.track?.id || seenTracks.has(candidate.track.id)) continue;
    seenTracks.add(candidate.track.id);
    items.push({
      type: "track",
      item: toClientTrack(candidate.track),
      playCount: 0,
    });
    if (items.length >= limit) break;
  }

  return items.length > 0 ? items : EMPTY_ITEMS;
}

export function useLatestForYou(limit = 20) {
  const owner = useSessionOwner();
  const { data, isLoading } = useCachedResource(
    `home:latest-for-you:${owner}:${limit}`,
    () => loadLatestForYou(limit),
    LATEST_POLICY,
  );
  return { items: data ?? EMPTY_ITEMS, isLoading };
}
