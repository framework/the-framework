GitHub: [#1432](https://github.com/gemstack-land/the-framework/issues/1432)

# Spike & plan can never fire while the AI queue has entries

## TLDR

The routine sweep prioritizes draining: with a non-empty `TODO_AGENTS.md`, `autoPmDecision` returns mode `drain` (`packages/the-framework/src/auto-pm.ts:134`), and when the draining routine is switched off the sweep stands down entirely (`auto-pm.ts:676`). The rotation — where the `Spike & plan` job lives — is only reached with an **empty** queue, so with a standing backlog the #1327/#1420 fan-out is unreachable from both Auto-run and "Trigger routine now", regardless of which routines are ticked. Preferred fix (a): when the drain routine is switched off, fall through to the rotation instead of standing down — inventing-work routines stay reachable and #1209 keeps meaning "do not *work* the queue". Alternatives: (b) make the `Spike & plan` row's "Run now" fan out (today it deliberately starts a single unpinned agent via the launcher path); (c) keep the behavior and document queue-empty as a rotation precondition.

## Why it matters

Planning tickets neither drains nor adds queue entries, yet a standing backlog (23 entries at filing) blocks it entirely. Observed live: only `Spike & plan` ticked, trigger pressed twice → both sweeps stood down, and the explanatory note was itself invisible (filed as #1433, since fixed). The maintainer had to clear the AI queue just to test the trigger — the queue's contents were all auto-populated, no meaningful work lost, but that's not a workflow.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1432](https://github.com/gemstack-land/the-framework/issues/1432), created 2026-07-31, no labels, 3 comments.
