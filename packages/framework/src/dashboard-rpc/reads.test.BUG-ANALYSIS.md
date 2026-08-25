# Bug analysis: packages/framework/src/dashboard-rpc/reads.test.ts

## Business logic (high-level)

Pins the "a read never fails at the user" half of `reads.SPEC.md` for three reads
(`onProjectFiles`, `onProjectFileStatus`, `onAgentWorktree`) against an unregistered project id,
plus the two pure annotators `markCloudWaiting` (#1668) and `markOtherHost` (#1648).

What the tests actually verify:

- The three unknown-project tests genuinely exercise the empty-result contract: `provideTestContext`
  wires the full context, `contextProjects()` reads the real global registry, and
  `'project-that-does-not-exist'` resolves no path, so each read must answer `[]` / `{}` / `null`
  without throwing. Sound (relies on the host registry not containing that id, which is safe).
- `markCloudWaiting`: records a question in the singleton store, asserts a `web` run whose
  `sessionId` matches is flagged, a different session and a `local` target are not. Sound; the
  store is reset before and after. Hygiene nit: the trailing `resetBridgeQuestions()` is not in a
  `finally`, so an assertion failure would leak the recorded question into later tests in the same
  process — only matters once the test is already failing, so not reported.
- `markOtherHost`: other host flagged, same host and absent host untouched, with an explicit
  `thisHost` so the runner's hostname never matters. Sound.

## Functions (low-level)

- `post`-style helpers: none; the file is four `test()` blocks plus two tiny row factories
  (`web`, `run`) that cast partial metas to `AgentMeta` — fine for the fields under test.
- Test "onProjectFiles … empty list" — passes iff the read resolves `[]`. Can fail (throw or
  non-empty). Correct.
- Test "onProjectFileStatus … empty map" — same shape. Correct.
- Test "onAgentWorktree … returns null" — unknown project → `null`. Correct.
- Test "onAgentWorktree refuses a run id that could escape the worktrees dir" — **does not test
  what it claims**: see bug below.
- Test "…handed to the dashboard as waiting (#1668)" — exercises the store join. Correct.
- Test "…from another host (#1648)" — pure, exhaustive over the three cases. Correct.

## Bugs found

1. `L26`–`L30`: the escape-guard test never reaches the guard it names. It calls
   `onAgentWorktree('project-that-does-not-exist', '../../etc')`, but `onAgentWorktree` returns
   `null` at `if (!root || !isSafeAgentId(agentId))` because `root` is already `undefined` for the
   unknown project — `isSafeAgentId` is never evaluated (short-circuit), making this test
   behaviourally identical to the unknown-project test above it. Delete the `isSafeAgentId(agentId)`
   check from `reads.ts` and this test still passes, so the guard the test exists to pin
   (`reads.test.SPEC.md`: "An agent id that could escape the worktrees directory is refused") is
   unpinned. Severity: minor (test gap, not runtime behavior). Fix sketch: register a real temp
   project for the case (or point the provider at a temp dir) so `root` resolves, then assert
   `onAgentWorktree(id, '../../etc')` is `null` while a safe id is not — or at minimum assert via a
   project that resolves.
