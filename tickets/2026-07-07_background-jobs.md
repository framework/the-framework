Topics: [the-framework]
GitHub: [#298](https://github.com/gemstack-land/the-framework/issues/298)

# [The Framework] Background jobs

## TLDR

Give the framework a background-jobs layer: listeners that trigger an agent on external events (production error via Sentry/Cloudflare, red CI on `main`), a usage-aware "max-out" scheduler that spends remaining subscription capacity on maintenance, and eventually full autopilot mode. Triage in the thread: listeners are infra-gated (webhook wiring); usage-limit retrieval is possible only via Anthropic's undocumented `/api/oauth/usage` endpoint (aggressively rate-limited), so the practical capacity gate is fire-then-backoff plus the `--max-cost` budget cap (#327); the buildable-now piece is a `framework maintain` sweep across registered repos.

## Why it matters

Background jobs are what turn the framework from a run-on-demand tool into a 24/7 teammate: reacting to production/CI events without a human noticing first, and converting otherwise-wasted subscription capacity into continuous maintenance. The triage gives a concrete, infra-free starting point (the maintenance sweep) instead of blocking on webhooks or unsupported usage APIs.

## Source

Imported from GitHub issue [gemstack-land/the-framework#298](https://github.com/gemstack-land/the-framework/issues/298), created 2026-07-07, label: `the-framework ♻️`, 2 comments.

### Original description

Implements:
- Listeners
  - Error in production (Sentry, Cloudfalre, ...) => triggers agent
  - CI is red on `main` (GitHub) => triggers agent
- The [usage max-out idea](https://github.com/gemstack-land/gemstack/pull/287/changes):
  - Check the current usage limit + when the limit resets
    - If usage limit reached (with a configurable margin) => abort, don't do any maintenance
    - Make sure to also check the usage limit of the current default model => use a fallback model if usage limit is reached (with a configurable margin)
  - If there's capacity, then check the latest commits of all The Framework repos that weren't reviewed by the maintenance loop yet => apply the maintenance loop
- Autopilot mode (fully automatic development cycle, including feature requests)
- More?

### Notes from the GitHub thread

- Triage: listeners = infra-gated; usage max-out = subscription auth exposes no account limit/reset via the agent stream, so #327 shipped the substitute (infer spend + `--max-cost` budget cap); maintenance sweep across registered repos = buildable now with existing registry, git, maintainability preset, run loop, and budget cap. Proposal: start with `framework maintain`.
- Correction: usage/reset *is* technically retrievable the way Traycer does it — spawn the provider's own CLI and let it hit Anthropic's `/api/oauth/usage` with its own OAuth token — but the endpoint is undocumented, unsupported, and 429s with multi-minute penalty windows (Traycer polls every 15 min through a global serial queue). Conclusion unchanged: fire-then-backoff remains the primary usage guard; a usage panel may still be worth building.
