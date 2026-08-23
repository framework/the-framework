Health-checks the devices saved in the dashboard, so each one shows whether it is currently reachable.

The browser hands over each saved device's URL and token — devices are stored browser-side, not in the registry — and the daemon pings every one of them in parallel and answers with, per device, whether it responded. The token is used for the check only and never stored. Entries that are not a complete device are dropped rather than reported as unreachable.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
