Priority: 9
GitHub: [#1204](https://github.com/gemstack-land/the-framework/issues/1204)

# Setting to set number of concurrent agents

## TLDR

New routine setting: number of concurrent agents (default 2) that the routine spins up. Needed for the demo video, to show off 10 CC web sessions working in parallel. Thread opens: the setting should also drive concurrency from the routine-task side — e.g. clicking "Run now" on quick-wins should lead to the max number of concurrent agents — and it's unclear which routine tasks actually trigger on auto-run. Status: landed on `main` via #1252; **verified working end to end on 2026-07-27** (see [Verification](#verification)). What is left is the thread's open question, not the implementation.

## Why it matters

Marked highest-prio 🌟: parallel agents are the demo's money shot and the core throughput lever. The remaining work is answering how the setting applies to routine-triggered runs; the setting itself now has coverage on every seam.

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

### Caveats found while verifying (none is a defect in the setting)

- **Only the draining routine fans out.** By design and documented: the rotation jobs each rewrite
  the whole queue file, so two at once would revert each other. For the 10-parallel-agents demo the
  queue must already hold ≥10 open entries — the *triage* routines will not spin up 10 agents to
  fill it. This is the same ground as the thread's open question below.
- **A batch smaller than the cap is not topped up for 30 minutes.** `DEFAULT_AUTO_PM_COOLDOWN_MS`
  is stamped once per batch, so a queue that grows just after a short batch waits out the cooldown.
- **Hands-off web runs can let a later batch exceed the cap.** Their local process ends at the
  hand-off, so `activeRunCount` stops counting them while the cloud session still works. The
  #1253 durable claims still stop the same *entry* going out twice, so this over-fans rather than
  duplicating work. Worth a decision alongside the open question, not before it.

### Unrelated, noticed in passing

`daemon.test.ts` fails 10 of 29 in a checkout where `packages/the-framework/dist/dashboard-client`
is absent — the daemon answers `the dashboard bundle is not installed` and the tests JSON-parse it.
Running `npm run build` in `framework-dashboard` then `npm run bundle:dashboard` makes all 29 pass.
A test-environment prerequisite, not a regression.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1204](https://github.com/gemstack-land/the-framework/issues/1204), created 2026-07-25, label: `highest-prio 🌟`, 4 comments.

### Original description

New setting for routine: number of concurrent agents (default 2).

The setting drives the number of concurrent agents that are spinned by the routine.

Needed for the demo video, so we can show off 10 CC web sessions working in parallel.

### Notes from the GitHub thread

- The setting should drive concurrency from the routine-task perspective too: "Run now" on e.g. quick-wins should use the max number of concurrent agents. Related open question: which routine tasks are triggered when the routine is auto-run?
- OP was updated; the implementation landed on `main` via #1252 (per #1243's closing note), but the maintainer isn't sure it works — verification is the remaining step. **Done 2026-07-27: it works, see [Verification](#verification).** The ticket stays open for the first bullet's open question only.
