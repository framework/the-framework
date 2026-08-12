The saved devices' online/offline dots, refreshed on a short interval.

## TLDR

- Device tokens are a per-browser secret the daemon never stores, so the browser hands over each device's address and token per check and the daemon does the ping.
- A device whose first check has not come back reads as unknown, not offline.
- A re-pasted token restarts the checks even though the device itself is unchanged — otherwise the dot would keep pinging with the dead token and read offline forever.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
