Surfaces — watch and control the same autopilot run from a terminal, an in-page UI, or a detached background process, all fed by the engines' one progress-event stream.

## TLDR

- The terminal surface prints each event inline as a readable line while the run blocks.
- The in-page and background surfaces share a replayable stream: watchers join late, replay from any point, and follow live; a launched run hands back a handle exposing state, events, and the final result.
- Surfaces only consume events — they never know how the engine behind the run is built, and they carry any engine's event and result types, so supervisor and bootstrap runs are watched the same way.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
