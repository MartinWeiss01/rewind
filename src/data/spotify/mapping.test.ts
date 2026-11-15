import { describe, expect, it } from "vitest";
import { mapTrack, pickImage } from "./mapping";

describe("spotify mapping", () => {
  it("picks a suitable image", () => {
    const images = [
      { url: "https://example.test/640", width: 640, height: 640 },
      { url: "https://example.test/64", width: 64, height: 64 },
      { url: "https://example.test/300", width: 300, height: 300 },
    ];
    expect(pickImage(images)).toEqual({ kind: "image", url: "https://example.test/300" });
    expect(pickImage([])).toBeNull();
  });

  it("maps a track and skips local files", () => {
    const track = {
      id: "t1",
      name: "Invented Song",
      artists: [{ id: "a1", name: "Fake Band" }],
      duration_ms: 200_000,
      explicit: false,
      external_ids: { isrc: "XXTEST0000001" },
      external_urls: { spotify: "https://open.spotify.com/track/t1" },
      album: {
        album_type: "album" as const,
        total_tracks: 1,
        external_urls: {},
        href: "",
        id: "al1",
        images: [],
        name: "Invented Album",
        release_date: "2020",
        release_date_precision: "year" as const,
        type: "album" as const,
        uri: "spotify:album:al1",
        artists: [],
      },
    };
    expect(mapTrack(track)).toMatchObject({
      id: "t1",
      isrc: "XXTEST0000001",
      album: { id: "al1", releaseDate: "2020" },
    });
    expect(mapTrack({ ...track, is_local: true })).toBeNull();
  });
});
