Priority: 9
GitHub: [#1204](https://github.com/framework/the-framework/issues/1204)

# Setting to set number of concurrent agents

## TLDR

New routine setting: number of concurrent agents (default 2) that the routine spins up. Needed for the demo video, to show off 10 CC web sessions working in parallel. Status: landed via #1252, verified end to end on 2026-07-27 (see [Verification](#verification)), and **verified live through the dashboard on 2026-08-21**: the number lands as `autoPmConcurrency` in `~/.the-framework.json` and the sweep re-reads it per tick, so a change takes effect without restarting the daemon. Run now on the drain fans out too — the click is the consent the preference otherwise records.

Which routines fan out is now declared as data (`fansOut` at `auto-pm.ts:209`): only the **drain** (one agent per queue entry) and **[Plan tickets]** (one agent per ticket's sibling files) — disjoint work on disjoint files. Every other rotation job (Update tickets, both triages) rewrites the whole queue document from the same fork point, so two at once would revert each other; maintainer agrees with the principle ("as long as there isn't any redundant work being done, I don't see a problem with concurrent agents"). For the demo: the drain is the routine that gives ten visibly parallel sessions — put ten entries on the queue.

**What's left — the one open item:** Run now on **[Plan tickets]** starts exactly one agent (`RoutineWork.tsx:159-161`, tooltip says so) while auto-run fans the same routine out to the concurrency. Option A: leave it (Run now = "start this routine once"; fan-out is what unattended running adds). Option B: make the button fan out like the daemon does. Curator leans **B**: the asymmetry is invisible from the card, and it's the case where the setting silently does nothing. Also worth a look from the 2026-08-23 dogfood: the drain started 2 of 3 with concurrency 3 because `activeAgentCount` (live pids + the `starting` set, `daemon-runtime.ts:840`) counted one live agent while the Agents panel showed none — undiagnosed; a `starting` key that outlives its run would cost one slot forever.

## Why it matters

Marked highest-prio 🌟: parallel agents are the demo's money shot and the core throughput lever. The setting itself has coverage on every seam; what remains is making the Run-now button and the daemon agree on fan-out, and pinning down the possible lost slot.

## Verification

Verified 2026-07-27. The setting works: a routine spins up exactly the configured number of
concurrent agents, one pinned queue entry each.

The chain, and where each link is held:

| Link | Covered by |
| --- | --- |
| Number input → `updatePreferences({ autoPmConcurrency })`, clamped to the cap | `framework-dashboard/components/RoutineWork.test.tsx` (24 pass) |
| Preference → registry file, clamped/rounded/junk-dropped | `registry.test.ts` |
| **Registry file on disk → `deps.concurrency()` → a batch of N pinned drains** | `daemon-services.test.ts` — **added by this verification**, the one seam that had none |
| Batch policy (cap, top-up, one-per-tick rotation) | `auto-pm.test.ts` (8+ tests naming #1204) |
| N concurrent runs on one project, each in its own worktree, really spawned | `daemon.test.ts` "a git project starts concurrent runs, each in its own worktree (#736)" |

The two added tests drive the real `startBackgroundServices` against a real registry file and a
real `TODO_AGENTS.md`, stubbing only the daemon's spawn: with `autoPmConcurrency: 4` and six open
entries the start-up sweep asks for exactly four runs, pinned to the first four entries in order,
each `unattended` and carrying its own `queueEntry` + `ticket`; and with auto-run off, the drain
row's Run now (`wakeAutoPm({ onDemand: true, drainOnly: true })`) fans out to three.

They bind to the setting rather than passing incidentally — severing the read
(`concurrency: async () => undefined`) fails both, on the batch size rather than on a side effect.

A later end-to-end test (over a real registry and a real data branch) confirms the other half:
the number on disk is the number of unattended agents actually spun up (four in the test), each
pinned to a different queue entry with its ticket claim committed before its agent starts. Only
the process spawn is stubbed. (`daemon-services.test.ts`)

### Caveats found while verifying (none is a defect in the setting)

- **Only the draining routine and [Plan tickets] fan out.** By design and now declared as data
  (`fansOut`): the other rotation jobs each rewrite the whole queue file, so two at once would
  revert each other. For the 10-parallel-agents demo the queue must already hold ≥10 open entries.
- **A batch smaller than the cap is not topped up for 30 minutes.** `DEFAULT_AUTO_PM_COOLDOWN_MS`
  is stamped once per batch, so a queue that grows just after a short batch waits out the cooldown.
  (Run now is no longer swallowed by the cooldown — #1645, verified in the 2026-08-23 dogfood.)
- **Hands-off web runs can let a later batch exceed the cap.** Their local process ends at the
  hand-off, so `activeRunCount` stops counting them while the cloud session still works. The
  #1253 durable claims still stop the same *entry* going out twice, so this over-fans rather than
  duplicating work.

### Unrelated, noticed in passing

`daemon.test.ts` fails 10 of 29 in a checkout where `packages/the-framework/dist/dashboard-client`
is absent — the daemon answers `the dashboard bundle is not installed` and the tests JSON-parse it.
Running `npm run build` in `framework-dashboard` then `npm run bundle:dashboard` makes all 29 pass.
A test-environment prerequisite, not a regression.

## Source

Imported from GitHub issue [framework/the-framework#1204](https://github.com/framework/the-framework/issues/1204), created 2026-07-25, label: `highest-prio 🌟`, 8 comments (last folded: 2026-08-22T22:29Z).

### Original description

New setting for routine: number of concurrent agents (default 2).

The setting drives the number of concurrent agents that are spinned by the routine.

Needed for the demo video, so we can show off 10 CC web sessions working in parallel.

### Notes from the GitHub thread

- 2026-08-23 whole-chain dogfood on a throwaway repo, after #1640/#1644/#1645 merged: Plan tickets fanned out 3 agents (locks committed *before* any agent started); the quick-win triage queued instead of implementing (#1644 fix held — its own branch had zero commits, no PR); Run now inside the 30-minute cooldown ran instead of being swallowed (#1645); the stale-branch abort (#1643) reproduced on `main` and has since been fixed/closed. Cost: seven Opus runs.
- Side-findings from that dogfood, tracked elsewhere: drain PRs carried `.the-framework/` scaffolding onto the throwaway repo's `main` (#1638); the routine card's project picker reset to the first project on navigation (#1647, closed since) — one mis-click had pushed an empty `tf-triage-quick` to this repo's origin, flagged for deletion.
