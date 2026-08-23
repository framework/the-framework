The dashboard's "connected to" badge: which daemon the user is currently looking at — this machine's own daemon, or a device they hopped to.

## Business logic — TL;DR

- **The browser's address is the connection** - the dashboard only ever talks to the daemon serving it, so a loopback address means this machine's own daemon (labelled "Local") and any other address means one of the saved devices, labelled with that device's name.
- **A device never looks like Local** - the badge for a device is drawn in the accent colour and always visible, while the Local badge is muted and hidden on narrow screens; its tooltip spells out that the agent runs on that device's hardware.
- **Online dot** - a coloured dot shows whether the daemon is reachable: always on for this machine, and following the saved devices' reachability poll for a device.
- **Remembering the way home** - on load the dashboard records the loopback address it was launched from, so the "Local" entry can later return the user to the right port; a prompt draft carried over in the address is taken out of the address at the same moment, before the user ever sees it there.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
