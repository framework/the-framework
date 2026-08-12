The device side of the remote-session relay: executes a forwarded call against this device's own home project, and only calls on a fixed allowlist.

## TLDR

- The caller's project id is discarded and replaced with the device's own home project, so a forwarded call can only ever address the device's home checkout — never another project registered on it.
- The allowlist is exactly the session-scoped read/steer/handoff surface; starting sessions, previews, and anything that destroys history or checkouts stays off it.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
