import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { AiNotConfiguredError, AiProvider } from "@/server/ai";
import { classifyAiError } from "./model";
import { DiscoverError } from "./types";

const apiError = (statusCode: number) =>
  new APICallError({
    message: "failed",
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
  });

describe("classifyAiError", () => {
  it("recognises a missing key", () => {
    expect(classifyAiError(new AiNotConfiguredError(AiProvider.Google))).toBe(
      DiscoverError.NotConfigured,
    );
    expect(classifyAiError(apiError(401))).toBe(DiscoverError.NotConfigured);
  });

  it("recognises timeouts", () => {
    const timeout = new Error("The operation timed out");
    timeout.name = "TimeoutError";
    expect(classifyAiError(timeout)).toBe(DiscoverError.Timeout);
    expect(classifyAiError(apiError(504))).toBe(DiscoverError.Timeout);
  });

  it("unwraps retry errors", () => {
    const error = new RetryError({
      message: "gave up",
      reason: "maxRetriesExceeded",
      errors: [apiError(500), apiError(408)],
    });
    expect(classifyAiError(error)).toBe(DiscoverError.Timeout);
  });

  it("treats anything else as a provider error", () => {
    expect(classifyAiError(apiError(500))).toBe(DiscoverError.Provider);
    expect(classifyAiError(new Error("boom"))).toBe(DiscoverError.Provider);
  });
});
