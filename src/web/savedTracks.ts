import { Capacitor } from "@capacitor/core";
import { FileTransfer } from "@capacitor/file-transfer";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { isStandaloneAudioFile } from "@/shared/storage/audioFormat";
import type {
  SavedLibraryUsage,
  SavedLyricsState,
  SavedTrackDownloadInput,
  SavedTrackInput,
  SavedTrackRecord,
  SavedTracksPartUsage,
} from "@/shared/media/saved";

const ROOT = "saved-tracks";
const INDEX_FILE = "library.json";
const AUDIO_DIR = "audio";
const COVER_DIR = "covers";
const LYRICS_DIR = "lyrics";
const MAX_AUDIO_BYTES = 200 * 1024 * 1024;
const MAX_LYRICS_JSON_LENGTH = 2_000_000;

const AUDIO_EXTENSIONS: Record<string, string> = {
  "audio/webm": "webm",
  "video/webm": "webm",
  "audio/mp4": "m4a",
  "video/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/flac": "flac",
  "audio/wav": "wav",
};

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function baseMime(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

function rotateLeft(value: number, bits: number): number {
  return (value << bits) | (value >>> (32 - bits));
}

function sha1Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const bitLength = bytes.length * 8;
  const totalLength =
    bytes.length + 1 + 8 + ((63 - ((bytes.length + 8) % 64)) % 64);
  const data = new Uint8Array(totalLength);
  data.set(bytes);
  data[bytes.length] = 0x80;
  const view = new DataView(data.buffer);
  view.setUint32(totalLength - 8, Math.floor(bitLength / 0x1_0000_0000));
  view.setUint32(totalLength - 4, bitLength >>> 0);

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;
  const words = new Uint32Array(80);

  for (let offset = 0; offset < totalLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4);
    }
    for (let index = 16; index < 80; index += 1) {
      words[index] = rotateLeft(
        words[index - 3] ^
          words[index - 8] ^
          words[index - 14] ^
          words[index - 16],
        1,
      );
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    for (let index = 0; index < 80; index += 1) {
      let mix: number;
      let constant: number;
      if (index < 20) {
        mix = (b & c) | (~b & d);
        constant = 0x5a827999;
      } else if (index < 40) {
        mix = b ^ c ^ d;
        constant = 0x6ed9eba1;
      } else if (index < 60) {
        mix = (b & c) | (b & d) | (c & d);
        constant = 0x8f1bbcdc;
      } else {
        mix = b ^ c ^ d;
        constant = 0xca62c1d6;
      }
      const next = (rotateLeft(a, 5) + mix + e + constant + words[index]) >>> 0;
      e = d;
      d = c;
      c = rotateLeft(b, 30);
      b = a;
      a = next;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4]
    .map((value) => value.toString(16).padStart(8, "0"))
    .join("");
}

function savedTrackKey(trackId: string): string {
  return sha1Hex(trackId).slice(0, 20);
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + chunkSize),
    );
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function pathFor(...parts: string[]): string {
  return [ROOT, ...parts].join("/");
}

function detail(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

class WebSavedTrackLibrary {
  private records: SavedTrackRecord[] | null = null;
  private queue: Promise<unknown> = Promise.resolve();

  private serialized<T>(task: () => Promise<T>): Promise<T> {
    const next = this.queue.then(task, task);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async ensureDirs(): Promise<void> {
    for (const folder of [
      ROOT,
      pathFor(AUDIO_DIR),
      pathFor(COVER_DIR),
      pathFor(LYRICS_DIR),
    ]) {
      await Filesystem.mkdir({
        path: folder,
        directory: Directory.LibraryNoCloud,
        recursive: true,
      });
    }
  }

  private async load(): Promise<SavedTrackRecord[]> {
    if (this.records) return this.records;
    await this.ensureDirs();
    try {
      const result = await Filesystem.readFile({
        path: pathFor(INDEX_FILE),
        directory: Directory.LibraryNoCloud,
        encoding: Encoding.UTF8,
      });
      const parsed: unknown = JSON.parse(String(result.data));
      this.records = Array.isArray(parsed)
        ? (parsed as SavedTrackRecord[])
        : [];
    } catch {
      this.records = [];
    }
    return this.records;
  }

  private async writeIndex(records: SavedTrackRecord[]): Promise<void> {
    await this.ensureDirs();
    const temp = pathFor(`${INDEX_FILE}.tmp`);
    await Filesystem.writeFile({
      path: temp,
      data: JSON.stringify(records.map(stripLocalUrls)),
      directory: Directory.LibraryNoCloud,
      encoding: Encoding.UTF8,
      recursive: true,
    });
    await this.removeFile(pathFor(INDEX_FILE));
    await Filesystem.rename({
      from: temp,
      to: pathFor(INDEX_FILE),
      directory: Directory.LibraryNoCloud,
    });
    this.records = records;
  }

  private async removeFile(relativePath: string): Promise<void> {
    await Filesystem.deleteFile({
      path: relativePath,
      directory: Directory.LibraryNoCloud,
    }).catch(() => undefined);
  }

  private async stat(relativePath: string): Promise<number | null> {
    try {
      const info = await Filesystem.stat({
        path: relativePath,
        directory: Directory.LibraryNoCloud,
      });
      return info.size;
    } catch {
      return null;
    }
  }

  private async head(relativePath: string): Promise<Uint8Array> {
    try {
      const result = await Filesystem.readFile({
        path: relativePath,
        directory: Directory.LibraryNoCloud,
        offset: 0,
        length: 16,
      });
      return typeof result.data === "string"
        ? base64ToBytes(result.data)
        : new Uint8Array();
    } catch {
      return new Uint8Array();
    }
  }

  private async writeBytes(
    relativePath: string,
    bytes: Uint8Array,
  ): Promise<void> {
    await this.ensureDirs();
    await Filesystem.writeFile({
      path: relativePath,
      data: bytesToBase64(bytes),
      directory: Directory.LibraryNoCloud,
      recursive: true,
    });
  }

  private async webViewUrl(relativePath: string): Promise<string | undefined> {
    try {
      const { uri } = await Filesystem.getUri({
        path: relativePath,
        directory: Directory.LibraryNoCloud,
      });
      return Capacitor.convertFileSrc(uri);
    } catch {
      return undefined;
    }
  }

  private async downloadBytes(
    url: string,
    relativePath: string,
    headers?: Record<string, string>,
  ): Promise<void> {
    const temporary = `${relativePath}.part`;
    await this.removeFile(temporary);
    const { uri } = await Filesystem.getUri({
      path: temporary,
      directory: Directory.LibraryNoCloud,
    });
    try {
      await FileTransfer.downloadFile({
        url,
        path: uri,
        headers: headers ?? {},
        progress: false,
        readTimeout: 10 * 60_000,
        connectTimeout: 30_000,
        shouldEncodeUrlParams: false,
      });
      await this.removeFile(relativePath);
      await Filesystem.rename({
        from: temporary,
        to: relativePath,
        directory: Directory.LibraryNoCloud,
      });
    } catch (error) {
      await this.removeFile(temporary);
      throw error;
    }
  }

  private async decorate(
    record: SavedTrackRecord,
  ): Promise<SavedTrackRecord | null> {
    const size = await this.stat(pathFor(AUDIO_DIR, record.audioFile));
    if (size === null || size <= 0) return null;
    const audioUrl = await this.webViewUrl(
      pathFor(AUDIO_DIR, record.audioFile),
    );
    const coverUrl = record.coverFile
      ? await this.webViewUrl(pathFor(COVER_DIR, record.coverFile))
      : undefined;
    return {
      ...record,
      ...(audioUrl ? { localAudioUrl: audioUrl } : {}),
      ...(coverUrl ? { localCoverUrl: coverUrl } : {}),
    };
  }

  list(): Promise<SavedTrackRecord[]> {
    return this.serialized(async () => {
      const records = await this.load();
      const present: SavedTrackRecord[] = [];
      for (const record of records) {
        const decorated = await this.decorate(record);
        if (decorated) present.push(decorated);
      }
      if (present.length !== records.length) {
        await this.writeIndex(present.map(stripLocalUrls));
      }
      return present;
    });
  }

  save(
    input: SavedTrackInput | SavedTrackDownloadInput,
  ): Promise<SavedTrackRecord | null> {
    return this.serialized(async () => {
      const isDownload = "url" in input;
      const extension = AUDIO_EXTENSIONS[baseMime(input.mimeType)];
      if (!extension) return null;
      const key = savedTrackKey(input.meta.trackId);
      const records = await this.load();
      const previous = records.find((record) => record.key === key);
      const audioFile = `${key}.${extension}`;
      const audioPath = pathFor(AUDIO_DIR, audioFile);

      try {
        if (isDownload) {
          await this.downloadBytes(input.url, audioPath, input.headers);
        } else {
          if (
            input.audio.byteLength === 0 ||
            input.audio.byteLength > MAX_AUDIO_BYTES
          )
            return null;
          await this.writeBytes(audioPath, input.audio);
        }
      } catch {
        await this.removeFile(audioPath);
        return null;
      }

      const byteSize = await this.stat(audioPath);
      if (byteSize === null || byteSize <= 0 || byteSize > MAX_AUDIO_BYTES) {
        await this.removeFile(audioPath);
        return null;
      }
      if (!isStandaloneAudioFile(await this.head(audioPath))) {
        await this.removeFile(audioPath);
        return null;
      }
      if (previous && previous.audioFile !== audioFile) {
        await this.removeFile(pathFor(AUDIO_DIR, previous.audioFile));
      }

      let coverFile: string | undefined;
      const cover = "cover" in input ? input.cover : undefined;
      const coverExtension = cover
        ? IMAGE_EXTENSIONS[baseMime(cover.mimeType)]
        : undefined;
      if (cover && coverExtension && cover.data.byteLength > 0) {
        coverFile = `${key}.${coverExtension}`;
        await this.writeBytes(pathFor(COVER_DIR, coverFile), cover.data);
      } else if (previous?.coverFile) {
        coverFile = previous.coverFile;
      }

      let lyrics = previous?.lyrics;
      if (input.lyricsState === "found" && input.lyrics) {
        const json = JSON.stringify(input.lyrics);
        if (json.length <= MAX_LYRICS_JSON_LENGTH) {
          await this.writeBytes(
            pathFor(LYRICS_DIR, `${key}.json`),
            new TextEncoder().encode(json),
          );
          lyrics = "found";
        }
      } else if (input.lyricsState === "missing") {
        await this.removeFile(pathFor(LYRICS_DIR, `${key}.json`));
        lyrics = "missing";
      }

      const base: SavedTrackRecord = {
        ...input.meta,
        key,
        audioFile,
        mimeType: baseMime(input.mimeType).replace(/^video\//, "audio/"),
        ...(coverFile ? { coverFile } : {}),
        byteSize,
        savedAt: previous?.savedAt ?? Date.now(),
        ...(lyrics ? { lyrics } : {}),
      };
      const decorated = await this.decorate(base);
      if (!decorated) return null;
      await this.writeIndex([
        ...records.filter((record) => record.key !== key),
        decorated,
      ]);
      return decorated;
    });
  }

  remove(trackIds: string[]): Promise<number> {
    return this.serialized(async () => {
      const removing = new Set(trackIds);
      const records = await this.load();
      const gone = records.filter((record) => removing.has(record.trackId));
      if (gone.length === 0) return 0;
      for (const record of gone) {
        await this.removeFile(pathFor(AUDIO_DIR, record.audioFile));
        if (record.coverFile)
          await this.removeFile(pathFor(COVER_DIR, record.coverFile));
        await this.removeFile(pathFor(LYRICS_DIR, `${record.key}.json`));
      }
      await this.writeIndex(
        records.filter((record) => !removing.has(record.trackId)),
      );
      return gone.length;
    });
  }

  removeAll(): Promise<number> {
    return this.serialized(async () => {
      const records = await this.load();
      for (const folder of [AUDIO_DIR, COVER_DIR, LYRICS_DIR]) {
        await Filesystem.rmdir({
          path: pathFor(folder),
          directory: Directory.LibraryNoCloud,
          recursive: true,
        }).catch(() => undefined);
      }
      await this.ensureDirs();
      await this.writeIndex([]);
      return records.length;
    });
  }

  async usage(): Promise<SavedLibraryUsage> {
    const records = await this.list();
    let bytes = 0;
    for (const record of records) {
      bytes += record.byteSize;
      if (record.coverFile) {
        bytes += (await this.stat(pathFor(COVER_DIR, record.coverFile))) ?? 0;
      }
    }
    return { count: records.length, bytes, freeBytes: null };
  }

  async usageOf(trackIds: string[]): Promise<SavedTracksPartUsage> {
    const wanted = new Set(trackIds);
    const records = (await this.list()).filter((record) =>
      wanted.has(record.trackId),
    );
    let bytes = 0;
    for (const record of records) {
      bytes += record.byteSize;
      if (record.coverFile) {
        bytes += (await this.stat(pathFor(COVER_DIR, record.coverFile))) ?? 0;
      }
    }
    return { count: records.length, bytes };
  }

  async getLyrics(trackId: string): Promise<unknown | null> {
    const records = await this.list();
    const record = records.find((entry) => entry.trackId === trackId);
    if (!record || record.lyrics !== "found") return null;
    try {
      const result = await Filesystem.readFile({
        path: pathFor(LYRICS_DIR, `${record.key}.json`),
        directory: Directory.LibraryNoCloud,
        encoding: Encoding.UTF8,
      });
      return JSON.parse(String(result.data));
    } catch {
      return null;
    }
  }

  setLyrics(
    trackId: string,
    state: SavedLyricsState,
    lyrics?: unknown,
  ): Promise<boolean> {
    return this.serialized(async () => {
      const records = await this.load();
      const record = records.find((entry) => entry.trackId === trackId);
      if (!record) return false;
      if (state === "found" && lyrics !== undefined) {
        const json = JSON.stringify(lyrics);
        if (json.length > MAX_LYRICS_JSON_LENGTH) return false;
        await this.writeBytes(
          pathFor(LYRICS_DIR, `${record.key}.json`),
          new TextEncoder().encode(json),
        );
      } else {
        await this.removeFile(pathFor(LYRICS_DIR, `${record.key}.json`));
      }
      await this.writeIndex(
        records.map((entry) =>
          entry.trackId === trackId
            ? stripLocalUrls({ ...entry, lyrics: state })
            : entry,
        ),
      );
      return true;
    });
  }
}

function stripLocalUrls(record: SavedTrackRecord): SavedTrackRecord {
  const result = { ...record };
  delete result.localAudioUrl;
  delete result.localCoverUrl;
  return result;
}

export function createWebSavedTracks() {
  if (!Capacitor.isNativePlatform()) return null;
  const library = new WebSavedTrackLibrary();
  return {
    savedTracksList: () => library.list(),
    savedTracksSave: (input: SavedTrackInput) => library.save(input),
    savedTracksDownload: (input: SavedTrackDownloadInput) =>
      library.save(input),
    savedTracksRemove: (trackIds: string[]) => library.remove(trackIds),
    savedTracksRemoveAll: () => library.removeAll(),
    savedTracksUsage: () => library.usage(),
    savedTracksUsageOf: (trackIds: string[]) => library.usageOf(trackIds),
    savedTracksGetLyrics: (trackId: string) => library.getLyrics(trackId),
    savedTracksSetLyrics: (
      trackId: string,
      state: SavedLyricsState,
      lyrics?: unknown,
    ) => library.setLyrics(trackId, state, lyrics),
  };
}

export function describeSavedTrackError(error: unknown): string {
  return detail(error);
}
