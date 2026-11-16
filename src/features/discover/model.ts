import { match } from "ts-pattern";
import { type AiConfig, AiFailure, AiTier, aiFailureOf, generateList } from "@/server/ai";
import { dedupeCandidates } from "./matching";
import { type Candidate, candidateSchema, DiscoverError } from "./types";

/** How long one model call may take before the run fails with a timeout. */
export const modelTimeoutMs = 45_000;

/** Asks the light model for candidates, validated by Zod. */
export async function askModel(
  config: AiConfig,
  input: { system: string; prompt: string; candidates: number },
): Promise<Candidate[]> {
  const suggestions = await generateList(config, {
    tier: AiTier.Light,
    system: input.system,
    prompt: input.prompt,
    element: candidateSchema,
    name: "suggestions",
    description: "Tracks to suggest, best first",
    timeoutMs: modelTimeoutMs,
  });
  return dedupeCandidates(suggestions).slice(0, input.candidates);
}

/** Maps anything a model call can throw to the error the UI explains. */
export const classifyAiError = (error: unknown): DiscoverError =>
  match(aiFailureOf(error))
    .with(AiFailure.NotConfigured, () => DiscoverError.NotConfigured)
    .with(AiFailure.Timeout, () => DiscoverError.Timeout)
    .with(AiFailure.Provider, () => DiscoverError.Provider)
    .exhaustive();
