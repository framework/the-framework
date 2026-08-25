# Bug analysis: packages/framework/src/daemon.test.ts

## Business logic (high-level)

Pins the daemon lifecycle described by `daemon.test.SPEC.md`: the event tailer's three read behaviors (incremental pulls, torn-line buffering, same-length rewrite reset), the daemon coming up and freeing its port, worktree-per-agent starts on a git project vs the one-at-a-time guard on a non-git project, retiring a finished/failed agent (archive → record branch → push → remove checkout; nothing pushed when nothing new), steering via `control.jsonl`, the fork-bomb guard, and `registerHomeProject`/`isNestedWithin` (#647).

The suite runs real daemons on ephemeral ports (`port: 0`) against throwaway workspaces, with the registry pointed at a per-test `XDG_CONFIG_HOME` and a preflight stub (`agentReady`) so no real `claude` install is needed — exactly the injection `daemon-runtime` offers for this purpose. Agent children are stub CLIs handed the JSON spec via `--agent`, so what the daemon spawned is observable from files.

Do the tests verify what they claim?

- **`startDaemon` helper** — forwards a pre-bind settle (resolve or reject) into a `listening` rejection, so a daemon that fails to come up fails the test rather than hanging it. After `listening` resolves, the later `fail(...)` call from the settle handler is a no-op on an already-settled promise. Sound. In the `finally` blocks the tests abort but don't await `done`, so `rm(cwd)` can race the daemon's teardown — the rejection is pre-handled (`done.then(…, fail)`), so no unhandled rejection; worst case is teardown noise on an already-failing test. Acceptable.
- **EventTailer tests** — the same-length-rewrite test proves both lines are 35 bytes and sleeps 20ms so mtime advances past the seeding read; on Linux/ext4 (ms mtime granularity) this is reliable. All three assert exact cumulative sequences, so they'd catch replays and skips. Verify their claims.
- **`isProcessAlive`** — `2**31 - 1` is above any real pid (kernel max 4194304), so "dead pid" is honest.
- **Daemon up/down** — asserts `state.pid`, the URL shape, a 200 with `id="root"` (requires the built dashboard bundle; the suite's build step provides it), and that fetch *rejects* after shutdown (closed port → ECONNREFUSED). Verifies the claims.
- **Concurrent worktrees (#736)** — asserts both children ran, each in `worktreePath(cwd, agentId)` with repo content, on `tf-agent-<id>` branches, and HEAD untouched. Real git, realpath'd tmpdir for the macOS symlink gotcha. Verifies the claims.
- **Teardown (#737/E5)** — the stub writes a real `agent.json` with a test-controlled status and exits; the test polls `listAgents` for the archive (the #1179 point that archives are per-user, so no path stat), polls the worktree away, asserts the recorded branch and the remote ref for the `done` run, and for the `failed` run that committed nothing asserts branch + remote ref absent — after first polling the local branch away, since branch deletion is teardown's last act, before yanking the repo. Generous 12s ceilings. Verifies the claims, including the "failure goes the same way" rule.
- **Busy guard (non-git)** — the stub stays alive 600ms; the busy probe happens right after the spec lands (~hundreds of ms in), inside the alive window; the retry loop then waits out the exit. Mildly timing-dependent but with sane margins. Verifies the claim.
- **Kinds (#331/#353)** — asserts the exact spec JSON per kind, including the verbatim multi-line prompt and the empty research "what". Retry loops absorb the busy guard between sequential starts. Verifies.
- **Fork-bomb guard (#345)** — no `binPath`, so argv[1] is the test file; asserts refusal matches `/test entry/`. Verifies.
- **Steering (#344)** — must point `process.env.XDG_CONFIG_HOME` at the test registry because the RPC layer resolves projects from `process.env`, not the daemon's injected env (documented asymmetry); restores it in `finally`. Asserts both control entries verbatim. Verifies.
- **`isNestedWithin` / `registerHomeProject`** — the five path relations, the nested-skip, and the plain add, each against the real registry. Verify.

## Functions (low-level)

- **`agentReady`** — resolved `{ok:true, checks:[]}` preflight stub. Correct.
- **`startDaemon(cwd, opts)`** — see above. Correct.
- **`callRpc(url, name, args)`** — POSTs `/_rpc/<name>` with a same-origin `origin` header (needed by the CSRF guard) and unwraps `ret`; empty body → undefined. Correct for these tests.
- **`homeId` / `sendStart`** — `projectId(resolve(cwd))`, matching the daemon's own derivation. Correct.
- **`logEvent` / `line` / `sleep`** — trivial. Correct.
- **`activate(cwd)`** — writes the install ignore file, the activation marker (#1600). Correct.
- **`tmpWorkspace` / `configEnv`** — throwaway workspace + registry env; cleanup removes both together. Correct.
- Per-test bodies — covered above; all promises awaited, no assertion is vacuous (each `assert.deepEqual`/`match` compares real data), and every daemon is aborted in `finally` so a failing assertion cannot leak a bound port into later tests in the file.

## Bugs found

None found.
