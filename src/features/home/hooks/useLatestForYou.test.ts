import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getHistory: vi.fn(),
  listLikedTracks: vi.fn(),
  getRadio: vi.fn(),
  getArtist: vi.fn(),
  getAlbum: vi.fn(),
  toClientTrack: vi.fn((track: any) => {
    const artistList = track?.artistList?.length
      ? track.artistList
      : Array.isArray(track?.artists)
        ? track.artists
        : [
            {
              id: track?.artistId ?? "sfera",
              name:
                typeof track?.artists === "string"
                  ? track.artists
                  : "Sfera Ebbasta",
            },
          ];
    return {
      ...track,
      artists:
        typeof track?.artists === "string"
          ? track.artists
          : artistList.map((artist: any) => artist.name).join(", "),
      artistId: track?.artistId ?? artistList[0]?.id ?? "sfera",
      artistList,
      coverUrl: track?.coverUrl ?? "",
      durationMs: track?.durationMs ?? 100_000,
    };
  }),
}));

vi.mock("@/shared/api", () => ({
  api: {
    getHistory: mocks.getHistory,
    listLikedTracks: mocks.listLikedTracks,
    getRadio: mocks.getRadio,
    getArtist: mocks.getArtist,
    getAlbum: mocks.getAlbum,
  },
  toClientTrack: mocks.toClientTrack,
}));

import { loadLatestForYou, rankArtists } from "./useLatestForYou";

function track(id: string, artists: { id: string; name: string }[]) {
  return {
    id,
    title: id,
    artists,
    durationMs: 100_000,
    cover: undefined,
  };
}

describe("loadLatestForYou", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getHistory.mockResolvedValue({
      items: [
        {
          track: track("seed", [{ id: "sfera", name: "Sfera Ebbasta" }]),
        },
      ],
    });
    mocks.listLikedTracks.mockResolvedValue({ items: [] });
    mocks.getRadio.mockResolvedValue({ items: [] });
    mocks.getArtist.mockResolvedValue({
      tracks: [],
      albums: [],
      singles: [],
    });
    mocks.getAlbum.mockResolvedValue({ tracks: [] });
  });

  it("never labels undated top songs as latest", async () => {
    mocks.getArtist.mockResolvedValue({
      tracks: [
        {
          id: "ayayay",
          title: "AYAYAY",
          artists: [{ id: "sfera", name: "Sfera Ebbasta" }],
          addedAt: new Date().toISOString(),
        },
      ],
      albums: [],
      singles: [],
    });

    expect(await loadLatestForYou(20)).toEqual([]);
  });

  it("only returns releases inside the recency window", async () => {
    const year = new Date().getUTCFullYear();
    mocks.getArtist.mockResolvedValue({
      tracks: [],
      albums: [
        { id: "new-release", year },
        { id: "old-release", year: year - 5 },
      ],
      singles: [],
    });
    mocks.getAlbum.mockImplementation(async (id: string) => ({
      tracks: [
        {
          id: id === "new-release" ? "new-track" : "old-track",
          title: id,
        },
      ],
    }));

    const items = await loadLatestForYou(20);
    expect(items.map((item) => item.item.id)).toEqual(["new-track"]);
  });
});

describe("rankArtists", () => {
  it("ranks the artist the listener finishes above one they skip", () => {
    const ranked = rankArtists([
      {
        track: track("a", [{ id: "sfera", name: "Sfera Ebbasta" }]),
        completionRate: 1,
        completed: true,
        playedDurationMs: 100_000,
      },
      {
        track: track("b", [{ id: "other", name: "Other" }]),
        completionRate: 0,
        playedDurationMs: 2_000,
      },
    ]);

    expect(ranked.map((artist) => artist.id)).toEqual(["sfera", "other"]);
  });

  it("counts every listening entry and splits collaborations", () => {
    const ranked = rankArtists(
      Array.from({ length: 3 }, (_, index) => ({
        track: track(`t${index}`, [
          { id: "sfera", name: "Sfera Ebbasta" },
          { id: "guest", name: "Guest" },
        ]),
        completionRate: 1,
        completed: true,
        playedDurationMs: 100_000,
      })),
    );

    expect(ranked.map((artist) => artist.id)).toEqual(["sfera", "guest"]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("uses liked tracks as a signal without an id", () => {
    const ranked = rankArtists(
      [],
      [
        {
          id: "liked",
          title: "Liked",
          artists: "Sfera Ebbasta",
          artistId: "sfera",
          artistList: [{ id: "sfera", name: "Sfera Ebbasta" }],
          coverUrl: "",
          durationMs: 100_000,
          playCount: 0,
        },
      ],
    );

    expect(ranked).toEqual([{ id: "sfera", name: "Sfera Ebbasta", score: 2 }]);
  });
});
