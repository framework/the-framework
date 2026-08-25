# Bug analysis: packages/framework/src/dashboard-rpc/agent-addressing.test.ts

## Business logic (high-level)

Pins the #749 addressing rule (steering writes land in the *agent's* control channel, not the project root) and the worktree-removal rules (#737/#982), against the real registry (throwaway `XDG_CONFIG_HOME`) and real checkouts:

- **Addressing**: `sendStop`/`sendMessage`/`sendChoice` with an agent id write only that worktree's `control.jsonl` (root untouched); no id or an unknown id falls back to the root; a worktree that exists but has no `agent.json` yet (#766, the first-seconds case) still resolves to the worktree — the exact regression that once made a fresh feed tail a previous agent.
- **Removal**: refused while the meta says `running` (message `/still going/`), refused for an unsafe id (`../../etc` → `/invalid session id/`), reported as unknown for a nonexistent id (`/no worktree for session nosuchrun/`) rather than a false success; the dashboard's Remove commits the dirty edit and pushes it to a real bare `origin` before the checkout goes (#982/E5) — asserted by `git show` on the branch and on `refs/remotes/origin/...`.
- **Listing**: `onRetainedWorktrees` hides a running agent, lists it once failed.
- **Dedup (#768)**: an agent that is live again *and* has an archived first leg reads as one row with status `running`, not as its archived `done`.

The tests genuinely verify these — each asserts the concrete file contents (`entries()` parses the JSONL) or the git state — with one exception: the vacuous assertion at L119 (see Bugs).

Environment: each helper snapshots and restores `XDG_CONFIG_HOME` (unlike `control.test.ts`); `provideTestContext()` is called with defaults, which also builds the real quota source (cost recorded against `test-context.ts`). Serial node:test execution keeps the env mutation safe.

## Functions (low-level)

- **`projectWithWorktreeAgent()`** — hand-built worktree dir + live `running` meta (id `2026-07-19T10-00-00-000Z`, a valid agent-id shape so `isSafeAgentId` passes), registered project, wired context; returns both candidate control paths and a restore. Correct.
- **`entries(path)`** — read-catch-to-empty, split, parse. Never rejects; `[]` for an absent file — right for content assertions, but the reason the L119 check is vacuous. Correct in itself.
- **`projectWithDirtyWorktree()`** — real repo + bare origin + `addWorktree` on the agent branch + an uncommitted edit; registered + context. Matches the E5 rule's preconditions (somewhere to push). Correct.
- **Test: sendStop addresses the run** — asserts agent channel `[{kind:'stop'}]`, root `[]`. Correct.
- **Test: sendMessage/sendChoice address the run** — asserts both entries in order, root empty. Correct.
- **Test: unknown/absent id falls back** — two stops land at the root, agent channel untouched. Correct.
- **Test: refuse while live** — result + message asserted; the third assert is the vacuous one (Bugs). Partially correct.
- **Test: unsafe id** — asserts `/invalid session id/`. Correct.
- **Test: Remove commits + pushes** — asserted against branch and remote. Correct.
- **Test: unknown session** — exact error message. Correct.
- **Test: onRetainedWorktrees hide/list** — flips the meta to `failed` and re-asserts. Correct.
- **Test: no-meta worktree resolves (#766)** — fresh worktree dir only; stop lands there. Correct.
- **Test: no worktree at all falls back (#766)** — root gets the stop. Correct.
- **Test: continued run reads running (#768)** — archived `done` + live `running`, expects one row, `running`. Correct.

## Bugs found

1. **L119: assertion that cannot fail** — `assert.equal(await entries(ctx.agentControl).then(() => true), true, 'the worktree is untouched')`. `entries()` never rejects (its `readFile` has `.catch(() => '')`) and always resolves an array, so `.then(() => true)` is unconditionally `true`; the assert compares `true` to `true` regardless of whether the refused Remove touched, emptied, or deleted the worktree — the very thing its message claims to check. Scenario: a regression where the refusal path still deletes the checkout (or its control log) would sail through this test. Contradicts the test-SPEC's claim that removal "is refused … never as a false success" being *verified*; per the ground rules a test that cannot fail is a bug. Severity: minor. Fix: assert something real, e.g. `assert.equal(await stat(worktreePath(ctx.dir, ctx.agentId)).then(s => s.isDirectory(), () => false), true, 'the worktree is untouched')` (or `assert.deepEqual(await entries(ctx.agentControl), [])` if the intent was "no entry was written").
