Priority: 5
Topics: [bug, the-framework]
GitHub: [#1165](https://github.com/gemstack-land/the-framework/issues/1165)

# test: the #1122 re-home test loses the bind under load (not a poll budget)

## TLDR

`binding a topic run re-homes it into the bound project` (`daemon-workspace.test.ts:269`) fails intermittently on CI — a race, not slowness: raising the poll budget (6s → 30s → 15s, #1153/#1154/#1160) never helped because every failure burns the whole budget and the second spawn never arrives. The diagnostic added in PR #1166 answered it on its first CI run: the **scratch directory is torn down** before the bind is seen — `settle()` in `onStartTopic` (fired on child error/exit) disarms the bind watcher and deletes the scratch; on passing runs the re-home completes first (~370 ms). Next to chase: why the spawned child settles early on Linux (the stub deliberately lingers on `--topic`, so either the spawn fails there or `spawnDetached`'s immediate child exits while the real process continues).

## Why it matters

Until fixed, this test is a merge blocker on unrelated PRs (#1156 hit it twice — and note: #1156 was merged with this check red (754b1943); it can't touch the daemon, the same test fails on `main`). The issue also models good practice: the earlier wrong diagnosis ("slow runner") is corrected on the record, and if the fix isn't quick, quarantining the test with a pointer beats re-running CI until green.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1165](https://github.com/gemstack-land/the-framework/issues/1165), created 2026-07-25, labels: `bug`, `priority: medium`, `the-framework ♻️`, 2 comments.

### Original description

`binding a topic run re-homes it into the bound project` (#1122, `daemon-workspace.test.ts:269`) fails intermittently on CI. It passes locally every time and passes on most CI runs, so it is a race, not a broken assertion.

**I diagnosed this wrong in #1153 and the fix in #1154/#1160 does not address it.** I read the first failure (6578ms against a 6s poll budget) as a slow runner and raised the budget. The evidence since says otherwise:

| budget | outcome |
|---|---|
| 6s (#1153) | failed at 6578ms |
| 30s (#1154) | whole file hit the 60s `--test-timeout` |
| 15s (#1160) | failed at 16311ms |

Every failure burns the **entire** budget and then reports `1 !== 2`. If this were slowness, a bigger budget would have caught it; instead the second spawn never arrives at all. The daemon is not re-homing on those runs — the bind is being lost.

The test seeds the bind by writing `run.json` and `events.jsonl` into the topic run's scratch dir after `onStart` returns, and the daemon tails that events file for `{kind:'bind'}` (`rehomeTopicRun` in `daemon-runtime.ts`). Two candidates for the lost event, both ordering-dependent and both invisible locally where the machine is fast:

1. The watcher's tail is armed against a file that does not exist yet and does not pick up the later creation on that path.
2. The daemon creates or cleans the scratch dir around the same moment the test writes into it, so the seeded files are clobbered.

Worth reproducing under load (`taskset`/`stress`, or a CI runner with the box busy) rather than reading the code cold — the timing is the bug.

Until it is fixed the test is a merge blocker on unrelated PRs (#1156 hit it twice). If the fix is not quick, quarantining it with a pointer here beats re-running CI until it passes.

### Notes from the GitHub thread

- A cheap diagnostic was proposed first: when the second spawn is missing, read the scratch events log (a failed re-home writes `could not re-home this run: <reason>` and retains the scratch) and whether the scratch still exists, instead of asserting a bare `1 !== 2`.
- The diagnostic's first CI run (PR #1166) returned `scratch removed: true` / `<no scratch events log>` — so it's not a lost `bind` event and not a failed re-home: `settle()` (on `child.once('error'|'exit')`) ran before the bind was seen, disarming the watcher (`stopBindWatch()`) and deleting the scratch (`tearDownTopicScratch`). The binary pass/fail split is whether re-home (~370 ms) beats the child settling.
- Next: find out why the child settles early on Linux — the stub lingers on `--topic` (`setInterval` + SIGTERM handler), so either the spawn itself fails there, or `spawnDetached`'s immediate child exits while the real process continues.
