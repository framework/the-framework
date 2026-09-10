Keeps the saved devices' [1] online or offline state current, so the device list and its status dots say which other machines can be started on right now.

## Context

**User story**: the user has saved another machine's daemon as a device and picks it when starting an agent [2]. The list shows a dot per device: online when that machine's daemon answered, offline when it did not, and neutral while the first check is still out — a device that has not been checked yet must not read as down.

**Business logic story**: a device's token is a secret this browser holds, not the daemon (the rules are in `profiles.ts`). So the browser hands the local daemon each device's address and token for the check, and the daemon does the reaching out.

## Glossary

[1] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Checked every 10 seconds** - every saved device that has a token is checked when the list is first shown and every 10 seconds after that, all of them in one request.
- **Only devices with a token are checked** - a device saved without one is never contacted and stays unknown.
- **Unknown is not offline** - a device with no answer yet is absent from the result and drawn neutral, so a page that has just opened never claims a machine is down.
- **A re-pasted token is checked again immediately** - a device is identified by its address, so replacing its token does not change its identity; the check restarts anyway, or the dot would keep reporting offline from the dead token.
- **Display only** - the state is shown, never used to hold a control back; the check is cheap and nothing waits on it.
