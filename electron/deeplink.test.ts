import { describe, expect, it } from "vitest";
import { findDeeplinkArg, parseDeeplink } from "./deeplink";

describe("parseDeeplink", () => {
  it("accepts real share targets", () => {
    expect(parseDeeplink("nyx://artist?id=UCGtGpOIGHfRu1KYL9pi-mNQ")).toEqual({
      type: "artist",
      id: "UCGtGpOIGHfRu1KYL9pi-mNQ",
    });
    expect(parseDeeplink("nyx://album?id=MPREb_xCxkOKReFZv")).toEqual({
      type: "album",
      id: "MPREb_xCxkOKReFZv",
    });
    expect(
      parseDeeplink("nyx://playlist?id=VLPLD8jNKEyHYB2DHh5vXSI4USLFo29vzUYl"),
    ).toEqual({ type: "playlist", id: "VLPLD8jNKEyHYB2DHh5vXSI4USLFo29vzUYl" });
    expect(parseDeeplink("nyx://track?id=RGdkabupfPI")).toEqual({
      type: "track",
      id: "RGdkabupfPI",
    });
  });

  it("accepts artist names used when a track has no channel id", () => {
    expect(parseDeeplink("nyx://artist?id=LATIN%20MAFIA")).toEqual({
      type: "artist",
      id: "LATIN MAFIA",
    });
  });

  it("rejects smuggled urls", () => {
    expect(parseDeeplink("https://evil.com")).toBeNull();
    expect(parseDeeplink("javascript:alert(1)")).toBeNull();
    expect(parseDeeplink("nyx://artist?id=LATIN%20MAFIA%0A")).toBeNull();
    expect(
      parseDeeplink("nyx://artist?id=UCaaaaaaaaaaaaaaaaaaaaaa&x=1&y=2"),
    ).toEqual({
      type: "artist",
      id: "UCaaaaaaaaaaaaaaaaaaaaaa",
    });
    expect(
      parseDeeplink(
        "nyx://artist?id=UCaaaaaaaaaaaaaaaaaaaaaa&id=UCbbbbbbbbbbbbbbbbbbbbbb",
      ),
    ).toBeNull();
    expect(parseDeeplink("nyx://artist")).toBeNull();
    expect(parseDeeplink("nyx://evil?id=RGdkabupfPI")).toBeNull();
    expect(parseDeeplink("nyx://track?id=RGdkabupfPIextra")).toBeNull();
    expect(
      parseDeeplink("nyx://artist?id=ABaaaaaaaaaaaaaaaaaaaaaa"),
    ).toBeNull();
    expect(parseDeeplink("nyx://artist?id=UCaaa/../../../../etc")).toBeNull();
    expect(parseDeeplink("not a url")).toBeNull();
  });

  it("finds the deeplink arg anywhere in argv", () => {
    expect(
      findDeeplinkArg(["/usr/bin/nyx", "nyx://track?id=RGdkabupfPI"]),
    ).toBe("nyx://track?id=RGdkabupfPI");
    expect(findDeeplinkArg(["/usr/bin/nyx", "--no-sandbox"])).toBeUndefined();
  });
});
