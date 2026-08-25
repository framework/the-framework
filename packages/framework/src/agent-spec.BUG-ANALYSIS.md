# Bug analysis: packages/framework/src/agent-spec.ts

## Business logic (high-level)

The daemon→agent handoff format (D4). Everything about a spawned agent (prompt, kind, checkout,
agent id, continue-flag, and the whole `StartAgentOptions` blob) travels as one JSON file; the
daemon writes it, spawns `node <bin> --agent <specPath>` detached with stdio closed
(`daemon-runtime.ts:124`), and the child consumes it. A file rather than a pipe precisely because
the child is detached — there is no inherited channel, and a path survives the spawn without either
side blocking.

Three invariants, from `agent-spec.SPEC.md`:

1. **One-shot consumption.** The spec holds the user's whole prompt and can hold a device token
   (`options.remote.token`), so it must not remain readable after the agent starts. `readAgentSpec`
   reads and removes in one step; the daemon also calls `removeAgentSpec` for a spawn whose child
   never read it. Both sides may always try — removal is idempotent (`force: true`, and the
   directory branch is `recursive: true, force: true`).
2. **Cleanup removes only what this module made.** `writeAgentSpec` gives each spec its own
   `mkdtemp` directory (otherwise every agent leaks an empty directory), so cleanup wants to remove
   the directory whole; the guard is *prefix on the directory name* **and** *the directory sits
   directly in the configured spec home*. Both halves are needed: the prefix alone would let a
   user's `~/framework-session-x/` be deleted, and the home alone would let any directory the user
   happens to keep in the temp dir be deleted. The code implements exactly this conjunction, and
   the two negative cases are each covered by a test.
3. **A file that is not a spec is refused**, with a message naming the path — `prompt` and `cwd`
   must be strings, `kind` must be truthy, and an empty prompt is legal because research has its
   own default.

Secrecy: `writeFile` uses the default 0644 mode, but the containing `mkdtemp` directory is 0700, so
the prompt and any device token are not world-readable in the window before consumption. This only
holds because every spec goes in its own fresh directory — which is also invariant 2's motivation,
so the two reinforce each other.

Concurrency: `mkdtemp` is the atomic uniqueness primitive, so two starts in the same millisecond
cannot collide (pinned by the test at `agent-spec.test.ts:105`). There is no locking anywhere and
none is needed: each spec is written once, read once, by two processes with a happens-before edge
(spawn) between them. A double `removeAgentSpec` (child consumed it, then the daemon's failure path
tries too) is a no-op by design.

Env plumbing: `SPEC_DIR_ENV` is read on both the write and the remove side, defaulted per call
rather than captured at module load, so a test can point one call at its own home. In production
neither the daemon nor the child sets it and both land on `tmpdir()`. Note the coupling this
implies: the *child* must see the same value as the *daemon* for the directory branch of
`removeAgentSpec` to fire. The spawn inherits the daemon's env (`daemon-runtime.ts:124`), so this
holds; if a future spawn filtered the env, consumed specs would start leaving empty directories
behind (a leak, not corruption). Worth knowing; not a present defect.

Validation is deliberately shallow (`kind` is only checked for truthiness, `options` is not
type-checked). The producer is the daemon's own `StartAgentOptions`, so a malformed `kind` cannot
arise from the supported path, and a bogus `options` value degrades to "no options" downstream
rather than crashing. Two shapes do escape the intended error, both requiring a hand-written file:
a body that is not JSON rejects with `JSON.parse`'s `SyntaxError`, which does *not* name the path
the SPEC asks for; and a body of literal `null` rejects with a `TypeError` on `spec.prompt` for the
same reason. Contrived enough that I do not count them as bugs, but the message-naming-the-path
promise is only kept for the missing-field case.

## Functions (low-level)

### `interface AgentSpec` (`L20`)

Data shape only. `agentId` and `continueAgent` optional; `options` required (and defaulted on read).

### `writeAgentSpec(spec, env = process.env): Promise<string>` (`L48`)

`mkdtemp(join(home, PREFIX))` then `writeFile(dir/session.json, pretty JSON + '\n')`.

- *Missing spec home*: `mkdtemp` rejects with ENOENT if `FRAMEWORK_SESSION_SPEC_DIR` names a
  directory that does not exist. Only tests set that var, and they `mkdtemp` it first. Acceptable.
- *Pretty-printed*: deliberate (a spawned agent that dies is diagnosed from the file), and pinned by
  a regex test on the exact formatting.
- *Non-serializable values*: `StartAgentOptions` is plain JSON data; `undefined`-valued keys drop
  out of `JSON.stringify`, which is exactly the "saying nothing stays nothing" behaviour the
  handoff wants.
- *Disk full / write failure*: rejects to the caller, which is the daemon's start path; the empty
  mkdtemp directory would be left behind. One empty directory on a failed write is negligible.

Verdict: correct.

### `removeAgentSpec(path, env = process.env): Promise<void>` (`L66`)

`basename(dirname(path)).startsWith(SPEC_DIR_PREFIX) && resolve(dirname(dirname(path))) === resolve(home)`.

- *The framework's own spec*: both halves true → the directory goes whole.
- *Hand-written spec in the user's own directory*: prefix fails → only the file.
- *User's own `framework-session-*` directory outside the home*: prefix passes, home fails → only
  the file. Both negative cases are tested.
- *Path normalisation*: `resolve` is applied to both sides of the home comparison, so trailing
  slashes and `.` segments in `FRAMEWORK_SESSION_SPEC_DIR` do not defeat the check. It is not
  `realpath`, so a symlinked spec home would compare unequal and degrade to file-only removal —
  fail-safe (it under-deletes, never over-deletes), and both sides derive from the same env string
  in practice.
- *`path` naming a directory*: falls to the else branch, `rm` without `recursive` rejects EISDIR,
  swallowed by the `.catch`. Harmless.
- *Errors*: both branches swallow. Right for a best-effort cleanup that both sides race to perform;
  the alternative (an unhandled rejection on the daemon's failure path) would be worse.

Verdict: correct.

### `readAgentSpec(path, env = process.env): Promise<AgentSpec>` (`L81`)

Read → remove → parse → validate → return with `options` defaulted to `{}`.

- *Missing file*: `readFile` rejects ENOENT before anything is removed. Correct (tested).
- *Ordering*: removal happens before parse/validate, so the file is destroyed even when it turns
  out not to be a spec. Deliberate for the token case; questionable for the "wrong path" case — see
  bug 1.
- *Empty prompt*: allowed (`typeof '' === 'string'`), per SPEC.
- *`options` absent*: defaulted to `{}` so callers can read `spec.options.x` unguarded (tested).
- *Extra keys in the file*: passed through by the spread. Harmless — the consumer reads named
  fields.

Verdict: suspicious-but-unproven (the destroy-before-validate ordering).

## Bugs found

1. `L82-87` (`readAgentSpec`): the file is deleted **before** it is validated, so pointing `--agent`
   at a path that is not a spec destroys that file and then fails. Scenario: `framework --agent
   ./notes.json` (a mistyped path, or a hand-written spec with a typo'd field — a case
   `agent-spec.SPEC.md` explicitly contemplates in "A user hands the framework a spec file they
   wrote themselves"); `readAgentSpec` reads it, `removeAgentSpec` deletes it, and only then does
   validation reject with "is not a session spec" — the user's file is gone. The SPEC's refusal
   story says only "the agent refuses to start with a message naming the offending path"; nothing
   says a refused file is consumed, and the neighbouring "Cleanup only removes what the framework
   itself created" story shows the module is meant to be conservative about files it did not
   create. Mitigating (hence low confidence): `cli.SPEC.md:16` calls `--agent` "for the daemon, not
   for a human", and the daemon only ever passes specs it just wrote. Severity: minor. Fix sketch:
   parse and validate first, then `await removeAgentSpec(path, env)` on the success path — the
   one-shot/token guarantee is unchanged, and a spec that fails validation is still cleaned up by
   the daemon's own `removeAgentSpec` on the failed start.
