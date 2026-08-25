# Bug analysis: packages/framework/src/preflight.ts

## Business logic (high-level)

Start-time prerequisite checks for a live agent (#1326, from the external-user report #1323). The
product logic it protects: the daemon spends a branch and a worktree per Start, so a driver CLI
that is missing or logged out must be caught *before* that spend, with the exact command that
fixes it - not discovered as six projects' worth of sessions dying with empty logs.

Four pieces of business logic, all matching `preflight.SPEC.md`:

1. **Probe the picked driver, not the default.** `DRIVER_SPECS[driver]` supplies the binary, the
   install hint, the auth args, the auth *parser* and the login command, so a codex session fails
   pointing at the codex install. The per-driver knowledge lives in `driver-cli.ts`; this module
   only sequences it.
2. **Installed is not usable.** After a successful `--version`, the CLI is asked whether it is
   logged in, in that driver's own dialect. Tri-state on purpose: `true` -> a passing check,
   `false` -> a *failure* with the login command, `undefined` ("would not say", e.g. an old CLI
   printing usage) -> no check at all. Only a definite no blocks. This is the module's most
   important design decision and it is implemented exactly as specced.
3. **Failures block, warnings travel.** `ok` is `checks.every(c => c.ok)` and every warning is
   pushed with `ok: true, warn: true`, so warnings can never flip the verdict.
   `preflightProblems` filters on `!ok`, so warnings are equally absent from the user-facing fix
   list; the RPC layer (`dashboard-rpc/projects.ts#onDriverReady`) picks them up separately via
   `c.warn`. The two halves are consistent - a warning is neither a blocker nor lost.
4. **gh and root are advisory.** `publish` adds the `gh` probes only when a PR/merge rung is armed
   (the daemon's own `checkAgentReady` never passes it, so a plain Start pays nothing for it);
   root is warned about because `sudo` moves `HOME` and the CLI then reads root's credentials.

Ordering/lifecycle: strictly sequential awaits, no shared state, no caching (the caching lives in
`daemon-runtime.ts`, which caches only *passes* and only briefly, so a login is picked up by the
very next Start). Nothing is spawned that is not awaited, so there are no stray child processes
beyond `execFile`'s own 10s timeout. Idempotent and side-effect-free apart from running the probed
binaries.

Trust boundary: `driver` is typed `DriverName`, and both production call sites
(`daemon-runtime.ts` L528, `dashboard-rpc/projects.ts` L93) launder it through `isDriverName`
first, so `DRIVER_SPECS[agent]` can never be `undefined` - verified, not assumed. `bin` is
injectable but only tests pass it, and it is never interpolated into a shell (execFile with an
argv array), so there is no injection surface even if it were caller-controlled.

## Functions (low-level)

### `defaultProbe(bin, args)`

Wraps `execFile` and **always resolves**: `{ ok: !err, output: stdout + stderr }`. Merging the
streams is deliberate and load-bearing - claude answers auth status on stdout, codex on stderr,
and a stdout-only read would turn "logged out" into "would not say". `timeout: 10_000` bounds a CLI
that blocks on an interactive prompt; the kill surfaces as `err`, i.e. `ok: false`, which for the
version probe reads as "not found" and for the auth probe as unknown - both safe directions. A
binary that does not exist gives `err.code === 'ENOENT'` and empty output, also `ok: false`.
Default `maxBuffer` (1 MiB) is far above any `--version` output. Verdict: correct.

### `runningAsRoot()`

`process.getuid?.() === 0`. Optional call because Windows has no `getuid`; `undefined === 0` is
false, so Windows is never root, as the SPEC states. Verdict: correct.

### `preflight(opts = {})`

Inputs all optional; output `{ ok, checks }`.

- `node` check is unconditional and carries `process.version`. Cannot fail, by design.
- Version probe: `cli.output.trim() || 'installed'` covers a CLI that exits 0 printing nothing.
  The failure detail names the *resolved* `bin` (so an overridden bin is named accurately) and the
  driver's own install hint.
- Auth probe runs only when `cli.ok`, so a missing binary produces exactly one line. The tri-state
  is compared with `=== false` / `=== true` rather than truthiness, which is what keeps `undefined`
  from falling into either branch.
- Publish block: `gh --version` first; on success, `gh auth status` decided **by exit code alone**
  (the comment says so explicitly) - which is right, because `gh auth status`'s human-readable text
  varies by version while its exit code does not. Both branches push `ok: true, warn: true`, so
  `result.ok` is untouched. A healthy `gh` pushes nothing, matching the SPEC. Note the gh probes
  run even when the driver CLI check already failed; that costs two extra spawns in an
  already-failing Start and produces additional advisory lines, which is harmless.
- Root block: `opts.sudoUser !== undefined ? opts.sudoUser : process.env.SUDO_USER` - written with
  an explicit `!== undefined` rather than `??` so a test can pass `sudoUser: undefined` and get the
  *unknown* wording instead of leaking the CI environment's real `SUDO_USER`. An empty-string
  `SUDO_USER` falls through to "your own user" via the truthiness check on the next line. Verdict:
  correct, and the subtlety is intentional.
- `ok: checks.every(c => c.ok)`.

Edge cases considered and handled: unknown driver (impossible - laundered by callers); probe
throwing (the injectable type promises resolution, and `defaultProbe` never rejects - an injected
probe that threw would reject `preflight`, but the only injectors are tests); concurrent calls (no
shared state).

Verdict: correct.

### `preflightProblems(result)`

`checks.filter(!ok).map(name: detail)`. Warnings excluded by construction since they carry
`ok: true`. Returns `[]` for a clean result, which the callers `.join('; ')` into an empty string -
but they only call it under `if (!result.ok)`, so the empty case is unreachable. Verdict: correct.

## Bugs found

None found.
