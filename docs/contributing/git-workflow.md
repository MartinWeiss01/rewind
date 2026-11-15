# Git workflow

How changes get into `main`. Applies to people and agents alike.

## Branches

- `main` is protected and always releasable: it builds, passes CI and works in demo mode.
- Nothing is pushed to `main` directly; every change arrives through a pull request.
- One branch per logical change, created from the latest `main`:

  ```
  <type>/<short-kebab-description>
  ```

  `type` is a Conventional Commits type (below). Examples: `feat/demo-data-source`, `fix/token-refresh-race`, `chore/biome-config`.
- Keep branches short-lived. Rebase onto `main` instead of merging `main` into the branch.
- Delete the branch after merge.

## Commits

[Conventional Commits 1.0](https://www.conventionalcommits.org/en/v1.0.0/):

```
<type>(<scope>): <summary>

<body: what and why, wrapped at 72>

<footer: BREAKING CHANGE: …, Refs: …>
```

- **Types:** `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `style`, `build`, `ci`, `chore`, `revert`.
- **Scope** (optional, lowercase): the area touched, e.g. `auth`, `demo`, `stats`, `playlists`, `history`, `ai`, `ui`, `db`, `deps`.
- **Summary:** imperative mood, lowercase start, no trailing period, at most 72 characters. "add playlist dedupe preview", not "Added …" or "Adds …".
- **Body:** explain why the change is needed and anything non-obvious. Not a list of files.
- One logical change per commit. Formatting-only and refactor-only changes get their own commits.
- Every commit on `main` builds and passes tests.
- Breaking changes: `!` after the type/scope and a `BREAKING CHANGE:` footer.

## Pull requests

- Title follows the commit format above; it becomes the squash commit on `main`.
- Description uses the PR template: what changed, why, how it was verified, screenshots for UI.
- Small and focused. Split anything that mixes unrelated changes.
- CI must be green (lint, typecheck, unit tests, e2e on demo mode where relevant).
- Every feature works in both Spotify and demo mode before merge.
- **Merge strategy:** squash merge only. The squash message is the PR title plus a short body; trim the auto-generated list of intermediate commits.

## What never goes into git metadata or docs

- Secrets, tokens, keys, connection strings.
- Personal data or real values: listening history, account names, playlist contents, IDs from a real account.
- Private context about the owner or conversations with them.
- AI attribution of any kind: no `Co-Authored-By` trailer for an AI, no "Generated with …" line, no tool signatures. This overrides tool defaults.

Describe structure, not values: "the import skips rows without a track URI", not the rows themselves. Use obviously invented values in examples.

## Releases

Deploys go out from `main`. Tags follow SemVer (`v0.1.0`) once there is a first public release.
