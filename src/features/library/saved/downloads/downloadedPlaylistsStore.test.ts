import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Track } from "@/shared/types";

const auth = vi.hoisted(() => ({ accountId: "account-a" as string | null }));

vi.mock("@/shared/api", () => ({
  getAuthSession: () =>
    auth.accountId ? { user: { id: auth.accountId } } : null,
}));

import {
  DOWNLOADED_PLAYLISTS_KEY,
  downloadedPlaylistById,
  downloadedPlaylistTracks,
  useDownloadedPlaylistsStore,
} from "./downloadedPlaylistsStore";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

const track = (id: string, overrides: Partial<Track> = {}): Track => ({
  id,
  title: `song ${id}`,
  artists: "artist",
  coverUrl: "",
  durationMs: 1000,
  playCount: 0,
  ...overrides,
});

function resetStore() {
  useDownloadedPlaylistsStore.setState({
    playlists: [],
    hydrated: false,
    accountId: null,
  });
}

describe("downloadedPlaylistsStore", () => {
  beforeEach(() => {
    auth.accountId = "account-a";
    vi.stubGlobal("localStorage", createStorage());
    resetStore();
  });

  afterEach(() => {
    resetStore();
    vi.unstubAllGlobals();
  });

  it("sanitizes saved playlists and tracks", () => {
    const saved = useDownloadedPlaylistsStore.getState().save({
      id: "playlist-1",
      title: "  ",
      coverUrl: "https://cover/1",
      coverUrls: ["https://cover/1", "", "https://cover/2"],
      tracks: [
        track("one", { durationMs: -50, coverUrl: "https://cover/one" }),
        { id: "broken", title: 42 } as unknown as Track,
      ],
    });

    expect(saved).toMatchObject({
      id: "playlist-1",
      title: "Untitled Playlist",
      coverUrl: "https://cover/1",
      coverUrls: ["https://cover/1", "https://cover/2"],
      trackCount: 1,
      revision: 0,
    });
    expect(saved?.tracks).toEqual([
      expect.objectContaining({
        id: "one",
        title: "song one",
        durationMs: 0,
        coverUrl: "https://cover/one",
      }),
    ]);
    expect(saved?.downloadedAt).toBeTypeOf("number");
  });

  it("replaces an existing playlist and moves it to the front", () => {
    const { save } = useDownloadedPlaylistsStore.getState();
    save({ id: "one", title: "One", tracks: [track("a")] });
    save({ id: "two", title: "Two", tracks: [track("b")] });
    save({ id: "one", title: "One updated", tracks: [track("c")] });

    expect(
      useDownloadedPlaylistsStore.getState().playlists.map((p) => p.title),
    ).toEqual(["One updated", "Two"]);
    expect(downloadedPlaylistById("one")?.tracks[0]?.id).toBe("c");
  });

  it("isolates saved playlists by account", () => {
    const { load, save } = useDownloadedPlaylistsStore.getState();
    load();
    save({ id: "a", title: "Account A", tracks: [track("a")] });

    auth.accountId = "account-b";
    load();
    expect(useDownloadedPlaylistsStore.getState().playlists).toEqual([]);
    save({ id: "b", title: "Account B", tracks: [track("b"), track("c")] });

    auth.accountId = "account-a";
    load();
    expect(
      useDownloadedPlaylistsStore.getState().playlists.map((p) => p.title),
    ).toEqual(["Account A"]);

    auth.accountId = "account-b";
    load();
    expect(downloadedPlaylistTracks().map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("removes and clears only the current account", () => {
    const { clear, load, remove, save } = useDownloadedPlaylistsStore.getState();
    load();
    save({ id: "one", title: "One", tracks: [track("a")] });
    save({ id: "two", title: "Two", tracks: [track("b")] });

    remove("one");
    expect(
      useDownloadedPlaylistsStore.getState().playlists.map((p) => p.id),
    ).toEqual(["two"]);

    clear();
    expect(useDownloadedPlaylistsStore.getState().playlists).toEqual([]);
    expect(localStorage.getItem(`${DOWNLOADED_PLAYLISTS_KEY}:account-a`)).toBe(
      "[]",
    );
    expect(localStorage.getItem(`${DOWNLOADED_PLAYLISTS_KEY}:account-b`)).toBe(
      null,
    );
  });

  it("loads persisted playlists for the active account", () => {
    const { load, save } = useDownloadedPlaylistsStore.getState();
    load();
    save({ id: "one", title: "One", tracks: [track("a")] });

    resetStore();
    useDownloadedPlaylistsStore.getState().load();
    expect(downloadedPlaylistById("one")?.title).toBe("One");
  });

  it("rejects playlists without an id", () => {
    const saved = useDownloadedPlaylistsStore.getState().save({
      id: "",
      title: "Broken",
      tracks: [track("a")],
    });
    expect(saved).toBeNull();
    expect(useDownloadedPlaylistsStore.getState().playlists).toEqual([]);
  });
});
