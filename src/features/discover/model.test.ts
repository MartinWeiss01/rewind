import { describe, expect, it } from "vitest";
import { AiNotConfiguredError } from "@/server/ai";
import { classifyAiError } from "./model";
import { DiscoverError } from "./types";

describe("classifyAiError", () => {
  it("maps gateway failures to Discover errors", () => {
    expect(classifyAiError(new AiNotConfiguredError())).toBe(DiscoverError.NotConfigured);
    const timeout = new Error("The operation timed out");
    timeout.name = "TimeoutError";
    expect(classifyAiError(timeout)).toBe(DiscoverError.Timeout);
    expect(classifyAiError(new Error("boom"))).toBe(DiscoverError.Provider);
  });
});
