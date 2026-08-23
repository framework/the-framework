What the tests cover: how the browser preview recovers when its stream cannot be reached.

- A stream that fails to load replaces the preview with the "not reachable" message and a Retry control; Retry brings the stream back, requesting it afresh rather than replaying the failed attempt.
- A retry that fails again is treated as its own failure and can be retried once more.
- A failure on one agent's preview is not inherited by the next agent shown in the same panel.
- Coming back to an agent whose preview failed earlier tries again, since its stream may be up by now.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
