The background surface: kick off an autopilot run without waiting for it, and get back a handle to check its state, replay or follow its events, and await its final result.

## TLDR

- The handle reports whether the run is still going, finished, or failed; its events are replayable from any point and streamable live — the same handle powers an in-page UI (forward the live stream) and a background process (poll state and events).
- It knows nothing about how the run is built: the caller hands over a start function, so any engine (supervisor, bootstrap) launches the same way with its own event and result types.
- A failed run is observed through the handle's result; it never surfaces as an unhandled crash.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
