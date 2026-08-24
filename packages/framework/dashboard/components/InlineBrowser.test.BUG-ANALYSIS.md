# Bug analysis: packages/framework/dashboard/components/InlineBrowser.test.tsx

## Business logic (high-level)

Pins the three rungs of the degrade ladder, exactly as `InlineBrowser.test.SPEC.md` describes:
live → the pane (`live-pane` stub) renders; live→dead under the reader → the captured still with
the overlay and no live pane; dead-with-no-still → only the one-liner, no img.

Verification that the tests test what they claim:

- The `BrowserPanel` mock hands back a still through `onFrame` in a `useEffect` — flushed by
  RTL's `act` inside `render`, so by the time the rerender flips `live={false}` the frame state
  is genuinely set; the still assertion (`src` contains `data:image/jpeg`) would fail if the
  component dropped or never captured the frame. Falsifiable.
- Rung 2 also asserts the live pane is *gone* (`queryByTestId` null) and rung 3 asserts the img
  is gone — each rung excludes the neighbouring rung's rendering, so the three tests jointly pin
  the ladder rather than just its happy strings.
- The mock is defined with an async factory importing React inside — correct for vi.mock
  hoisting; the real component is imported after via dynamic import.
- All assertions are synchronous after `render`/`rerender` (effects flushed by act); nothing
  async is left un-awaited. `cleanup` in `afterEach`.

Coverage note (not a bug): the box's 16:10 geometry named in test 1's title is not actually
asserted (only that the pane renders); geometry is styling, reasonable to leave unpinned.

## Functions (low-level)

- `vi.mock('./BrowserPanel.js', async factory)`: stub component calling `onFrame?.('data:...')`
  once per `onFrame` identity — mirrors the real contract closely enough (the real one ticks
  every 2s; one tick suffices for the ladder). Correct.
- The three tests: arrange/act/assert as described above. Correct.

## Bugs found

None found.
