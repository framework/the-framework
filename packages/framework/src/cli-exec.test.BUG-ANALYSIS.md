# Bug analysis: packages/framework/src/cli-exec.test.ts

## Business logic (high-level)

Tests for the CLI runner's timeout classification (#997), matching `cli-exec.test.SPEC.md`: a
process killed for outrunning its budget rejects as a timeout; a non-zero exit does not; the
timeout names the command and budget; recognition answers `false` for plain errors and non-errors;
an args-derived budget gives a slow operation room a short one denies.

The harness choice is the load-bearing idea and it is sound: `process.execPath` (Node itself) is
the stand-in binary, so the tests run identical on every platform that can run them at all — no
fixture binaries, no PATH assumptions. Timing margins are wide (400ms of work vs 50ms/10s budgets;
a 5s sleep vs a 50ms budget), so the assertions are effectively deterministic. The `rejection`
helper converts a rejection into a value, so a runner that wrongly *resolves* fails the subsequent
`isCliTimeout(undefined) === true`-style assertions rather than escaping as an unhandled
rejection — every promise is awaited.

Coverage is honest but partial, matching the test-SPEC's scope: the `preferStderr` behavior, the
`maxBuffer` raise, and — notably — the maxBuffer-overrun-vs-timeout distinction (the very case the
source's `ENOBUFS` comment tries to address) have no tests. Probing showed the source behaves
correctly there on Node 22, so the gap hides a stale comment rather than a live bug; recorded as a
gap here, with the note filed in `cli-exec.BUG-ANALYSIS.md`.

## Functions (low-level)

- **`CWD = tmpdir()`**: a directory guaranteed to exist on every platform, since `execFile` with a
  bad `cwd` fails with ENOENT and would poison every test. Correct.
- **`slowScript(mark)`**: `node -e` writing `mark` after 400ms — the two-budgets probe. The mark is
  interpolated into single quotes inside the `-e` source; both call-site marks are alphanumeric.
  Correct.
- **`rejection(promise)`**: resolves to the rejection or `undefined`. Correct.
- **timeout classification (L22-28)**: a 5s sleep under a 50ms budget → `isCliTimeout` true,
  `instanceof CliTimeoutError`, message matches `/timed out after 50ms/`. Pins both the brand and
  the class. Correct.
- **non-zero exit (L30-35)**: `process.exit(3)` under a 10s budget → an `Error` that is *not* a
  timeout. Exactly the misclassification #997 exists to prevent. Correct.
- **message shape (L37-41)**: constructs `CliTimeoutError('git', [...], 120000)` directly and
  asserts the exact message and recognition — pins the format independent of any subprocess.
  Correct.
- **negative recognition (L43-47)**: plain `Error`, a string, `undefined` → all `false`. Together
  with the brand check this pins the cross-module contract. Correct.
- **per-args budget (L49-63)**: one runner whose budget function records its args and answers 10s
  for args containing `'slow'`, 50ms otherwise. The slow op completes and its output round-trips
  (`'slow-done'`); the same 400ms of work under the short budget rejects as a timeout; `seen.length
  === 2` proves the budget was derived per invocation, not cached. The extra `'slow'` argv entry
  after `-e <code>` is ignored by Node — it only exists to be seen by the budget fn. Correct.

## Bugs found

None found. (Untested: `preferStderr`, `maxBuffer` raising, and the maxBuffer-kill-vs-timeout
distinction — the last is where `cli-exec.ts`'s stale `ENOBUFS` comment sits; behavior there was
probe-verified correct on Node 22.)
