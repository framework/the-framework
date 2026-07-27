Status: open
Topics: [bug]
GitHub: [#1281](https://github.com/gemstack-land/the-framework/issues/1281)

# A transient API drop kills a run permanently; retry via the existing continue-run machinery

## TLDR

In the end-to-end drive (real daemon, real agents, 7 runs in ~70 minutes; same session as #1279/#1280), 2 of the 7 runs died with `API Error: Connection closed mid-response`. The framework recorded them `failed`, released their queue claims, kept their worktrees — all correct — but the work was simply lost. One of the two entries later completed when a sweep tick happened to rediscover it, proving the failure transient: the run wasn't retried, the *entry* got lucky. Fix direction: when a child exits nonzero with a driver-level transient error (connection drop, 5xx, rate-limit), retry once or twice with backoff by continuing the same run in its retained worktree — the machinery exists (#923's `--continue-run` resume; #1278 made the recorded branch reliable). A run failing the same way after retries stays failed.

## Why it matters

A ~30% infant-mortality rate from connection drops breaks the demo's 10-agent beat: fan out 10 and statistically 2-3 die mid-work with nothing visible except a red row. The retry turns "2 of 7 runs silently lost" into "2 of 7 runs took one extra turn", using machinery that already exists.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1281](https://github.com/gemstack-land/the-framework/issues/1281), created 2026-07-27, label: `bug`.

### Original description

From the same end-to-end drive as #1279/#1280 (real daemon, real agents, 7 runs in ~70 minutes): 2 of the 7 runs died with

```
[framework] claude-code exited (1): API Error: Connection closed mid-response. The response above may be incomplete.
```

Both were sweep-drained queue runs. The framework recorded them `failed`, released their queue claim, and kept their worktrees — all correct — but the work itself was simply lost. One of the two entries got picked up again by a later sweep tick and completed on the retry, which shows the failure was transient; the run just was not retried, the *entry* was rediscovered ten minutes later by luck of the interval.

A ~30% infant-mortality rate from connection drops matters for the demo's 10-agent beat: fan out 10 and statistically 2-3 die mid-work with nothing visible except a red row.

The machinery to do better already exists:

- #923 resumes suspended runs after a daemon restart by re-spawning with `--continue-run`.
- The continue path re-attaches a run's worktree and branch (and since #1278 the recorded branch is reliable).

Fix direction: when a child exits nonzero with a driver-level transient error (connection drop, 5xx, rate-limit), retry once or twice with backoff by continuing the same run in its retained worktree, before declaring `failed`. A run that fails the same way after retries stays failed. That turns "2 of 7 runs silently lost" into "2 of 7 runs took one extra turn".
