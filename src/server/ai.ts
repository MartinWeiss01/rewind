import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogle } from "@ai-sdk/google";
import type { LanguageModel } from "ai";
import { match } from "ts-pattern";
import { z } from "zod";

/** Model providers the app can talk to through the Vercel AI SDK. Google is the default. */
export const AiProvider = {
  Google: "google",
  Anthropic: "anthropic",
} as const;
export type AiProvider = (typeof AiProvider)[keyof typeof AiProvider];

/**
 * The model each provider uses. Part of the code, not the environment, so a change is
 * reviewed and versioned like any other.
 * - google: gemini-3.6-flash is stable, cheap and knows enough about music for
 *   suggestions; gemini-3.5-flash-lite is cheaper if quality holds up.
 * - anthropic: claude-sonnet-5-5; claude-haiku-5-5 is the cheaper option.
 */
export const aiModels = {
  google: "gemini-3.6-flash",
  anthropic: "claude-sonnet-5-5",
} as const satisfies Record<AiProvider, string>;

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optionalText = z.preprocess(emptyToUndefined, z.string().trim().optional());

export const aiEnvSchema = z.object({
  AI_PROVIDER: z.preprocess(
    (value) => (typeof value === "string" ? emptyToUndefined(value.trim().toLowerCase()) : value),
    z.enum(AiProvider).default(AiProvider.Google),
  ),
  GOOGLE_GENERATIVE_AI_API_KEY: optionalText,
  ANTHROPIC_API_KEY: optionalText,
  DEMO_LIVE_AI: z.preprocess(
    (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
    z.enum(["true", "false", ""]).optional(),
  ),
});

export type AiConfig = {
  provider: AiProvider;
  modelId: string;
  /** Null when the provider's key is missing: callers show a "not configured" state. */
  apiKey: string | null;
  /** Whether demo visitors get real model calls instead of pre-generated answers. */
  demoLiveAi: boolean;
};

/** Reads and validates the AI settings from an environment object such as `process.env`. */
export function readAiConfig(env: Record<string, string | undefined>): AiConfig {
  const parsed = aiEnvSchema.parse(env);
  const apiKey = match(parsed.AI_PROVIDER)
    .with(AiProvider.Google, () => parsed.GOOGLE_GENERATIVE_AI_API_KEY)
    .with(AiProvider.Anthropic, () => parsed.ANTHROPIC_API_KEY)
    .exhaustive();
  return {
    provider: parsed.AI_PROVIDER,
    modelId: aiModels[parsed.AI_PROVIDER],
    apiKey: apiKey ?? null,
    demoLiveAi: parsed.DEMO_LIVE_AI === "true",
  };
}

/** Thrown when the selected provider has no API key. */
export class AiNotConfiguredError extends Error {
  constructor(provider: AiProvider) {
    super(`No API key configured for the ${provider} AI provider`);
    this.name = "AiNotConfiguredError";
  }
}

/** The language model for the configured provider. Throws AiNotConfiguredError without a key. */
export function languageModel(config: AiConfig): LanguageModel {
  const { apiKey } = config;
  if (!apiKey) throw new AiNotConfiguredError(config.provider);
  return match(config.provider)
    .with(AiProvider.Google, () => createGoogle({ apiKey })(config.modelId))
    .with(AiProvider.Anthropic, () => createAnthropic({ apiKey })(config.modelId))
    .exhaustive();
}
