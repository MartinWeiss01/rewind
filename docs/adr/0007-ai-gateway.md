# ADR 0007: One AI gateway on Gemini

- Status: accepted
- Date: 2026-11-16

## Context

AI features used to pick a provider through `AI_PROVIDER` (Google or Anthropic), with one model per provider. Supporting several providers added keys, branches and tests without a use for them, and upcoming features need different kinds of model call: cheap structured generation and fast closed-set decisions.

## Decision

- Rewind uses Google Gemini only, through the Vercel AI SDK (`@ai-sdk/google`).
- `src/server/ai.ts` is the only module that imports the provider SDK or names a model. Features pass their input, a Zod output schema and a tier (`AiTier`), and receive validated data or an `AiFailure`.
- Each tier maps to one model and thinking level in `tierModels`, in code rather than in the environment. The environment holds only `GOOGLE_GENERATIVE_AI_API_KEY`.
- Only the tiers a feature needs are wired. Today that is `light` (`gemini-3.5-flash-lite`, low thinking) for Discover. A `decision` tier for `gemini-decision-1` on the Gemini Decisions API is added with the first feature that uses it; the AI SDK calls that endpoint through `google.decisionModel()` and `experimental_decide`.

## Consequences

- Changing a model is a reviewed code change in one place.
- Adding another provider later means a new adapter inside the gateway; features do not change.
- The decisions call in the AI SDK is experimental and may change in patch releases, so its use stays inside the gateway and dependency versions stay exact.
