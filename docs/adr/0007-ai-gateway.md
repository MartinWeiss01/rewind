# ADR 0007: One AI gateway on Gemini

- Status: accepted
- Date: 2026-11-16, revised 2026-11-17 (decision model wired for sorting into playlists)

## Context

AI features used to pick a provider through `AI_PROVIDER` (Google or Anthropic), with one model per provider. Supporting several providers added keys, branches and tests without a use for them, and upcoming features need different kinds of model call: cheap structured generation and fast closed-set decisions.

## Decision

- Rewind uses Google Gemini only, through the Vercel AI SDK (`@ai-sdk/google`).
- `src/server/ai.ts` is the only module that imports the provider SDK or names a model. Features pass their input, a Zod output schema and a tier (`AiTier`), and receive validated data or an `AiFailure`.
- Each tier maps to one model and thinking level in `tierModels`, in code rather than in the environment. The environment holds only `GOOGLE_GENERATIVE_AI_API_KEY`.
- Only the tiers a feature needs are wired. Today that is `light` (`gemini-3.5-flash-lite`, low thinking) for Discover.
- Closed-set choices go to the decision model `gemini-decision-1` on the Gemini Decisions API through `decideChoices`: multiple-choice questions against one shared text state, answered in batches of `decisionBatchSize`, each with a probability per option. The AI SDK calls the endpoint through `decisionModel()` and `experimental_decide`. Sorting a playlist into other playlists is the first user. The endpoint needs Decisions API access on the key; without it, calls fail as `notConfigured` or `provider`.

## Consequences

- Changing a model is a reviewed code change in one place.
- Adding another provider later means a new adapter inside the gateway; features do not change.
- The decisions call in the AI SDK is experimental and may change in patch releases, so its use stays inside the gateway and dependency versions stay exact.
