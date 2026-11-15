# ADR 0002: Internationalization with next-intl

- Status: accepted
- Date: 2026-11-15

## Context

The UI ships in English and Czech from the first screen. Strings, numbers, dates and plurals must be localized in Server Components as well as in the few client components. URLs should stay the same for every language, since the app is mostly behind login and has nothing to gain from per-locale paths.

## Decision

Use [next-intl](https://next-intl.dev) without i18n routing:

- the locale comes from a `locale` cookie in `src/i18n/request.ts` (`getRequestConfig`), falling back to the `Accept-Language` header and then to English;
- the language switch is a server action that sets the cookie and refreshes;
- messages live in `messages/en.json` and `messages/cs.json`; English is the source of truth and the type of every message key;
- Server Components use `getTranslations`, client components use `useTranslations` under `NextIntlClientProvider` in the root layout;
- numbers and dates go through next-intl formatters (`Intl` underneath), never hand-formatted strings.

Type-safe keys require augmenting next-intl's `AppConfig`, which is an `interface` by design; that declaration is the documented exception to the `type` over `interface` rule.

## Consequences

- No `[locale]` route segment and no locale-aware links.
- A missing Czech key falls back to English and is reported in development.
- Adding a language means adding one messages file and one entry in the locale list.
