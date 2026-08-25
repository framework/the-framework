# Bug analysis: packages/framework/src/agent-spec.test.ts

## Business logic (high-level)

Nine `node:test` cases over the real filesystem (no mocks): every case builds its own `mkdtemp`
directory under the OS temp dir, so the suite is safe to run concurrently with itself and leaves
nothing behind — the four cases that do not `rm` in a `finally` are exactly the ones whose
directories `readAgentSpec`/`removeAgentSpec` are supposed to delete, so a leak there would be the
bug under test rather than test debris.

What the suite pins, against `agent-spec.SPEC.md`:

- **Round-trip fidelity** (`L16`, `L21`): every field survives, an explicitly chosen option arrives
  chosen, and an option left unsaid arrives unsaid (so the repo's `the-framework.yml` still gets to
  decide it). The second half matters more than it looks: `assert.equal(silent.options.handoff,
  undefined)` is what would catch a mapper that "helpfully" defaulted an option into the spec.
- **Consumption** (`L31`): asserts the token round-trips *and* that both the file and its directory
  are gone afterwards. Uses `stat(...).then(() => true, () => false)` rather than an existence
  helper, which correctly treats any stat failure as "gone" — slightly broad (EACCES would also
  read as gone) but not a false-pass risk in a temp dir the test just made.
- **Cleanup boundaries** (`L41`, `L56`): the two negative branches of `removeAgentSpec`'s
  conjunction. `L41` (`my-specs-*`) kills the prefix half; `L56` (`framework-session-mine` inside a
  `not-the-spec-home-*` directory) kills the home half, and additionally asserts a sibling file
  (`keep.txt`) survives — so it detects an over-broad recursive delete rather than merely the
  directory's continued existence. Together they are a genuine test of the conjunction: dropping
  either half of the `&&` in the source fails one of them. `L56` depends on
  `FRAMEWORK_SESSION_SPEC_DIR` being unset in the test process (it is — only
  `daemon-workspace.test.ts` sets it, and only for a child), and would still pass if it were set to
  anything other than that test's own throwaway home, so this is not a hidden coupling.
- **Spawner-side cleanup** (`L74`): `removeAgentSpec` on a spec the child never read removes the
  directory too.
- **Refusal** (`L80`): three shapes — unparseable content, a spec missing `kind`/`cwd`, and a path
  that does not exist. Only the middle one asserts the message (`/not a session spec/`); the other
  two use a bare `assert.rejects`, which passes on *any* rejection. That is defensible for the
  ENOENT case, and it is the honest state of affairs for the "not json" case: the source really
  does reject with a raw `SyntaxError` there rather than the path-naming message the SPEC describes,
  so a stricter matcher would fail. Note this test also implicitly depends on the source deleting
  the file it just refused — it rewrites `path` at `L86` before the second case, which works
  either way, so the test neither pins nor forbids that behaviour.
  It also depends on `mkdtemp(join(tmpdir(),'framework-spec-'))` **not** matching
  `SPEC_DIR_PREFIX` (`framework-session-`) — true, and if it did match, the first `readAgentSpec`
  would take the whole directory and the following `writeFile` would fail with ENOENT rather than
  silently pass. A loud failure, so the naming coincidence is not a trap.
- **Defaulted options** (`L94`): a whole-object `deepEqual`, so it pins both the default `{}` and
  that nothing extra is invented.
- **Privacy / uniqueness / readability** (`L105`): two writes into one configured home produce
  different paths under that home, and the file is pretty-printed JSON starting with `"prompt"`.
  The regex `/^\{\n {2}"prompt"/` pins the exact `JSON.stringify(..., null, 2)` shape *and* key
  order (insertion order of the `AgentSpec` literal) — tight, but it is a real property the SPEC
  asks for ("readable text, so an agent that dies on startup can be diagnosed from it").

Every asynchronous assertion is awaited, including both `assert.rejects` calls; there is no test
that passes by not running. No fake timers, no shared mutable module state between cases.

Coverage gaps (not defects): nothing asserts the mode of the spec file or its directory, even
though the token's confidentiality rests on the 0700 `mkdtemp` directory; nothing covers
`writeAgentSpec` with `FRAMEWORK_SESSION_SPEC_DIR` pointing at a missing directory; and nothing
covers `continueAgent`/`agentId` being *absent* (the shared `SPEC` fixture always sets `agentId`).

## Functions (low-level)

### `SPEC` fixture (`L8`)

A complete spec including `options` with three fields, shared read-only by most tests. Never
mutated, so the sharing is safe.

### `test('a spec round-trips through the file, values intact')` (`L16`)

`deepEqual` against the fixture — passes only because the fixture already carries an `options`
object (the `?? {}` default is exercised separately at `L94`). Verdict: correct.

### `test('an explicit value survives, and so does saying nothing')` (`L21`)

Verdict: correct.

### `test('reading a spec consumes it: a device token does not outlive the session')` (`L31`)

Asserts payload, file removal and directory removal, each with a message. Verdict: correct.

### `test('a hand-written spec loses only the file, never the directory the user keeps it in')` (`L41`)

`finally` cleans the user directory. Verdict: correct.

### `test("a user's own directory named like ours is not ownership…")` (`L56`)

The strongest of the cleanup tests, because of the `keep.txt` survivor check. Verdict: correct.

### `test('a spec whose child never ran is removed by the spawner, directory and all')` (`L74`)

Verdict: correct.

### `test('a file that is not a spec is refused rather than half-run')` (`L80`)

Three refusals, one message-matched. Verdict: correct (see the bare-`rejects` note above).

### `test('a spec with no options reads as one with empty options, never undefined')` (`L94`)

Verdict: correct.

### `test('specs are written somewhere private, one directory each')` (`L105`)

`assert.notEqual(first, second)` is guaranteed by `mkdtemp` and so is a weak assertion, but the
`startsWith(dir)` and formatting assertions are real. Verdict: correct.

## Bugs found

None found.
