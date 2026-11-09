import { create } from "zustand";
import { getAuthSession } from "@/shared/api";
import type { Track } from "@/shared/types";

export const DOWNLOADED_PLAYLISTS_KEY = "liner_downloaded_playlists_v1";
const MAX_TRACKS_PER_PLAYLIST = 10_000;

export interface DownloadedPlaylist {
  id: string;
  title: string;
  description?: string;
  coverUrl: string;
  coverUrls: string[];
  revision: number;
  trackCount: number;
  tracks: Track[];
  durationMs?: number;
  downloadedAt: number;
}

export interface PlaylistDownloadInput {
  id: string;
  title: string;
  description?: string;
  coverUrl?: string;
  coverUrls?: string[];
  revision?: number;
  trackCount?: number;
  durationMs?: number;
  tracks: Track[];
}

interface DownloadedPlaylistsState {
  playlists: DownloadedPlaylist[];
  hydrated: boolean;
  accountId: string | null;
  load: () => void;
  save: (playlist: PlaylistDownloadInput) => DownloadedPlaylist | null;
  remove: (id: string) => void;
  clear: () => void;
}

function currentAccountId(): string | null {
  return getAuthSession()?.user?.id ?? null;
}

function storageKey(accountId: string | null): string {
  return `${DOWNLOADED_PLAYLISTS_KEY}:${accountId ?? "anonymous"}`;
}

function readStorage(accountId: string | null): DownloadedPlaylist[] {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is DownloadedPlaylist =>
      Boolean(
        entry &&
        typeof entry === "object" &&
        typeof (entry as DownloadedPlaylist).id === "string" &&
        Array.isArray((entry as DownloadedPlaylist).tracks),
      ),
    );
  } catch {
    return [];
  }
}

function writeStorage(
  accountId: string | null,
  playlists: DownloadedPlaylist[],
) {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(playlists));
  } catch {}
}

function sanitizeTrack(track: Track): Track | null {
  if (!track || typeof track.id !== "string" || !track.id) return null;
  if (typeof track.title !== "string") return null;
  return {
    id: track.id,
    title: track.title,
    artists: typeof track.artists === "string" ? track.artists : "",
    coverUrl: typeof track.coverUrl === "string" ? track.coverUrl : "",
    durationMs:
      typeof track.durationMs === "number" && Number.isFinite(track.durationMs)
        ? Math.max(0, track.durationMs)
        : 0,
    playCount: 0,
    ...(track.playlistItemId ? { playlistItemId: track.playlistItemId } : {}),
    ...(track.artistId ? { artistId: track.artistId } : {}),
    ...(track.artistList ? { artistList: track.artistList } : {}),
    ...(track.explicit ? { explicit: true } : {}),
    ...(track.audioVariant ? { audioVariant: track.audioVariant } : {}),
    ...(track.releaseDate ? { releaseDate: track.releaseDate } : {}),
    ...(track.addedAt ? { addedAt: track.addedAt } : {}),
    ...(track.album ? { album: track.album } : {}),
  };
}

function sanitizePlaylist(
  playlist: PlaylistDownloadInput,
): DownloadedPlaylist | null {
  if (!playlist || typeof playlist.id !== "string" || !playlist.id) return null;
  const tracks = playlist.tracks
    .map(sanitizeTrack)
    .filter((track): track is Track => track !== null)
    .slice(0, MAX_TRACKS_PER_PLAYLIST);
  const coverUrls = (playlist.coverUrls ?? [])
    .filter((url): url is string => typeof url === "string" && url.length > 0)
    .slice(0, 4);
  const coverUrl =
    typeof playlist.coverUrl === "string" ? playlist.coverUrl : "";
  return {
    id: playlist.id,
    title:
      typeof playlist.title === "string" && playlist.title.trim()
        ? playlist.title
        : "Untitled Playlist",
    ...(typeof playlist.description === "string" && playlist.description
      ? { description: playlist.description }
      : {}),
    coverUrl,
    coverUrls: coverUrls.length > 0 ? coverUrls : coverUrl ? [coverUrl] : [],
    revision:
      typeof playlist.revision === "number" &&
      Number.isFinite(playlist.revision)
        ? playlist.revision
        : 0,
    trackCount: tracks.length,
    tracks,
    ...(typeof playlist.durationMs === "number" &&
    Number.isFinite(playlist.durationMs)
      ? { durationMs: playlist.durationMs }
      : {}),
    downloadedAt: Date.now(),
  };
}

export const useDownloadedPlaylistsStore = create<DownloadedPlaylistsState>(
  (set, get) => ({
    playlists: [],
    hydrated: false,
    accountId: null,

    load: () => {
      const accountId = currentAccountId();
      if (get().hydrated && get().accountId === accountId) return;
      set({
        accountId,
        playlists: readStorage(accountId),
        hydrated: true,
      });
    },

    save: (playlist) => {
      const next = sanitizePlaylist(playlist);
      if (!next) return null;
      const accountId = currentAccountId();
      const playlists = [
        next,
        ...get().playlists.filter((entry) => entry.id !== next.id),
      ];
      writeStorage(accountId, playlists);
      set({ accountId, playlists, hydrated: true });
      return next;
    },

    remove: (id) => {
      const accountId = currentAccountId();
      const playlists = get().playlists.filter((entry) => entry.id !== id);
      writeStorage(accountId, playlists);
      set({ accountId, playlists, hydrated: true });
    },

    clear: () => {
      const accountId = currentAccountId();
      writeStorage(accountId, []);
      set({ accountId, playlists: [], hydrated: true });
    },
  }),
);

export function downloadedPlaylistById(
  id: string | null | undefined,
): DownloadedPlaylist | undefined {
  return id
    ? useDownloadedPlaylistsStore
        .getState()
        .playlists.find((playlist) => playlist.id === id)
    : undefined;
}

export function downloadedPlaylistTracks(): Track[] {
  return useDownloadedPlaylistsStore
    .getState()
    .playlists.flatMap((playlist) => playlist.tracks);
}

if (typeof window !== "undefined") {
  window.addEventListener("auth:changed", () => {
    useDownloadedPlaylistsStore.getState().load();
  });
}
