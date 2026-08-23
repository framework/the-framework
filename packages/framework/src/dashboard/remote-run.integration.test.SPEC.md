What the tests cover: the end-to-end path of running an agent on another device, with two real daemons talking over the network. Launching with a device selected creates the agent on that device and returns the device's own agent identity rather than a locally allocated one; the run target is stripped before forwarding so the agent cannot be relayed onward; the agent runs in the device's own checkout; and the launching daemon allocates no worktree and spawns nothing of its own, so its own one-agent-at-a-time guard is untouched.

The launching daemon keeps a local row for the relayed agent so a dashboard reload re-opens it: marked as remote, carrying the device's agent identity, the device's label and what the user asked for, and reading as running until the device's event stream ends, at which point it settles to the ending the device reported.

The device's events stream back through the launching daemon in order, and run-scoped actions reach the device over the relay: a read and a push both execute against the device's own checkout and return their result across the link.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
