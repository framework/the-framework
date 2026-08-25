# Bug analysis: packages/framework/src/driver/claude-code-quota.test.ts

## Business logic (high-level)

Pins the quota read against a verbatim 2.1.210 readout, decoys included. What the tests actually verify:

- **Window extraction** — all three windows with label/kind/percent/reset asserted deeply; the decoy lines (`70% of your usage…`, `Top skills: … 2%…`) proven not to become windows (count 3 + label prefix check).
- **Overage header** — the mid-overage wording still parses as available (the SPEC's rationale for matching the shared header tail).
- **Fractional percent, missing reset phrase** — both shapes.
- **`unrecognized` vs `no-subscription`** — header-present-but-unreadable vs no header, plus empty-readout → unavailable (the "never a zero" pin).
- **`isTransientQuotaReason`** — all five reasons split correctly (this is the one test of `types.ts` executable code, placed here sensibly).
- **`readClaudeQuota` integration** — envelope unwrap; exact argv `['-p','/usage','--output-format','json']` plus the explicit `--bare` absence; `is_error` arm → `fetch-failed`; non-zero exit → `fetch-failed`; non-JSON stdout → `unrecognized`; ENOENT-style `error` event → `agent-not-found` (delivered via `queueMicrotask`, matching real async delivery); hung child → `timeout` with `timeoutMs: 5`.

Soundness details:

- The hung-child fake registers no `close`/`error` handlers (`on: () => proc`) and its stdout never ends — the only way the promise settles is the timer, so the timeout test cannot pass vacuously. It also implicitly verifies the timer is not unref'd (an unref'd timer would still fire under the test runner's live loop, so that property is only argued in source comments — acceptable).
- No test covers the abort path (`opts.signal`) or the `cwd` option; the abort→`timeout` mapping therefore rests on source reading alone. Gap, not a defect.
- No test covers stdout split across chunks mid-multibyte (`·`) — the Buffer-concat rationale in source is untested. Gap, not a defect.
- All tests await; every assertion can fail; the deep `assert.deepEqual` on windows would catch label/kind/percent/reset regressions precisely.

## Functions (low-level)

- **`REAL_READOUT`** — the fixture's value is its verbatim-ness; includes the header, blank lines, and the behavior-breakdown decoys. Verdict: correct.
- **`fakeSpawn(stdout, code, onSpawn)`** — single-chunk stdout, `close` on stream end, argv capture hook. Verdict: correct.
- **Hung/ENOENT fakes (inline)** — as analyzed above. Verdict: correct.

## Bugs found

None found.
