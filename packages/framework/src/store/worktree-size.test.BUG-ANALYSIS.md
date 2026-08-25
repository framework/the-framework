# Bug analysis: packages/framework/src/store/worktree-size.test.ts

## Business logic (high-level)

Tests for `worktreeSize` (worktree.ts): the size read only ever labels a "remove this" button
(#798), so every failure mode must come back as `undefined` rather than a throw or a wrong
number. Checked against `worktree-size.test.SPEC.md` — all three clauses are covered:

- **Bytes conversion** — a canned `SizeRunner` returning `'2048\t/some/tree\n'` must yield
  `2048 * 1024`; pins both the kilobyte unit of `du -sk` and the first-field parse.
- **Real directory** — writes a 4 KiB file into a tmpdir and calls the default runner. The
  assertion is deliberately loose: `size === undefined || size > 0`, because `du` reports disk
  blocks (platform-dependent) and is absent on Windows, where `undefined` is the specced answer.
  This is the one test here that *cannot fail* on a POSIX box with a working `du` unless
  `worktreeSize` returns 0 or a negative — which is exactly the wrong-number class it guards; on a
  du-less platform it degenerates to always-pass by design. Acceptable given the spec's own
  "unknown is a pass" framing; noted, not reported.
- **Failure modes** — a throwing runner → `undefined`; unparseable output (`'not a number\n'`,
  `''`) → `undefined`, covering both the parseInt-NaN and the empty-split paths in the source.

The tmpdir in the real-directory test is not cleaned up (no `rm` in a `finally`), unlike the
repo's other real-fs tests — a few bytes of tmp litter per run, cosmetic only, below the bug bar.

## Functions (low-level)

No helpers; four `test(...)` bodies calling `worktreeSize` with either an inline async
`SizeRunner` or the default. All promises awaited; assertions are direct equality (or the
documented loose disjunction). Inputs exercised: happy path, real fs, thrown error, garbage
output, empty output. The remaining source branch — `du` exiting non-zero *with* partial stdout
(execFile rejects, so `undefined`) — is behaviorally identical to the thrown-runner case already
covered.

## Bugs found

None found.
