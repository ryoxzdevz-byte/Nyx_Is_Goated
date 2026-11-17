import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedTrackMeta } from "@/shared/media/saved";

const fsState = vi.hoisted(() => ({
  files: new Map<string, { data: string; encoding?: string }>(),
  downloads: [] as { url: string; path: string }[],
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    convertFileSrc: vi.fn(
      (uri: string) => `capacitor://localhost${uri.replace(/^file:/, "")}`,
    ),
  },
}));

vi.mock("@capacitor/file-transfer", () => ({
  FileTransfer: {
    downloadFile: vi.fn(async ({ url, path }) => {
      fsState.downloads.push({ url, path });
      const key = path.replace(/^file:\/\/\//, "").replace(/^file:\/\//, "");
      const bytes = new Uint8Array(32);
      bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
      let binary = "";
      bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      fsState.files.set(key, { data: btoa(binary) });
    }),
  },
}));

vi.mock("@capacitor/filesystem", () => ({
  Directory: { LibraryNoCloud: "LIBRARY_NO_CLOUD" },
  Encoding: { UTF8: "utf8" },
  Filesystem: {
    mkdir: vi.fn(async () => undefined),
    writeFile: vi.fn(async ({ path, data, encoding }) => {
      fsState.files.set(path, { data: String(data), encoding });
    }),
    readFile: vi.fn(async ({ path, encoding }) => {
      const entry = fsState.files.get(path);
      if (!entry) return { data: "" };
      if (encoding && !entry.encoding) return { data: atob(entry.data) };
      return { data: entry.data };
    }),
    stat: vi.fn(async ({ path }) => {
      const entry = fsState.files.get(path);
      if (!entry) throw new Error("missing");
      const bytes = entry.encoding
        ? new TextEncoder().encode(entry.data).length
        : atob(entry.data).length;
      return { size: bytes };
    }),
    getUri: vi.fn(async ({ path }) => ({ uri: `file:///${path}` })),
    rename: vi.fn(async ({ from, to }) => {
      const value = fsState.files.get(from);
      if (!value) throw new Error("missing");
      fsState.files.delete(from);
      fsState.files.set(to, value);
    }),
    deleteFile: vi.fn(async ({ path }) => {
      fsState.files.delete(path);
    }),
    rmdir: vi.fn(async ({ path }) => {
      for (const key of fsState.files.keys()) {
        if (key.startsWith(path)) fsState.files.delete(key);
      }
    }),
  },
}));

function binaryBytes(): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set([0x1a, 0x45, 0xdf, 0xa3]);
  return bytes;
}

function base64(bytes: Uint8Array): string {
  let value = "";
  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });
  return btoa(value);
}

const meta: SavedTrackMeta = {
  trackId: "track-1",
  title: "Song",
  artists: "Artist",
  durationMs: 1000,
};

describe("web saved tracks", () => {
  beforeEach(() => {
    fsState.files.clear();
    fsState.downloads.length = 0;
  });

  it("downloads audio natively and exposes a webview playback url", async () => {
    const { createWebSavedTracks } = await import("./savedTracks");
    const bridge = createWebSavedTracks();
    expect(bridge).not.toBeNull();

    const record = await bridge!.savedTracksDownload({
      meta,
      url: "https://media.example/song.webm",
      mimeType: "audio/webm",
      lyricsState: "found",
      lyrics: { lines: [] },
    });

    expect(record?.trackId).toBe("track-1");
    expect(record?.key).toMatch(/^[a-f0-9]{20}$/);
    expect(record?.localAudioUrl).toContain("capacitor://localhost");
    expect(fsState.downloads).toHaveLength(1);
    expect(await bridge!.savedTracksList()).toHaveLength(1);
    expect(await bridge!.savedTracksGetLyrics("track-1")).toEqual({
      lines: [],
    });
    expect((await bridge!.savedTracksUsage()).count).toBe(1);

    await bridge!.savedTracksRemove(["track-1"]);
    expect(await bridge!.savedTracksList()).toHaveLength(0);
  });

  it("saves cached bytes without a native transfer", async () => {
    const { createWebSavedTracks } = await import("./savedTracks");
    const bridge = createWebSavedTracks();

    const record = await bridge!.savedTracksSave({
      meta,
      audio: binaryBytes(),
      mimeType: "audio/webm",
    });

    expect(record?.byteSize).toBe(32);
    expect(fsState.downloads).toHaveLength(0);
  });

  it("rejects unsupported audio types", async () => {
    const { createWebSavedTracks } = await import("./savedTracks");
    const bridge = createWebSavedTracks();

    const record = await bridge!.savedTracksSave({
      meta,
      audio: binaryBytes(),
      mimeType: "text/html",
    });

    expect(record).toBeNull();
  });

  it("stays unavailable outside native platforms", async () => {
    const { Capacitor } = await import("@capacitor/core");
    vi.mocked(Capacitor.isNativePlatform).mockReturnValueOnce(false);
    const { createWebSavedTracks } = await import("./savedTracks");

    expect(createWebSavedTracks()).toBeNull();
  });

  it("writes binary data as base64", () => {
    expect(base64(binaryBytes()).length).toBe(44);
  });
});
