The device side of the remote-agent relay: executes a forwarded call against this device's own home project, and only calls on a fixed allowlist.

## User Stories

- The user runs an agent on this machine (a saved remote device) while their dashboard runs on another — and still reads the agent's transcript, files, and git state from there.
- The user steers and publishes that remote agent from their dashboard — stop, answer, message, push, open a PR, merge — and each click executes here.

## Flows

- A forwarded call arrives naming the dashboard machine's project id, which means nothing here; it is discarded and replaced with the device's own home project, so a forwarded call can only ever address the device's home checkout — never another project registered on it.
- Each allowlisted name is the very RPC this device's own dashboard exposes, resolved through the same project registry, so a relayed click behaves exactly like a local one.
- The allowlist is exactly the agent-scoped read/steer/handoff surface; starting agents, previews, and anything that destroys history or checkouts stays off it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
