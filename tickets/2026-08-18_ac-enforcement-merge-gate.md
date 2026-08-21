Priority: 5
GitHub: [#1591](https://github.com/gemstack-land/the-framework/issues/1591)

# AC enforcement: a merge gate checking the diff against AGENTS.md and the ticket's acceptance criteria

## TLDR

Context rot means rules stated once (AGENTS.md, a ticket's plan) stop steering an agent mid-task. Two layers, cheapest first:

1. **Get the rules into context at all** — #1590 does this for Claude Code sessions (`CLAUDE.md` → `@AGENTS.md`). The TF-driven half is missing: the #326 system prompt doesn't carry AGENTS.md either, so injecting the repo's AGENTS.md into every run prompt is a small framework change.
2. **Enforce at the gate, not just at the start** — a check that runs when a session declares ready-for-merge: re-read AGENTS.md plus the ticket's acceptance criteria, diff them against the actual change, flag violations before anything lands. The hook point already exists — `on-before-mergeable` (opt-in today, `cli.ts`) fires exactly there and can carry a prompt.

## Why it matters

#1589 was the live case: compat machinery grew despite the zero-users rule, because the rule wasn't in the working context at decision time. A gate check re-reads the rules fresh at the point of no return, so it's immune to the rot that defeats start-of-run instructions.

## Shape

Start with one stock prompt ("list every AGENTS.md rule this diff violates; empty list required to proceed"); later, per-ticket ACs from the plan file, checked the same way.

Related: the SPEC.md human-review rule proposed in the same thread — a gate check can also require that `*.SPEC.md` diffs were explicitly acknowledged by a human.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1591](https://github.com/gemstack-land/the-framework/issues/1591), created 2026-08-18, no labels, 0 comments. Rides [#1589 (comment)](https://github.com/gemstack-land/the-framework/pull/1589#issuecomment-5332367828).
