import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AiFailure,
  AiNotConfiguredError,
  AiTier,
  aiFailureOf,
  decideChoices,
  generateList,
  readAiConfig,
  tierModels,
} from "./ai";

describe("readAiConfig", () => {
  it("reads the Gemini key", () => {
    expect(readAiConfig({ GOOGLE_GENERATIVE_AI_API_KEY: "test-key" })).toEqual({
      apiKey: "test-key",
      demoLiveAi: false,
    });
  });

  it("treats empty values as unset", () => {
    expect(readAiConfig({ GOOGLE_GENERATIVE_AI_API_KEY: " ", DEMO_LIVE_AI: "" })).toEqual({
      apiKey: null,
      demoLiveAi: false,
    });
  });

  it("never calls a model in a demo-only deployment", () => {
    expect(
      readAiConfig({
        DEMO_ONLY: "true",
        GOOGLE_GENERATIVE_AI_API_KEY: "test-key",
        DEMO_LIVE_AI: "true",
      }),
    ).toEqual({ apiKey: null, demoLiveAi: false });
  });

  it("enables live demo AI only for true", () => {
    expect(readAiConfig({ DEMO_LIVE_AI: "TRUE" }).demoLiveAi).toBe(true);
    expect(() => readAiConfig({ DEMO_LIVE_AI: "yes" })).toThrow();
  });
});

describe("tierModels", () => {
  it("uses Flash Lite with low thinking for the light tier", () => {
    expect(tierModels[AiTier.Light]).toEqual({
      modelId: "gemini-3.5-flash-lite",
      thinkingLevel: "low",
    });
  });
});

describe("generateList", () => {
  it("refuses to call a model without a key", async () => {
    await expect(
      generateList(readAiConfig({}), {
        tier: AiTier.Light,
        system: "",
        prompt: "",
        element: z.string(),
        name: "items",
        description: "",
        timeoutMs: 1000,
      }),
    ).rejects.toThrow(AiNotConfiguredError);
  });
});

const apiError = (statusCode: number) =>
  new APICallError({
    message: "failed",
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
  });

describe("aiFailureOf", () => {
  it("recognises a missing or refused key", () => {
    expect(aiFailureOf(new AiNotConfiguredError())).toBe(AiFailure.NotConfigured);
    expect(aiFailureOf(apiError(401))).toBe(AiFailure.NotConfigured);
    expect(aiFailureOf(apiError(403))).toBe(AiFailure.NotConfigured);
  });

  it("recognises timeouts", () => {
    const timeout = new Error("The operation timed out");
    timeout.name = "TimeoutError";
    expect(aiFailureOf(timeout)).toBe(AiFailure.Timeout);
    expect(aiFailureOf(apiError(504))).toBe(AiFailure.Timeout);
  });

  it("unwraps retry errors", () => {
    const error = new RetryError({
      message: "gave up",
      reason: "maxRetriesExceeded",
      errors: [apiError(500), apiError(408)],
    });
    expect(aiFailureOf(error)).toBe(AiFailure.Timeout);
  });

  it("treats anything else as a provider error", () => {
    expect(aiFailureOf(apiError(500))).toBe(AiFailure.Provider);
    expect(aiFailureOf(new Error("boom"))).toBe(AiFailure.Provider);
  });
});

describe("decideChoices", () => {
  it("refuses to call the decision model without a key", async () => {
    await expect(
      decideChoices(
        { apiKey: null, demoLiveAi: false },
        { state: "", questions: [], timeoutMs: 1000 },
      ),
    ).rejects.toBeInstanceOf(AiNotConfiguredError);
  });
});
