Priority: 5
Topics: [the-framework]
GitHub: [#1346](https://github.com/gemstack-land/the-framework/issues/1346)

# Nothing keeps a .spec.md true

## TLDR

#1335 put a `.spec.md` beside every source file; nothing keeps them in sync as the code moves. A stale spec is worse than no spec: the next agent trusts it and has no way to tell it's wrong. Three ways to go, and it's a real choice: **gate PRs on it** (spec-driven for real, at the cost of friction on every change), **regenerate on a schedule** (treat them as output, never hand-edit), or **accept drift** (they're a snapshot, and each file says so at the top). `scripts/check-prompt-drift.ts` already solves this shape for prompts, so there's a pattern to copy.

## Why it matters

The specs exist to let agents (and humans) navigate and to enable spec-driven development; both die quietly if the specs rot. The issue leans toward regenerating (keeps the navigation win, costs no manual step, matches how they were produced), but a gate is the only option that makes "spec-driven development" literally true — worth deciding rather than defaulting.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1346](https://github.com/gemstack-land/the-framework/issues/1346), created 2026-07-28, labels: `priority: medium`, `the-framework ♻️`, 0 comments.
