# Bug analysis: packages/framework/dashboard/components/FilePreview.test.tsx

## Business logic (high-level)

Pins exactly what `FilePreview.test.SPEC.md` lists: laziness (no read while the hover card is
closed), the read target (agent worktree with `agentId`, project checkout without), diff vs
contents selection by `changed` (and that only the one needed RPC fires), and the edge renders
delegated through DiffView/ContentView: null result → "No change to show."/"Nothing to show.",
binary → "Binary file, nothing to show.", truncated → "Cut here. The rest is in the worktree.",
empty file → "Empty file.", failed read → stays on "Reading the diff…".

Verification that the tests test what they claim:

- Laziness test renders `FilePreviewHover` and asserts `onFileDiff` was never called — valid
  because a closed Base UI PreviewCard truly does not mount its popup; if that ever regressed the
  mounted `FilePreviewCard` would fetch synchronously in its first effect and the (synchronous)
  assertion would still pass only if the effect hadn't flushed — React Testing Library's `render`
  flushes effects via `act`, so a regression would fire the mock and fail the test. Falsifiable.
- Every async assertion is inside an awaited `waitFor`; no floating promises.
- The failed-read test asserts the loading message persists after the rejected call — the
  meaningful half ("not an unhandled rejection") is enforced by Vitest failing the run on unhandled
  rejections, so the pair together pins the catch-and-keep behaviour.
- Mocks are module-level `vi.fn`s captured before the dynamic `await import`, reset in
  `beforeEach` (`mockClear` + fresh `mockResolvedValue`), `cleanup` in `afterEach` stops the 5s
  poll timers via unmount. No cross-test leakage.
- The "only one read" assertions (`onFileDiff` not called on the contents path and vice versa)
  genuinely pin the `changed` branch.

Minor observation (not a bug): `getByText('1')`/`getByText('2')` for line numbers could collide
with other single-digit text if ContentView's output changed, but with the fixed two-line fixture
they are unambiguous today.

## Functions (low-level)

- `onFileDiff`/`onFileContent` mocks + `vi.mock('../rpc/reads.js')`: hoisted correctly (plain
  consts defined before `vi.mock` works because `vi.mock` is hoisted above them by vitest's
  transform only when using `vi.hoisted`; here the mock factory closes over consts declared in the
  same module *before* the dynamic import — with `vi.mock` hoisting, the factory runs lazily at
  first import, by which time the consts exist. Correct pattern.)
- `DIFF` fixture: a well-formed unified diff with counts matching the patch (+1/−1, and the test
  asserts the U+2212 minus DiffStat renders). Correct.
- Individual tests: each arranges one mock shape and asserts one rendered outcome; no test can
  vacuously pass (each asserted string appears only in the targeted branch).

## Bugs found

None found.
