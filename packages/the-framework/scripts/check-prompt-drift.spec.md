CI check that fails when `prompts/` no longer matches issue gemstack-land/the-framework#326, where the system prompt is designed and reviewed ("change it there first").

## TLDR

- Fetches the issue body, extracts its two ```md blocks; block 1 (system prompt) must byte-match `prompts/system_prompt.md` (issue is the source of truth); block 2 (on-before-mergeable) is compared against a local snapshot (`op-326-on-before-mergeable.snapshot.md`), updated via `--update`.
- Failures print the first differing line, char counts, and the exact remediation.
- Guards the direction that actually broke: the issue was rewritten 2026-07-13, the repo only synced 2026-07-15, and nothing noticed for two days (`gen-prompts.mjs` guards .md → .ts; this guards issue → .md).

## Decisions

- Block 2 cannot ship verbatim — it nests a `${{ }}` fragment inside another one, which the renderer cannot parse, so the repo ships a hand-flattened equivalent; there is nothing to byte-compare, so a snapshot detects "the design moved, a human must re-flatten".
- Network failures and GitHub 5xx are a `SkipError` (warn, exit 0) — an outage is not drift and must not wedge a PR; 401/403/404 are our own misconfiguration and fail hard, since silently passing would make the check a no-op.
- Comparison normalizes only trailing whitespace (files end with a newline, issue blocks don't).

## Facts

- Optional `GITHUB_TOKEN` env var authorizes the API call.
