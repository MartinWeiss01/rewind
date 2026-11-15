# ADR 0003: App Router conventions

- Status: accepted
- Date: 2026-11-15

## Context

Every screen needs loading, empty and error states, and the app has two shells: public pages and the signed-in or demo app with its top bar and dock. The Next.js App Router has file conventions for exactly these concerns.

## Decision

Lean on the framework's file conventions instead of hand-rolled equivalents:

- **Route groups** split the shells without affecting URLs: `(marketing)` for the landing and legal pages, `(app)` for everything under `/app`.
- **`layout.tsx`** per group renders the shell (marketing header, or top bar plus dock); the root layout owns `<html>`, fonts, theme and the i18n provider.
- **`loading.tsx`** in each route renders that screen's skeleton, so navigation streams instantly. Finer-grained sections use their own `<Suspense>` boundaries with skeletons.
- **`error.tsx`** in each route renders the error state with a retry that calls `retry()` (re-fetches the segment); `global-error.tsx` covers the root layout.
- **`not-found.tsx`** for unknown routes and missing resources (`notFound()`).
- **`proxy.ts`** (the Next.js 16 name for middleware) only for cheap request gating such as redirecting unauthenticated visitors; data access stays in Server Components and server actions.
- Route segments stay thin: a `page.tsx` reads params, validates them with Zod, resolves the data source and renders feature components from `src/features/<feature>/`.

## Consequences

- Each new route ships `page.tsx`, `loading.tsx` and `error.tsx` together; a route without them fails review.
- Shared shell UI lives in the group layout and never re-renders on navigation within the group.
