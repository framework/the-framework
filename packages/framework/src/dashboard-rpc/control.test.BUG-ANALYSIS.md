# Bug analysis: packages/framework/src/dashboard-rpc/control.test.ts

## Business logic (high-level)

Pins two slices of `control.ts` against real repos with real `tf-data` branches (no mocks below the RPC):

1. **`sendStart` ticket resolution (#1117)** — a hand-fired drain (the `presets.drainQueue.render()` prompt) carries the queue entry's ticket (`tickets/2026-07-25_login.md` read from the seeded `TODO_AGENTS.md` link), any other prompt carries none however full the queue is, and a caller-named ticket wins over the lookup. The harness captures the `options` the wired `startAgent` stub received, so the assertion is on exactly what the daemon would be handed — the fact rendered on the agent's meta. These verify the SPEC's "resolved here rather than accepted from the browser" behavior end to end (real registry, real data branch, real preset text).
2. **`sendReleaseTicketLock` (#1420/#1582)** — releasing deletes the `.lock.md` *on the data branch* (asserted via `git show tf-data:…` rejecting for the lock and still answering for the ticket — a commit, not a checkout edit), a ticket with no lock answers `this ticket holds no lock`, and every non-bare-ticket name (`../escape.md`, `a/b.md`, a `.lock.md`, a `.plan.md`, `thing.txt`) is refused with `not a ticket filename` — the SPEC's "refused before any project is resolved" (the test can't observe the ordering directly, but the refusal shape matches the pre-resolution gate in the source).

Do the tests verify what they claim? Yes: each assertion compares concrete values (the ticket path, the exact result object, git's own view of the branch), all async work is awaited, and the failure of any pinned behavior flips a real assert.

Environment handling: `registerProject` points `process.env.XDG_CONFIG_HOME` at a per-test dir and never restores it. Within this file every test re-sets it before use and node:test runs the file's cases serially in one process, so there is no cross-test leak inside the file; the process exits afterwards. Acceptable, though the sibling suites (`projects.test.ts`, `agent-addressing.test.ts`) do restore — inconsistency noted, not a bug.

One real cost noted (fix belongs elsewhere): every test calls `provideTestContext`, whose default wiring builds a **real** `defaultQuotaSource()` — which immediately spawns `claude -p /usage` (see the finding recorded against `test-context.ts` in this batch's report). This file neither needs nor uses the quota capability.

## Functions (low-level)

- **`dataRepo(files)`** — committed repo on `main`, then `withDataBranch(cwd, 'seed', …)` writing `tickets/` + the given files onto `tf-data`; asserts the seed committed. Matches the #1582 layout the RPCs read. Correct.
- **`registerProject(cwd, over)`** — throwaway registry via `XDG_CONFIG_HOME`, real `addProject`, `provideTestContext(over)`, returns `projectId(resolve(cwd))` — the same derivation the RPC layer resolves. Correct.
- **`harness()`** — seeds one queued ticket (a markdown link in `## Priority 9`), wires a capturing `startAgent` that answers `{ok:true, agentId:'r1'}`. Correct.
- **`lockedProject(files)`** — `dataRepo` + registration. Correct.
- **Test: drain carries ticket** — asserts `result.ok` and `started()?.ticket` equals the seeded ticket path. Correct.
- **Test: other prompt carries none** — asserts `started()?.ticket === undefined`; would catch the false-positive lane the comment describes. Correct.
- **Test: caller ticket wins** — asserts the explicit ticket survives. Correct.
- **Test: release deletes + commits** — asserts `{ok:true}`, lock gone from `tf-data`, ticket intact. Correct.
- **Test: honest no-lock** — asserts the exact error object. Correct.
- **Test: filename gate** — five bad names, each asserted with the name in the message. Correct.

## Bugs found

None found in this file. (The real-quota-source cost every `provideTestContext()` call incurs is recorded against `packages/framework/src/dashboard-rpc/test-context.ts` in the batch report.)
