The Devices section of the settings page: the roster of other machines running The Framework that this dashboard can run an agent on — listing them, adding one, removing one, and showing whether each is reachable.

## Business logic — TL;DR

- **Managing the roster is configuration, picking a target is not** - which devices exist is settled here, once; which device an agent runs on stays a per-agent choice made on the launcher, which keeps listing whatever is on this roster.
- **Devices live in this browser only** - each device is reached with its own token, so the roster is kept by the browser and never reaches the daemon. The section states this plainly, because a settings row is otherwise assumed to follow the user to their next browser.
- **Each device shows its name, its URL, and its reachability** - Online, Offline, or "Checking…" while the first probe is still out.
- **Removing a device un-targets it** - a device that was picked as the next agent's run target stops being the target the moment it is removed, so no agent can point at a machine no longer on the roster.
- **Empty roster tells the user where to get a URL** - the message points at the address the other machine prints when it starts.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
