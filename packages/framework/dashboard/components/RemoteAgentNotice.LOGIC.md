The agent view's [1] status banner for an agent [2] relayed [3] to a device [4]: "Running on <device>. Its worktree, diff, and pull request live on the device; the browser preview is not available for remote runs yet." Everything else about such an agent — its live events, diff, checkout, handoff, push and pull request — relays back through the local daemon and renders as for a local agent; the browser preview is the one thing still local-only, which is all the banner flags. Without a device label it renders nothing, so the agent view can always include it.

## Glossary

[1] agent view: one agent's page.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[4] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
