# Bug analysis: packages/framework/src/pick-directory.test.ts

## Business logic (high-level)

Four tests, one per branch of `pickDirectory`, all driven through the injected `DialogRunner` so no
real dialog is ever opened (the reason the seam exists). They map one-to-one onto
`pick-directory.test.SPEC.md`'s four bullets, and each one can genuinely fail:

- **Picked path.** Feeds `'/Users/dev/my-repo/\n'` - both the trailing slash osascript adds *and*
  the trailing newline - and asserts the exact result object. A dropped `trim()` or a dropped
  slash-strip both fail here. It additionally asserts the *command* (`osascript`) and that the
  script argument contains `choose folder`, which pins "the dialog is the OS's own" rather than
  some home-grown prompt. That second half is the only place the spawned command line is checked.
- **Dismissal.** Exit 1 plus a realistic `execution error: User canceled. (-128)` stderr must map
  to `{ ok: true, path: null }`. Fails if the -128 translation is removed, which is the whole point
  of the branch.
- **Dialog failure.** Exit 1 with unrelated stderr must map to `{ ok: false, error: <stderr> }`,
  trimmed. Distinguishes it from the dismissal case using stderr content alone, exactly as the
  implementation does.
- **Unwired platform.** The runner *throws* if called, so the assertion "nothing is attempted" is
  enforced structurally rather than by inspecting a call log. If `pickDirectory` ever ran the
  dialog before the platform check, the thrown error would reject the awaited promise and fail the
  test. This is the sharpest test of the four.

No shared state between tests, no timers, no fs, nothing to leak. `strict` assert means
`deepEqual` is `deepStrictEqual`, so `{ ok: true, path: null }` cannot pass against
`{ ok: true, path: undefined }`.

## Functions (low-level)

### `runner(result, calls?)`

Builds a `DialogRunner` that records `[command, ...args]` into `calls` (when given) and resolves
with the supplied `code` plus defaulted-to-empty `stdout`/`stderr`. Flattening the command and args
into a single array is why the assertions index `[0]` for the binary and `[2]` for the script.
Always resolves, matching the real runner's contract (which never rejects). Correct.

### The four test bodies

All `async` and all `await` the call under test, so no assertion can run after the test ends. The
optional-chaining reads (`calls[0]?.[0]`, `calls[0]?.[2] ?? ''`) turn a "never called" bug into a
readable assertion failure instead of a TypeError - a deliberate and correct choice, and not a
weakening, because the expected values are non-empty. The `picked as { error: string }` cast in the
last test comes after `assert.equal(picked.ok, false)`, so it cannot read a field off the success
variant. Verdict: all correct.

Coverage gaps (not bugs): no test pins the root-folder case (`'/'` must stay `'/'` rather than
becoming an error), and none pins exit-0-with-empty-stdout, both of which are real branches in the
implementation.

## Bugs found

None found.
