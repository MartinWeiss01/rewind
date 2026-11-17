import { createGoogle, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { APICallError, generateText, LoadAPIKeyError, Output, RetryError } from "ai";
import { z } from "zod";
import { envFlag } from "./env";

/**
 * The AI gateway: the only module that knows the vendor SDK and model IDs. Features
 * pass their input, a Zod output schema and a tier, and get validated data back.
 */

/** What a model call is for. Each tier maps to one Gemini model below. */
export const AiTier = {
  /** Extraction, summaries, simple recommendations and cheap structured JSON. */
  Light: "light",
} as const;
export type AiTier = (typeof AiTier)[keyof typeof AiTier];

/**
 * The Gemini model and thinking level per tier. Part of the code, not the
 * environment, so a change is reviewed and versioned like any other.
 * - light: gemini-3.5-flash-lite with low thinking, enough for Discover suggestions.
 */
export const tierModels = {
  light: { modelId: "gemini-3.5-flash-lite", thinkingLevel: "low" },
} as const satisfies Record<
  AiTier,
  {
    modelId: string;
    thinkingLevel: NonNullable<GoogleLanguageModelOptions["thinkingConfig"]>["thinkingLevel"];
  }
>;

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

export const aiEnvSchema = z.object({
  GOOGLE_GENERATIVE_AI_API_KEY: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  DEMO_LIVE_AI: envFlag,
  DEMO_ONLY: envFlag,
});

export type AiConfig = {
  /** Null when the Gemini key is missing: callers show a "not configured" state. */
  apiKey: string | null;
  /** Whether demo visitors get real model calls instead of pre-generated answers. */
  demoLiveAi: boolean;
};

/** Reads and validates the AI settings from an environment object such as `process.env`. */
export function readAiConfig(env: Record<string, string | undefined>): AiConfig {
  const parsed = aiEnvSchema.parse(env);
  // A demo-only deployment never calls a model, whatever else is set.
  if (parsed.DEMO_ONLY) return { apiKey: null, demoLiveAi: false };
  return {
    apiKey: parsed.GOOGLE_GENERATIVE_AI_API_KEY ?? null,
    demoLiveAi: parsed.DEMO_LIVE_AI,
  };
}

/** Thrown when the Gemini API key is missing. */
export class AiNotConfiguredError extends Error {
  constructor() {
    super("No Gemini API key configured");
    this.name = "AiNotConfiguredError";
  }
}

/** Asks a tier's model for a list of items, each validated by `element`. */
export async function generateList<T>(
  config: AiConfig,
  input: {
    tier: AiTier;
    system: string;
    prompt: string;
    element: z.ZodType<T>;
    /** Name and description of the list, which guide the model. */
    name: string;
    description: string;
    timeoutMs: number;
  },
): Promise<T[]> {
  const { apiKey } = config;
  if (!apiKey) throw new AiNotConfiguredError();
  const { modelId, thinkingLevel } = tierModels[input.tier];
  const { output } = await generateText({
    model: createGoogle({ apiKey })(modelId),
    system: input.system,
    prompt: input.prompt,
    output: Output.array({
      element: input.element,
      name: input.name,
      description: input.description,
    }),
    providerOptions: {
      google: { thinkingConfig: { thinkingLevel } } satisfies GoogleLanguageModelOptions,
    },
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(input.timeoutMs),
  });
  // Output.array already validated each element; parse again so nothing unchecked leaves here.
  return input.element.array().parse(output);
}

/** Why a model call failed, in terms a feature can explain. */
export const AiFailure = {
  /** No key, or the key was refused. */
  NotConfigured: "notConfigured",
  Timeout: "timeout",
  /** Anything else the provider or the network threw. */
  Provider: "provider",
} as const;
export type AiFailure = (typeof AiFailure)[keyof typeof AiFailure];

const timeoutStatus = new Set([408, 504]);

/** Maps anything a model call can throw to a failure kind. */
export function aiFailureOf(error: unknown): AiFailure {
  if (RetryError.isInstance(error)) return aiFailureOf(error.lastError);
  if (error instanceof AiNotConfiguredError || LoadAPIKeyError.isInstance(error)) {
    return AiFailure.NotConfigured;
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return AiFailure.Timeout;
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode !== undefined && timeoutStatus.has(error.statusCode)) {
      return AiFailure.Timeout;
    }
    if (error.statusCode === 401 || error.statusCode === 403) return AiFailure.NotConfigured;
  }
  return AiFailure.Provider;
}
