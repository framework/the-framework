# Bug analysis: packages/framework/dashboard/components/FilePreview.tsx

## Business logic (high-level)

Hover-card file preview for the file tree (SPEC `FilePreview.SPEC.md`): pointing at a file shows a
card with its diff (`changed`, #816) or its contents (#828), read from the selected agent's
worktree (`agentId`), falling back to the project checkout when no agent is passed. Laziness is
structural: Base UI's `PreviewCard` does not mount its popup while closed, and the read lives in
`FilePreviewCard` (inside the popup), so nothing is fetched for files never pointed at — no
open-state bookkeeping needed. The read is polled every 5s so a file being edited under the
pointer keeps up. Loading vs. empty are distinct states (`loaded` from `usePolled`).

Edge cases / failure modes checked:

- Rejected reads: `usePolled`/`useAsyncValue` catches rejections and keeps the last value; `loaded`
  stays false until a first success, so a failing daemon leaves the card on "Reading…" — the
  test-pinned behaviour, no unhandled rejection.
- Prop changes while open (`changed` flipping, agent switch): all four inputs are in the dep list,
  which retires the in-flight read (live token) and resets `loaded`, so no cross-target bleed or
  late write-back.
- `agentId ?? undefined` normalises `null` to the "project checkout" arm of the RPC. Correct.
- Unmount cancels the interval and invalidates the token (in the hook). No leak.
- Binary/truncated/empty rendering is delegated to `DiffView`/`ContentView` (out of batch; the test
  file pins their messages through this card).

## Functions (low-level)

- `isDiff(value)`: discriminates by `'patch' in value`. `FileDiff` always carries `patch` (even
  binary: `''`), `FileContent` never does — sound for the two shapes on this channel. Correct.
- `FilePreviewCard({projectId, agentId, path, changed=true})`: picks `onFileDiff` vs
  `onFileContent` by `changed`, polls at 5s keyed on `[projectId, agentId, path, changed]`; header
  shows the path and, for a diff, the +/− stat; body renders Reading… / No change ("Nothing") /
  DiffView / ContentView. States are mutually exclusive and ordered loading-first per SPEC.
  Correct.
- `FilePreviewHover({...children})`: wraps children in `PreviewCard.Trigger` (open delay 350ms,
  close delay 150ms — the SPEC's "short pause" and travel-into-card affordances are Base UI
  behaviour), popup portal on the left, `FilePreviewCard` inside. The L82 comment claims tree rows
  are `pointer-events-none`; a grep shows FileTree's rows are plain buttons with normal pointer
  events, so the comment (and the `pointer-events-auto` on the trigger) is stale — harmless
  (`pointer-events-auto` is a no-op there), comment drift only, not a behavioural bug. Correct.

## Bugs found

None found.
