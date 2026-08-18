The device side of the remote-agent relay: executes a forwarded call against this device's own home project, and only calls on a fixed allowlist.

## TLDR

- The caller's project id is discarded and replaced with the device's own home project, so a forwarded call can only ever address the device's home checkout — never another project registered on it.
- The allowlist is exactly the agent-scoped read/steer/handoff surface; starting agents, previews, and anything that destroys history or checkouts stays off it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
