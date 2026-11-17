import { createGoogle, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import {
  APICallError,
  experimental_decide,
  generateText,
  LoadAPIKeyError,
  Output,
  RetryError,
} from "ai";
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

/**
 * The decision model: picks one of a closed set of options per question and returns
 * a calibrated probability for each option. Needs Decisions API access on the key.
 */
export const decisionModelId = "gemini-decision-1";

/** At most this many questions go into one decision call. */
export const decisionBatchSize = 200;

/** One multiple-choice question: option ID → what the option means. */
export type ChoiceQuestion = {
  id: string;
  instructions: string;
  options: Readonly<Record<string, string>>;
};

export type ChoiceAnswer = {
  choice: string;
  /** Probability per option ID, summing to about 1. */
  probabilities: Readonly<Record<string, number>>;
};

const choiceAnswerSchema = z.object({
  type: z.literal("choice"),
  choice: z.string(),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
});

/**
 * Answers multiple-choice questions against one shared state with the decision
 * model, in batches. Returns an answer for every question ID.
 */
export async function decideChoices(
  config: AiConfig,
  input: {
    /** Shared context every question is decided against, as text. */
    state: string;
    questions: readonly ChoiceQuestion[];
    timeoutMs: number;
  },
): Promise<Map<string, ChoiceAnswer>> {
  const { apiKey } = config;
  if (!apiKey) throw new AiNotConfiguredError();
  const model = createGoogle({ apiKey }).decisionModel(decisionModelId);
  const signal = AbortSignal.timeout(input.timeoutMs);
  const answers = new Map<string, ChoiceAnswer>();
  for (let start = 0; start < input.questions.length; start += decisionBatchSize) {
    const batch = input.questions.slice(start, start + decisionBatchSize);
    const result = await experimental_decide({
      model,
      state: input.state,
      questions: Object.fromEntries(
        batch.map((q) => [
          q.id,
          { type: "choice" as const, instructions: q.instructions, criteria: { ...q.options } },
        ]),
      ),
      maxRetries: 1,
      abortSignal: signal,
    });
    for (const q of batch) {
      const answer = choiceAnswerSchema.parse(result.answers[q.id]);
      answers.set(q.id, { choice: answer.choice, probabilities: answer.probabilities });
    }
  }
  return answers;
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
