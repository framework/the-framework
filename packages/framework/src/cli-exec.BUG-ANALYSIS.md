# Bug analysis: packages/framework/src/cli-exec.ts

## Business logic (high-level)

The one `execFile` wrapper for every CLI the framework shells out to (`git` via `project.ts`, `gh`
via `dashboard/gh.ts`). Responsibilities per `cli-exec.SPEC.md`:

- Run `bin args...` in `cwd`, resolve stdout as a string, reject on non-zero exit.
- A per-binary time budget — flat or derived from the args (#997: `git push` vs `git rev-parse`) —
  after which the process is killed and the rejection is a **recognizable timeout**
  (`CliTimeoutError`, naming the command and budget), distinct from a failure the tool reported.
- Recognition must survive a module boundary (`timedOut` brand rather than `instanceof` only).
- Optional larger `maxBuffer`; optional `preferStderr` so `gh`'s useful stderr ("not logged in")
  becomes the error message instead of the generic "Command failed: …" line.

The classification is the delicate part, and it was verified against the actual runtime (Node
v22.22.2 probes):

- Timeout kill → callback error `{killed: true, signal: 'SIGTERM', code: null}` → the
  `killed === true` branch fires → `CliTimeoutError`. Correct.
- maxBuffer overrun → `RangeError` with `code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'` and **no
  `killed` property at all** (Node attaches `killed` only to the generic error it constructs
  itself) → the branch does not fire → rejects with the real maxBuffer error (or trimmed stderr
  under `preferStderr`, falling back to the message when stderr is empty). Correct outcome — but
  the comment "only the latter carries ENOBUFS" is factually wrong (no Node version puts `ENOBUFS`
  on this error), making the `code !== 'ENOBUFS'` clause dead code. Since the guard's outcome is
  right for both real cases, this is a misleading comment, not a behavioral bug — noted, not
  reported.
- Externally killed child (OOM killer, manual `kill`) → `killed: false`, `signal` set → generic
  error, not a timeout. Correct (only the wrapper's own kill may claim "timed out").
- Non-zero exit → generic error (or stderr under `preferStderr`). Correct.

Other edges: `timeoutMs` resolved per call, so an args-derived budget is evaluated on the actual
args (both `gitTimeoutMs` and the `gh` constants are always positive — a 0 would silently mean "no
timeout" to `execFile`, but no caller produces one; reliance noted). A child that traps SIGTERM and
refuses to die would stall the promise past the budget — `execFile` sends `killSignal` once —
irrelevant for `git`/`gh`. `String(stdout)` is a no-op on the default-encoding string but keeps the
signature honest if a caller ever passes a Buffer-producing option set. The lazy
`await import('node:child_process')` is per-call and cheap (module cache).

## Functions (low-level)

- **`CliRunner` / `CliTimeout` types**: the runner contract and the flat-or-derived budget.
  Correct as declared.
- **`CliTimeoutError`**: extends `Error`, brand `timedOut = true` (readonly field, always set),
  message `"<bin> <args> timed out after <ms>ms"`, `name` set, `bin`/`args`/`timeoutMs` retained
  for callers. Args joined with spaces — display-only, so no quoting concern. Correct.
- **`isCliTimeout(err)`**: `err instanceof Error && err.timedOut === true`. The brand check is
  what makes a value from another module instance (two copies of the package, bundling) still
  recognizable; anything non-Error, plain Errors, and primitives answer `false`. The type
  predicate (`err is CliTimeoutError`) is technically satisfiable by a foreign branded error that
  lacks `bin`/`args` — every in-repo producer is the class, so fine. Correct.
- **`cliRunner(opts)`**: builds the runner. Per call: resolve budget, `execFile` with `cwd`,
  `timeout`, and `maxBuffer` only when configured (so Node's default applies otherwise — 1MiB,
  which is why `project.ts` raises it for `git ls-files`). Callback: success → stdout;
  `killed === true && code !== 'ENOBUFS'` → `CliTimeoutError` (see classification analysis —
  correct on the real error shapes, stale comment); otherwise `preferStderr` ? trimmed stderr or
  fallback message : the raw error. The promise settles exactly once (single callback). No
  `signal`/abort support — nothing in the repo needs one. Correct.

## Bugs found

None found. (The `ENOBUFS` comment and its dead `code !== 'ENOBUFS'` clause misdescribe Node's
actual maxBuffer error — `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`, no `killed` flag, probe-verified —
but the classification behaves correctly for every reachable error shape, so this is a
documentation inaccuracy rather than a defect.)
