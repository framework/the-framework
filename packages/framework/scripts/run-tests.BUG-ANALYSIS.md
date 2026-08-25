# Bug analysis: packages/framework/scripts/run-tests.mjs

## Business logic (high-level)

Runs the compiled Node test suite (`node --test` in `dist-test/`) against a throwaway
`XDG_CONFIG_HOME` (#765), so no test can find the developer's live daemon state (whose control
watcher would keep the event loop alive and fail the suite spuriously). The isolation lives here
rather than in each test file — the right layer.

Checked:
- **Env isolation** — `mkdtempSync` under the OS tmpdir; `XDG_CONFIG_HOME` overrides for the
  child only. Every config read in the suite goes through XDG (per the comment); nothing here
  can leak the real home.
- **Exit-code fidelity** — `close` handler: `process.exit(signal ? 1 : (code ?? 1))`. A passing
  suite (code 0) exits 0; a failing one propagates its code; a signal-killed child exits 1; the
  `?? 1` covers the (theoretically unreachable on 'close') null-code-null-signal case
  conservatively. Correct.
- **Spawn failure** — `error` handler cleans up and rethrows; an uncaught exception in the
  handler exits non-zero with the real error printed. Correct (a missing `dist-test/` cwd lands
  here as ENOENT — build ordering is the package script's job: `test` runs tsc first).
- **Cleanup** — `rmSync(recursive, force)` on both close and error. If the parent itself is
  killed (SIGINT to the group), the temp dir can be left behind — an OS-tmpdir residue, which
  every mkdtemp user accepts; not worth handlers per the project's simplicity rule.
- **Arg passthrough** — `process.argv.slice(2)` lets `node scripts/run-tests.mjs <filter...>`
  forward filters to `node --test`. `--test-timeout=60000` bounds a hung test.
- **stdio: 'inherit'** — TAP output streams straight through; no buffering surprises.

## Functions (low-level)

- module body (spawn + two handlers + cleanup) — as analyzed. One nuance: `cleanup` runs in the
  `close` handler *before* `process.exit`, so the removal is synchronous and cannot be cut short.
  Verdict: correct.

## Bugs found

None found.
