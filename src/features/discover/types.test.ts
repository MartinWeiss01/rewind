import { describe, expect, it } from "vitest";
import {
  DiscoverError,
  DiscoverFailure,
  discoverErrorOf,
  retryUnexpected,
  unwrapResult,
} from "./types";

describe("unwrapResult", () => {
  it("returns the data of a successful result", () => {
    expect(unwrapResult({ ok: true, data: { name: "Late Night Mix" } })).toEqual({
      name: "Late Night Mix",
    });
  });

  it("throws the reason of a failed result", () => {
    expect(() => unwrapResult({ ok: false, error: DiscoverError.Timeout })).toThrow(
      DiscoverFailure,
    );
    try {
      unwrapResult({ ok: false, error: DiscoverError.RateLimited });
    } catch (error) {
      expect(discoverErrorOf(error)).toBe(DiscoverError.RateLimited);
    }
  });
});

describe("discoverErrorOf", () => {
  it("treats anything else as unknown", () => {
    expect(discoverErrorOf(new Error("network"))).toBe(DiscoverError.Unknown);
    expect(discoverErrorOf(undefined)).toBe(DiscoverError.Unknown);
  });
});

describe("retryUnexpected", () => {
  it("retries an unexpected error once", () => {
    expect(retryUnexpected(0, new Error("network"))).toBe(true);
    expect(retryUnexpected(1, new Error("network"))).toBe(false);
  });

  it("never retries a refusal", () => {
    expect(retryUnexpected(0, new DiscoverFailure(DiscoverError.PlaylistMissing))).toBe(false);
  });
});
