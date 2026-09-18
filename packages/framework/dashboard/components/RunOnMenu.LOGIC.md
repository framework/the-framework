The "Run on" pick beside the composer [1]: one dropdown that says where the next agent [2] starts — this machine, or one of the devices [3] the user saved — and lets the user add or remove a device.

## Context

**User story**: the user has a second machine running the dashboard's daemon. They pick it in "Run on" and press Start: the agent runs there, and its page in this dashboard looks like any other. They never leave this dashboard.

**Problem**: a device's token is a secret held by this browser. Where an agent runs therefore cannot be a stored preference like the coding agent or the model: it is a pick kept in the browser, handed to one start at a time.

## Glossary

[1] composer: the prompt editor on a project's own page, also used to say something to an agent.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.
[3] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[4] relay: running an agent on a device: the local daemon forwards the start to the device, which runs its own project's start hook, and streams the events back, so the agent renders like a local one.

## Business logic — TL;DR

- **One list, one checkmark** - "This machine", the saved devices [3], then "Add a device…"; the checkmark sits on the target of the next start.
- **Picking** - a device is picked in place, with no navigation, and the start is relayed [4] to it; "This machine" clears the pick, or goes home when the dashboard itself is open on a device.
- **Reachability and removal** - a dot per device says online or not; an offline device's row is dimmed and says "(offline)"; the `X` removes a saved device without picking it.

## Business logic

### One list, one checkmark

#### Context

See `## Context`.

#### Business logic

The button is named "Run on". It shows a laptop while the target is this machine, and a device icon with a small dot while the target is a device; its tooltip reads "Run on — `<target>`", where the target is "This machine", the picked device's label, or, when the dashboard itself is open on a device's daemon, that device's label ("A device" when it is not among the saved ones).

The menu lists "This machine" ("Start the run here, through this project's start hook."), then every saved device by label with its URL underneath, then "Add a device…" ("Paste the URL a box prints on its network bind."). Exactly one row carries the checkmark: the picked device; else, when the dashboard is open on a device's daemon, that device; else "This machine". A pick that names a device the user has since removed counts as no pick.

### Picking

#### Context

See `## Context`.

#### Business logic

A click on a device's row makes it the target of the next start and nothing else: the browser stays where it is, and the local daemon relays [4] the start. A click on "This machine" clears the pick. When the dashboard itself is open on a device's daemon, "This machine" instead takes the browser back to this machine's own dashboard. "Add a device…" opens the dialog that saves a new device. The whole button is off while the embedding composer [1] is busy.

### Reachability and removal

#### Context

**Problem**: a start relayed to a machine that is switched off fails late and vaguely; the user should see it before picking.

#### Business logic

Each device's row carries a dot: green when its last reachability check answered, muted when it did not or has not been checked yet. A device known to be offline has its row dimmed and "(offline)" after its URL; it can still be picked, and the composer then refuses to start and says why (`Composer.tsx`).

Each device's row ends in an `X` named "Remove device `<label>`". A click on it removes the saved device and does not pick it; when the removed device was the target, the embedding composer clears the pick.
