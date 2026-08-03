Status: open
Priority: 9
GitHub: [#1334](https://github.com/gemstack-land/the-framework/issues/1334)

# Goal: let TF fully *autonomously* work on quick-wins

## TLDR

When a new ticket is created, the maintainer doesn't know whether it's a quick-win, so they can't tell whether AI should just implement it. Close the loop autonomously: every new ticket is spiked & planned via the Routine work; if the spike & plan determines it's a consensual quick-win, it's implemented autonomously. The "Update tickets from GH" prompt is in the routine task (done); still required: ensure the squash-merge commit contains `(fix #1234)`, otherwise the ticket stays open.

## Why it matters

Dogfooding — the highest-prio goal. This is the end-to-end autonomy chain: ticket → spike/plan → (if consensual quick-win) → implementation, with zero human intervention. Builds on #1327 (concurrent spike & plan fan-out).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1334](https://github.com/gemstack-land/the-framework/issues/1334), created 2026-07-28, labels: `highest-prio 🌟`, 5 comments.

### Notes from the GitHub thread

- Live evidence (2026-07-31) on the `setReadyForMerge` gate (#1392): whether the signal fires is a function of the model tier, not of prompt wording. Haiku 0/5 (never signals → draft PR, merge withheld); Sonnet, Opus and Fable each 1/1 unprompted (fully autonomous merges #1405/#1407/#1428, Fable launch→merge in ~50s). Since the launcher routes trivial prompts to Haiku, "auto-merge armed + stock quick-win" is always withheld today — which blocks this goal.
- Fix directions (maintainer agreed, "sounds good"): (1) model floor — merge-armed runs never go below the tier that reliably follows the terminal protocol, i.e. Sonnet; also a hard constraint for any future "Auto" model chooser. (2) Haiku-proof the system prompt — looks like the harder path: the "required, the work is never merged without it" wording is already there and Haiku ignores it 5/5.
- The issue was auto-closed twice by accident and reopened: plan PRs inherit `(fix #N)` from the ticket, but a plan landing is not the work landing — plan PRs should say `refs #N` instead; the second closer was a squash-commit body whose "auto-closed #1334" phrasing GitHub read as a closing keyword. The work is still not implemented.
- The plan (`tickets/2026-07-28_goal-autonomous-quick-wins.plan.md`, landed via PR #1434) lists what is still missing: the plan→queue bridge, and the Haiku warning for merge-armed runs.
- Related: with the signal firing, merges land seconds after the PR opens, before CI — tracked as #1406 (repo settings, not code). The run-meta `model` observability gap spotted while gathering the tier evidence was filed and has since been fixed (#1438).
