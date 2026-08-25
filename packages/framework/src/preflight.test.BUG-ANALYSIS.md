# Bug analysis: packages/framework/src/preflight.test.ts

## Business logic (high-level)

Twenty tests over `preflight`/`preflightProblems`, driven entirely through the `probe` and
`isRoot` seams so nothing spawns a real binary. Coverage maps closely onto `preflight.SPEC.md`:

- **Driver selection (#542)**: `probed` records which binary got `--version`, asserting `['codex']`
  exactly - so a regression to "always probe claude" fails, and so does probing both. The
  companion test asserts the *codex* install URL appears in the failure detail, which pins that the
  hint comes from the driver spec rather than a hardcoded string.
- **Auth tri-state (#1326)**: all three states are covered separately - explicit `false` fails and
  names the fix, explicit `true` passes and adds a check, unreadable output adds **no check at
  all** (asserted as `undefined`, which is stronger than asserting `ok: true`). The codex
  substring trap ("Not logged in" contains "logged in") gets its own test, which would fail against
  a naive positive-first matcher.
- **Probe economy**: `auth is not probed when the CLI itself is missing` records every arg vector
  and asserts `[['--version']]` - the only test in the file that proves a probe was *not* made,
  and it also asserts exactly one problem line.
- **Warnings vs failures**: the root tests assert `warn === true`, `ok === true` and
  `result.ok === true` together, i.e. the full "warnings travel" contract; the
  `preflightProblems` test asserts the warning is absent from the problem list *and* that the one
  problem is the auth line, prefix-anchored with `/^claude auth: /`.
- **gh (#1419)**: missing gh, logged-out gh, healthy gh (asserting *nothing* named `gh*` is
  added - a negative assertion), and gh not probed at all without `publish`.
- **Environment independence**: the `notRoot` spread is applied to every test that is not about
  root, with the comment explaining why (the suite must pass inside a root CI container). This is
  a real hazard correctly neutralised: without it, `preflight`'s default `runningAsRoot` would add
  a warning check under Docker and the `result.checks.find(...)` assertions about check *absence*
  would still pass, but the root-specific tests would become non-deterministic.
  `sudoUser: undefined` is passed explicitly in the root test so a CI machine with a real
  `SUDO_USER` cannot change the expected wording.

Nothing is time-dependent, no test shares mutable state with another, and every `preflight` call is
awaited before its assertions.

## Functions (low-level)

### `probeFor(answers)`

Dispatches on `args[0] === '--version'`, returning the version answer or the auth answer, with
defaults `{ok:true,output:'1.2.3'}` and `{ok:true,output:''}`. The auth default is meaningful: an
empty output makes the claude parser's `JSON.parse('')` throw, which the parser maps to
`undefined`, i.e. "would not say" - so tests that do not care about auth get no auth check rather
than an accidental pass or fail. Works for both drivers because neither auth arg vector starts with
`--version` (claude: `auth status`, codex: `login status`). Correct.

### `withGh(gh)`

Dispatches on `bin === 'gh'` first, then on `--version` vs anything else, and answers everything
non-gh with a healthy `1.2.3`. That means the driver CLI passes both its version and (via an
unparseable `1.2.3`) its auth-unknown path, so the gh tests isolate the publish block cleanly.
Correct.

### `notRoot`

`{ isRoot: () => false }`, spread into 15 of the tests. Correct and necessary.

### The test bodies

All `async`, all awaiting. Non-null assertions (`cc!.detail`) always follow an assertion on the
same object's presence or `?.ok`, so a missing check fails as an assertion rather than a TypeError
in most cases; a few (`assert.match(cli!.detail, ...)` at L52, L163) would throw a TypeError
instead of failing cleanly if the check were absent - noisy but still a failing test, not a false
pass. Verdict: correct, except the one below.

Coverage gaps (not bugs): `defaultProbe` itself is never exercised (no test covers the real
`execFile` wrapper, its 10s timeout, or its stream merge); `preflight`'s behaviour when `opts.bin`
overrides the driver's binary is only used incidentally; and no test covers `publish: true`
combined with a *missing* driver CLI (the case where gh probes still run after a hard failure).

## Bugs found

1. `L141-L145`: the test named `the auth answer is read off stderr too (#1326)` does not exercise
   stream merging at all - it injects a `probe` whose `output` is already merged, so
   `defaultProbe` (the only code that concatenates stdout and stderr) never runs. Its inputs are
   byte-identical to the test at L95 (`driver: 'codex'`, `auth: { ok: false, output: 'Not logged
   in' }`), making it a duplicate that would keep passing if `defaultProbe` were changed to read
   stdout only - the exact regression its comment says it guards against, and one that would
   silently turn every logged-out codex into "would not say". Severity: minor. Confidence: high.
   Fix sketch: either delete it as a duplicate, or make it a real test of `defaultProbe` by
   probing a command that writes only to stderr (e.g. `node -e "process.stderr.write('Not logged
   in')"`) and asserting the output comes back.
