Whether each saved device is currently reachable, which is what the dashboard's device status dots read. Every ten seconds each saved device is pinged — a cheap check, capped at three seconds per device, with no agent involved.

## Business logic — TL;DR

- **The browser supplies the credentials, the daemon does the ping** - a device's token is a per-browser secret the daemon does not hold, so the browser hands over each device's URL and token and the daemon performs the reachability check with them.
- **Only devices with a token are checked** - a saved device with no token is never pinged.
- **Unknown is not offline** - a device whose first check has not come back yet is simply absent from the answer, so it is drawn neutral rather than accused of being down. The prerendered page has no daemon to ask, so it starts with everything unknown and fills in once the browser takes over.
- **A re-pasted token takes effect immediately** - checking restarts whenever the set of saved devices changes *or* any device's token changes. A device is identified by its URL, so re-pasting a token refreshes it without changing the device's identity; without watching the token, the dashboard would keep pinging with the dead one and keep reporting the device offline.
- **Display only** - no control is gated on this status; it drives the dots and nothing else.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
