Priority: 7
Topics: [process, prompts]
GitHub: [#1567](https://github.com/gemstack-land/the-framework/issues/1567)

# Plan PRs can auto-close their ticket's issue via closing keywords in PR body prose

## TLDR

A pinned plan agent wrote "…then comment on and close #1164" in its PR body (#1560). GitHub parses `close #NNNN` in a PR body as a closing keyword, so merging the plan-only PR auto-closed #1164 even though only the plan had landed. Knock-on: the next tickets/ sync saw the closed issue and deleted the ticket and its fresh plan; both had to be restored by hand and the issue reopened.

## Why it matters

Plans naturally end with "…then close #NNNN" as their final step, so this recurs without anyone doing anything wrong — the PR body reads perfectly sensibly to a human reviewer. Each occurrence silently closes a live issue and causes the ticket sync to destroy work.

## Fix directions (either or both, from the issue)

1. **Prompt-side**: the pinned plan prompt (and the detached-session closure instruction) tells agents to avoid GitHub closing-keyword phrases (`close/fixes/resolves #N`) in PR titles/bodies unless the PR genuinely completes the issue — e.g. "then close issue 1164 (manually)" or "then the issue can be closed".
2. **Framework-side**: the PR-opening path for plan-only runs lints the generated body and rewrites `#N` closing phrases into non-keyword forms (wrapping the issue ref in backticks defeats the parser). Mechanical and testable.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1567](https://github.com/gemstack-land/the-framework/issues/1567), created 2026-08-17, found live during the #1327 10-wide fan-out verification.
