Priority: 9
GitHub: [#1327](https://github.com/gemstack-land/the-framework/issues/1327)

# Goal: fire 10 `Spike & plan` agents concurrently

## TLDR

Make this work ASAP: settings set to run in Claude Web, routine work limited to "Spike & plan tickets", concurrent agents = 10; clicking [Trigger routine now] spins up 10 concurrent agents that spike & plan one ticket each. Needs a lock mechanism so agents don't double-work a ticket: `.spike.md`/`.plan.md` placeholder files (`PENDING:<AGENT_ID>`) created and pushed to `main` before the agent starts; an agent refuses a ticket whose spike or plan file already exists and picks another.

## Why it matters

Highest-prio dogfooding goal: this is the fan-out beat the framework exists for, and it feeds #1334 (fully autonomous quick-wins).

## Thread refinements (change the plan)

- **Blocker cleared (2026-08-17):** #1320 is closed — a "Run on: Claude web" launcher run now lands its own PR fully autonomously (first one: #1546; chain evidence on #1320). Web sessions provision repo-bound and can push and open PRs, so fanning spike/plan agents out to cloud sessions is no longer blocked on delivery. Plan B (local driver) is no longer needed for that reason.
- **Lock tweaks agreed in the thread:**
  1. The **daemon** pushes the PENDING files, not the agents (agents can't push, see #1320) — and locks the whole batch in one commit.
  2. Staleness rule: PENDING + no PR + N minutes old = reclaimable, otherwise a dead agent bricks its ticket forever.
  3. Composes with #1316 (merged): PR diffs claim work after a PR exists; these locks cover before. Both windows closed.
- Maintainer will update the `Spike & plan` prompt; the code side (fan-out, one pinned ticket per agent) can be built now.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1327](https://github.com/gemstack-land/the-framework/issues/1327), created 2026-07-27, labels: `highest-prio 🌟`, 2 comments (folded above; latest 2026-08-17 delivery update).
