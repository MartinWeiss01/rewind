import { APICallError, generateText, LoadAPIKeyError, Output, RetryError } from "ai";
import { type AiConfig, AiNotConfiguredError, languageModel } from "@/server/ai";
import { dedupeCandidates } from "./matching";
import { type Candidate, candidateSchema, DiscoverError } from "./types";

/** How long one model call may take before the run fails with a timeout. */
export const modelTimeoutMs = 45_000;

/** Asks the configured model for candidates with structured output validated by Zod. */
export async function askModel(
  config: AiConfig,
  input: { system: string; prompt: string; candidates: number },
): Promise<Candidate[]> {
  const { output } = await generateText({
    model: languageModel(config),
    system: input.system,
    prompt: input.prompt,
    output: Output.array({
      element: candidateSchema,
      name: "suggestions",
      description: "Tracks to suggest, best first",
    }),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(modelTimeoutMs),
  });
  // Output.array already validated each element; parse again so nothing unchecked leaves here.
  return dedupeCandidates(candidateSchema.array().parse(output)).slice(0, input.candidates);
}

const timeoutStatus = new Set([408, 504]);

/** Maps anything a model call can throw to the error the UI explains. */
export function classifyAiError(error: unknown): DiscoverError {
  if (RetryError.isInstance(error)) return classifyAiError(error.lastError);
  if (error instanceof AiNotConfiguredError || LoadAPIKeyError.isInstance(error)) {
    return DiscoverError.NotConfigured;
  }
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
    return DiscoverError.Timeout;
  }
  if (APICallError.isInstance(error)) {
    if (error.statusCode !== undefined && timeoutStatus.has(error.statusCode)) {
      return DiscoverError.Timeout;
    }
    if (error.statusCode === 401 || error.statusCode === 403) return DiscoverError.NotConfigured;
    return DiscoverError.Provider;
  }
  return DiscoverError.Provider;
}
