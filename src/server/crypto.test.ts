import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt, encryptionKeyFrom, randomToken, sha256 } from "./crypto";

const key = encryptionKeyFrom(randomBytes(32).toString("base64"));

describe("crypto", () => {
  it("round-trips and never repeats ciphertexts", () => {
    const a = encrypt("invented-refresh-token", key);
    const b = encrypt("invented-refresh-token", key);
    expect(a).not.toBe(b);
    expect(decrypt(a, key)).toBe("invented-refresh-token");
  });

  it("rejects tampered data and wrong keys", () => {
    const payload = encrypt("secret", key);
    const [iv, tag, data] = payload.split(".");
    const flipped = `${iv}.${tag}.${data?.startsWith("A") ? `B${data.slice(1)}` : `A${data?.slice(1)}`}`;
    expect(() => decrypt(flipped, key)).toThrow();
    expect(() => decrypt(payload, encryptionKeyFrom(randomBytes(32).toString("base64")))).toThrow();
  });

  it("validates the key length", () => {
    expect(() => encryptionKeyFrom(Buffer.from("short").toString("base64"))).toThrow();
  });

  it("makes tokens and hashes", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(sha256("abc")).toHaveLength(64);
  });
});
