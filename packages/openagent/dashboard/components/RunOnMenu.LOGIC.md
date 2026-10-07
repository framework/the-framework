The "Run on" pick of the composer [1]: one dropdown that says where the next agent [2] starts — this machine, or one of the devices [3] the user saved — and lets the user add or remove a device. Its button has two looks: a chip [5] that says the target in words, and an icon button.

## Context

**User story**: the user has a second machine running the dashboard's daemon. They pick it in "Run on" and press Start: the agent runs there, and its page in this dashboard looks like any other. They never leave this dashboard.

**Problem**: a device's token is a secret held by this browser. Where an agent runs therefore cannot be a stored preference like the coding agent or the model: it is a pick kept in the browser, handed to one start at a time.

## Glossary

[1] composer: the prompt editor on a project's own page, also used to say something to an agent.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.
[3] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[4] relay: running an agent on a device: the local daemon forwards the start to the device, which runs its own project's start hook, and streams the events back, so the agent renders like a local one.
[5] chip: a small, bordered, rounded label in muted text: an icon and a few words that say one thing. A chip is either plain or the button of a menu.

## Business logic — TL;DR

- **The button: a chip or an icon** - as a chip [5] it reads the target in words ("This machine", or the device's label) between an icon and a down chevron; as an icon button it shows the icon alone; the menu is the same.
- **One list, one checkmark** - "This machine", the saved devices [3], then "Add a device…"; the checkmark sits on the target of the next start.
- **Picking** - a device is picked in place, with no navigation, and the start is relayed [4] to it; "This machine" clears the pick, or goes home when the dashboard itself is open on a device.
- **Reachability and removal** - a dot per device says online or not; an offline device's row is dimmed and says "(offline)"; the `X` removes a saved device without picking it.

## Business logic

### The button: a chip or an icon

#### Context

**User story**: at the launcher the user reads where the next agent [2] runs without opening anything: the first chip [5] above the box says "This machine" or the device's name.

**Problem**: an icon alone does not say which device is picked. Where there is room for words (the launcher's row above the box) the button says them; where there is not (the compact single row) it stays an icon. It is one menu with two looks, chosen by the embedding composer (`Composer.tsx`).

#### Business logic

The button is named "Run on" in both looks. The target it stands for is "This machine", the picked device's label, or, when the dashboard itself is open on a device's daemon, that device's label ("A device" when it is not among the saved ones). Its icon is a laptop while the target is this machine, and a device icon with a small dot on it while the target is a device; a picked device that is offline carries the same icon and dot as one that is online. Its tooltip reads "Run on — `<target>`".

- As a chip: the icon, then the target in words, then a small down chevron. A target too long for the room the chip has is cut short, ending in an ellipsis; the icon and the chevron stay. The menu opens from the chip's left edge.
- As an icon button: the icon alone, with no words. The menu opens from the button's right edge.

### One list, one checkmark

#### Context

See `## Context`.

#### Business logic

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
