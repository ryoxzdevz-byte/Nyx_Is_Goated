import { describe, expect, it } from "vitest";
import { rankArtists } from "./useLatestForYou";

function track(id: string, artists: { id: string; name: string }[]) {
  return {
    id,
    title: id,
    artists,
    durationMs: 100_000,
    cover: undefined,
  };
}

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

    expect(ranked).toEqual([
      { id: "sfera", name: "Sfera Ebbasta", score: 2 },
    ]);
  });
});
