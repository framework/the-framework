The gear menu beside a composer: where the user picks where the next agent runs and which of the global options are on. One dropdown replaces what used to be a row of loose checkboxes; every row writes the user's preference straight through, and the menu stays open so several can be flipped in one visit.

## Business logic — TL;DR

- **"Run on" chooses the run target** - one flat single-select list: This machine, GitHub Actions, Claude web, then the user's saved devices, then "Add a device…". Exactly one entry carries the checkmark.
- **A device is a target, not a destination** - selecting a saved device makes it where the next agent runs; the browser stays on the local daemon, which relays the agent to that device. Only when the dashboard is genuinely connected to a remote daemon does that device carry the mark instead, and then "This machine" means "go back to the local daemon".
- **Devices show whether they can be reached** - each saved device shows its address with an online/offline dot, dims when offline, and can be removed from its own row without selecting it.
- **Global options are preference checkboxes** - each explains itself in one line, and a row that cannot be switched right now carries its reason in that same line rather than being a mystery greyed row.
- **The gear says whether anything is on** - a dot on the gear when at least one option is active, and the exact count on hover.
- **Where the target is already fixed, the menu says so** - a composer inside a running agent offers only the preferences, and its label reads accordingly rather than promising control over the run it does not have.

## Business logic

### Choosing where the next agent runs

#### User story

The user is about to start an agent and wants to say whether it runs on this device, on a fresh GitHub Actions runner, as a Claude Code cloud session, or on one of their other machines.

#### Business logic

The "Run on" submenu presents the three run targets — "This machine" (run here, as usual), "GitHub Actions" (a fresh runner), "Claude web" (hand off to a Claude Code cloud session, which opens its own pull request) — followed by every saved device and an entry to add one. The submenu's trigger shows the current choice, so the answer is readable without opening it.

Selecting a run target writes it as the preference and clears any selected device. Selecting a device makes that device the target instead, without navigating anywhere: the local daemon relays the agent to it and streams its events back. Because only one thing can be the target, a run-target row is marked only while no device is selected, so the single checkmark never doubles up. A selected device whose saved entry has since been removed reads as no device selected.

When the dashboard is connected to a remote daemon rather than the local one, that daemon's device is what carries the mark, and choosing "This machine" is the way back to the local daemon.

#### Rationale

"Claude web" is named for the hand-off it is rather than promising a streamed agent, because that agent runs on claude.ai and opens its own pull request.

### Saved devices

#### User story

The user has another machine running a daemon and wants to send work to it, drop it when it is no longer theirs, and know at a glance whether it is even up.

#### Business logic

Each saved device shows its name, its address, and a reachability dot: filled when the device answered, muted while offline or still being checked. An offline device is dimmed but still selectable. Each row carries its own remove control, which drops the saved device without selecting it. "Add a device…" explains what to paste: the address a machine prints when its daemon binds to the network.

### The global options

#### User story

The user wants to flip several options before starting an agent, and to understand why one of them cannot be flipped right now.

#### Business logic

Each option is a checkbox row carrying its name and a one-line description; hovering it gives the longer explanation. Switching one writes the preference immediately and leaves the menu open. When an option cannot be switched, its reason is appended to its own description line, because a tooltip does not open on a disabled row.

### What the gear itself says

#### Business logic

The gear shows a dot whenever at least one option is on and enabled — that some options are on is the signal worth carrying on the icon; the exact number is one click away and would be noise there. Hovering the gear names the menu and, when any are on, how many.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
