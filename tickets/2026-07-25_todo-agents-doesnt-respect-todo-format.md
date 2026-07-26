Priority: 8
Topics: [bug]
GitHub: [#1163](https://github.com/gemstack-land/the-framework/issues/1163)

# `TODO_AGENTS.md` doesn't respect `todo_format.md`

## TLDR

The `TODO_AGENTS.md` at the repo root doesn't follow `todo_format.md` — likely because it was generated before the format was introduced. Bring it into compliance (and make sure whatever writes it follows the format going forward).

## Why it matters

High priority because `TODO_AGENTS.md` is the AI task queue: the loop drains it and agents parse it, so a format mismatch degrades or breaks automated task pickup — the core autonomous flow. Same contract-enforcement family as #1162 (ticketing format).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1163](https://github.com/gemstack-land/the-framework/issues/1163), created 2026-07-25, labels: `bug`, `priority: high`.

### Original description

Maybe because [`TODO_AGENTS.md`](https://github.com/gemstack-land/gemstack/blob/dc7d79c3f4d0afef5416520fb499fdd69cdb9558/TODO_AGENTS.md#L1) was generated before we introduced `todo_format.md`?
