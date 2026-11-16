import { describe, expect, it } from "vitest";
import { parseSpotifyUserId } from "./access";

describe("parseSpotifyUserId", () => {
  it.each([
    ["listener.example", "listener.example"],
    ["  listener.example  ", "listener.example"],
    ["https://open.spotify.com/user/listener.example?si=abc123", "listener.example"],
    ["open.spotify.com/user/listener.example", "listener.example"],
    ["https://open.spotify.com/intl-cs/user/listener.example", "listener.example"],
    ["spotify:user:listener.example", "listener.example"],
    ["https://open.spotify.com/user/caf%C3%A9.listener", "café.listener"],
  ])("%s → %s", (input, expected) => {
    expect(parseSpotifyUserId(input)).toBe(expected);
  });

  it.each([
    "",
    "two words",
    "https://open.spotify.com/playlist/abc",
    "https://example.test/user/listener",
    "x".repeat(201),
  ])("rejects %j", (input) => {
    expect(parseSpotifyUserId(input)).toBeNull();
  });
});
