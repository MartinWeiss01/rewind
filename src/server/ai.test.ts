import { describe, expect, it } from "vitest";
import { AiNotConfiguredError, AiProvider, defaultModels, languageModel, readAiConfig } from "./ai";

describe("readAiConfig", () => {
  it("defaults to Google and its default model", () => {
    const config = readAiConfig({ GOOGLE_GENERATIVE_AI_API_KEY: "test-key" });
    expect(config).toEqual({
      provider: AiProvider.Google,
      modelId: defaultModels.google,
      apiKey: "test-key",
      demoLiveAi: false,
    });
  });

  it("treats empty values as unset", () => {
    const config = readAiConfig({ AI_PROVIDER: "", AI_MODEL: " ", DEMO_LIVE_AI: "" });
    expect(config.provider).toBe(AiProvider.Google);
    expect(config.modelId).toBe(defaultModels.google);
    expect(config.apiKey).toBeNull();
  });

  it("reads the Anthropic provider, a custom model and live demo AI", () => {
    const config = readAiConfig({
      AI_PROVIDER: "Anthropic",
      AI_MODEL: "custom-model",
      ANTHROPIC_API_KEY: "test-anthropic-key",
      GOOGLE_GENERATIVE_AI_API_KEY: "unused",
      DEMO_LIVE_AI: "true",
    });
    expect(config).toEqual({
      provider: AiProvider.Anthropic,
      modelId: "custom-model",
      apiKey: "test-anthropic-key",
      demoLiveAi: true,
    });
  });

  it("rejects an unknown provider", () => {
    expect(() => readAiConfig({ AI_PROVIDER: "somewhere" })).toThrow();
  });
});

describe("languageModel", () => {
  it("throws a not-configured error without a key", () => {
    expect(() => languageModel(readAiConfig({}))).toThrow(AiNotConfiguredError);
  });

  it("creates a model without calling it", () => {
    const model = languageModel(readAiConfig({ GOOGLE_GENERATIVE_AI_API_KEY: "test-key" }));
    expect(typeof model).toBe("object");
  });
});
