# Bug analysis: packages/framework/src/e2e/fake-agent-bin.ts

## Business logic (high-level)

The executable the E2E harness hands `createProjectRuntime` as `binPath`. The daemon spawns a
session as `node <binPath> --agent <specPath>` (`daemon-runtime.ts` L124), so this file is a thin
shim in front of the *real* CLI: it flips `FRAMEWORK_FAKE=1` on its own process and then calls
`runCli(args)` with the argv it was given. The consequence is that the spawned child executes the
complete production session lifecycle — worktree cwd, run store, `events.jsonl`, control watcher,
gates, teardown — with only the coding agent itself replaced by `FakeDriver`. That is the whole
point: the stories exercise the framework, not a mock of it.

Two responsibilities beyond forwarding:

1. **`FRAMEWORK_FAKE` is set on the process, not baked into the spec.** Correct, and load-bearing:
   `cli.ts` L331 reads `env['FRAMEWORK_FAKE'] === '1'` when resolving options, so the fakeness is a
   property of *this* process rather than something the dashboard asked for — which is exactly what
   keeps the spec the stories assert on identical to a production spec.
2. **Spec recording.** When `$FRAMEWORK_E2E_ARGV_FILE` is set, the spec file's contents are appended
   as one JSON line. The spawn is detached, so this is the only place a story can observe what the
   dashboard actually sent to the child. The whitespace collapse (`/\s*\n\s*/g` → `''`) makes a
   pretty-printed spec one line; that is safe for JSON because a literal newline can never occur
   inside a JSON string (it must be escaped as `\n`, two characters), so only formatting is removed.

**Ordering.** The recording happens *before* `FRAMEWORK_FAKE` is set and before `runCli` runs, so a
spec is on disk by the time the child emits its first event. Every story that reads
`spawnedSpecs()` does so after waiting for an event from that child, so the read never races the
write.

**Failure handling.** The recording is wrapped in a bare `try/catch` with an explicit "diagnostics,
never a reason to fail the agent" comment — right call: a missing/unreadable spec path must not
change the lifecycle under test. `runCli`'s rejection is caught and turned into `exitCode = 1` after
logging, so an unhandled rejection can't take the child down silently.

**Reachable edge cases.**

- `--agent` absent → `indexOf` returns `-1` → `args[0]` is read as the spec path → `readFileSync`
  throws → swallowed. No spawn in this codebase omits `--agent` (verified: `daemon-runtime.ts` L124
  and `cli.ts` L1412 both pass it as two separate argv entries, never `--agent=<path>`), so the
  fallback path is unreachable and harmless when reached.
- `--agent` last with no value → `specPath` is `undefined` → `readFileSync(undefined)` throws →
  swallowed.
- Two children spawned at once (the "two sessions run concurrently" story) both `appendFileSync` to
  the same file. Each opens with `O_APPEND`, and a spec is well under a page, so in practice each
  line lands whole; a spec large enough to be split across `write()` calls could in theory interleave
  and produce an unparseable line. Not filed: no story produces a spec anywhere near that size, and
  `spawnedSpecs()` would fail loudly rather than silently if it ever happened.
- `process.exitCode` rather than `process.exit()`: deliberate, and matches the foreground-only CLI
  decision — the child exits when its own work releases the loop, so teardown is never truncated.

## Functions (low-level)

This module is top-level statements only; there are no functions to analyze individually.

- **argv slice + `argvFile` read (L18-19)** — `process.argv.slice(2)` drops `node` and the script
  path, which is what `runCli` expects (`cli.ts` L663 takes the same shape). Verdict: correct.
- **Recording block (L20-27)** — analyzed above. Verdict: correct.
- **`process.env.FRAMEWORK_FAKE = '1'` (L29)** — set before `runCli`, read during option resolution
  inside it. Verdict: correct.
- **`runCli(args).then(…).catch(…)` (L30-37)** — both settlement paths set `process.exitCode`; the
  rejection path prints the error first, so a story failure is diagnosable from the child's stderr.
  Verdict: correct.

## Bugs found

None found.
