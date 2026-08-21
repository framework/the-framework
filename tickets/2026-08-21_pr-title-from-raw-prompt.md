Priority: 5
GitHub: [#1618](https://github.com/gemstack-land/the-framework/issues/1618)

# A nameless session's PR is titled with its raw prompt, truncated mid-sentence

## TLDR

`agentPrTitle` (`agent-handoff.ts:749`) falls back to `agent.intent?.split('\n')[0]?.slice(0, 72)` when a session emits no session name — the *instruction the agent was given*, cut wherever 72 characters land. Squash-merge turns that into a permanent commit subject on `main`. A real one from the #1334 dogfood run: `Open TODO_AGENTS.md and work on the FIRST open entry only. When the work (fix #1)`.

## Why it matters

- Squash-merge inherits the PR title, so this is repository history, not a transient label: `git log --oneline` fills with truncated instructions.
- A drain preset's first line is identical across every firing, so repeated runs produce near-identical subjects that say nothing about what each one changed.
- It hits hardest where nobody is watching — unattended work, where no human sees the PR before it merges.

The three rungs aren't equally good: `sessionName` describes the work (correct), `Session ${id}` says nothing but says it honestly, and the middle rung reads like a title while being neither a description of the change nor a complete sentence.

## Directions

- **Narrow:** drop the middle rung so a nameless session falls through to `Session ${id}`. Honest, one line.
- **Better:** a handoff shouldn't open a PR without a name for its work at all. #1612 moved PR opening onto a path where the framework composes the title; if the agent can be asked to describe its PR, it can be asked for the name too.

The `(fix #N)` machinery from #1334 is correct and worked — the issue auto-closed on merge. The problem is only what it gets appended to.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1618](https://github.com/gemstack-land/the-framework/issues/1618), created 2026-08-21, no labels, 0 comments. PR [#1621](https://github.com/gemstack-land/the-framework/pull/1621) is open against it.
