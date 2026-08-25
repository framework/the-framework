# Bug analysis: packages/framework/src/pick-directory.ts

## Business logic (high-level)

The daemon-side folder picker behind the dashboard's "Add project" (#1150). A browser page cannot
learn the absolute path of a folder the user picks in it, so the daemon - which runs on the user's
own machine - opens the OS dialog and returns the path over the RPC.

Three outcomes, deliberately distinct (SPEC):

1. **Picked** - `{ ok: true, path }`, absolute, with the OS's trailing slash removed because the
   registry stores paths without one. Getting this wrong would register `/Users/dev/repo/` as a
   different project from `/Users/dev/repo`.
2. **Dismissed** - `{ ok: true, path: null }`. Cancelling is a normal user action, not a failure,
   so the dashboard must not show an error toast for it. osascript reports cancellation as a
   *failure* (exit 1, AppleScript error -128), so this translation is the one place the module
   reinterprets an OS error as success.
3. **Could not ask** - `{ ok: false, error }`, either an unwired platform (everything but macOS)
   or a dialog that failed to open, whose stderr is surfaced verbatim.

Lifecycle: one shot per call, no state, no cleanup. The only concurrency consideration is that two
concurrent calls would open two dialogs; nothing here serializes them, and nothing needs to - the
dashboard fires this from a button.

Security: the AppleScript is a fixed literal with no interpolation of any caller-controlled value,
so there is no command- or script-injection surface. The returned path is not validated as a git
repo here; the registry's own add path does that.

## Functions (low-level)

### `nodeDialogRunner` (module-private const, the default `DialogRunner`)

Wraps `execFile` in a promise that **always resolves** - failures come back as
`{ code, stdout, stderr }` rather than a rejection, which is what lets `pickDirectory` be written
as a straight-line decision on `code`. `error.code` from `execFile` is the numeric exit status for
a process that ran, but a string errno (`'ENOENT'`) when the binary is missing; the
`typeof … === 'number' ? … : 1` guard maps that to 1, which then falls through to the stderr
branch and reports `'the folder dialog could not be opened'` (stderr is empty in the ENOENT case).
Correct.

`String(stdout)`/`String(stderr)` guard against the Buffer form (only produced with
`encoding: 'buffer'`, which is not set) - harmless. No timeout is set, so the promise stays pending
for as long as the modal dialog is open; that is the intended semantic of a modal picker, not a
leak. Verdict: correct.

### `pickDirectory(platform = process.platform, run = nodeDialogRunner)`

- **Platform guard first.** Non-darwin returns before `run` is touched, so nothing is spawned on
  Linux/Windows (pinned by a test whose runner throws).
- **Exit 0 path.** `stdout.trim().replace(/(.)\/$/, '$1')`. The `(.)` is load-bearing: it makes the
  regex need at least one character *before* the final slash, so a picked root folder (`/`) keeps
  its slash instead of being reduced to the empty string, which would then be reported as "returned
  no path". Verified: `'/'` does not match, `'/a/'` -> `'/a'`. Only one trailing slash is stripped,
  which is exactly what `POSIX path of` produces.
  `trim()` also strips leading/trailing whitespace *inside* a folder name (a directory literally
  named `"repo "` loses nothing here - the trailing space sits before the slash and survives the
  replace - but one named `" repo"` at the end of the path is unaffected too, since the space is
  not at the string end). No realistic corruption.
- **Empty stdout on exit 0** is treated as a failure rather than as "dismissed", which is right:
  a cancel exits non-zero, so an empty successful run is genuinely anomalous.
- **Dismissal detection** is `result.stderr.includes('-128')`, a substring test rather than a match
  on the error-code position. It cannot be confused by the fixed script text (which contains no
  digits), and other AppleScript codes that embed the digits (`-1728`, `-1708`) do not contain the
  substring `-128`. A stderr echoing a *path* containing `-128` would be misread as a cancel, but
  osascript's failure output does not echo the chosen path (the failure happens before a path
  exists). Suspicious-but-unproven; not reported.
- **Fallback error** prefers stderr, falling back to a generic sentence when stderr is empty
  (the ENOENT case above), so the RPC never returns `{ ok: false, error: '' }`.

Verdict: correct.

## Bugs found

None found.
