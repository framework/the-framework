The gear button next to the composer [1]: one dropdown that holds the agent [2] options as checkboxes, each written straight to the preferences [3] the moment it is flipped, and, in the launcher [4], a "Run on" submenu at the top that picks the location [5] of the next agent — this machine, a GitHub Actions runner, a Claude Code cloud session [6], or a saved device [7].

## Context

**User story**: before starting an agent the user opens the gear, ticks "Open PR" or "Browser", picks where the agent runs, and closes the menu; the next agent starts with those settings, and so does every agent after it, because the settings are the user's preferences rather than one form's state. From a running agent's page the same gear offers only what still applies there.

**Business logic story**: the option rows themselves — which exist, what each writes, which are disabled and why — are one table shared with the Settings page, defined in `lib/agent-option-rows.ts`. This menu renders that table and the "Run on" list; it decides nothing about the rows.

## Glossary

[1] composer: the prompt editor on a project's own page, also used for live chat.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[4] launcher: the Start form on a project's own page.
[5] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[6] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[7] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[8] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[9] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[10] agent view: one agent's page.
[11] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **The gear and its dot** - a gear button named "Session options" (or "Preferences" from an agent's page), with a small dot when at least one option is on, and a tooltip that counts them.
- **Option rows write straight to the preferences** - each row is a checkbox with a label, a one-line description and a tooltip; ticking it writes its preference at once and the menu stays open; a disabled row says why in its description.
- **The options offered** - the seven rows of the shared table in the launcher, a subset from a finished agent's page, none of the location rows from a running agent's page.
- **"Run on": one flat list with one checkmark** - the three locations, then the saved devices, then "Add a device…"; exactly one row carries the checkmark and the submenu's summary names it.
- **Picking a location or a device** - a location is reported to the launcher, which stores it; a device is selected for the next start only, never stored, and the local daemon relays the agent to it; "This machine" while connected to a device goes back to this machine's own dashboard.
- **Device rows: reachability and removal** - every device row shows a green dot when online, reads "(offline)" and dims when not, and has an X that removes the device without selecting it.

## Business logic

### The gear and its dot

#### Context

**User story**: the user sees at a glance that some options are on, without the menu shouting a number.

#### Business logic

- The trigger is a gear icon button. Its name is "Session options" by default; the composer [1] on an agent's page names it "Preferences", since from there it controls no start. The button is disabled while the surface is busy (an agent [2] is being started).
- When at least one option is both ticked and not disabled, a small dot sits on the button's corner. The tooltip reads "<name> — <n> on" with the count of such options, or just the name when none is on.
- The menu opens aligned to the button's right edge.

### Option rows write straight to the preferences

#### Context

**Problem**: the options are the user's preferences [3], not the state of one form: a flip must hold for every later agent and for every other open tab, so it is written through immediately rather than gathered at submit.

#### Business logic

- Each row is a checkbox item showing its label and, under it, a one-line description; hovering shows the row's long explanation as a tooltip.
- Ticking or unticking a row writes the change the row stands for to the preferences at once (the write is best effort: a failed save is not reported over a checkbox). The menu stays open so several rows can be flipped in one visit.
- A row is disabled while the surface is busy, or when the table marks it disabled. A disabled row cannot be toggled and shows no tooltip, so its reason is appended to its description instead, as "— <reason>" (for example "— off while Transparent is on", "— nothing to open while Push branch is off", "— only on Claude Code — the browser is wired through its MCP config").
- A ticked row shows the effective value: an option the table reports as overridden reads as off, so the menu never claims an option is on while the agent ignores it.

### The options offered

#### Context

See `## Context`.

#### Business logic

The rows, in the order they appear, as the shared table defines them: "Transparent" ("Raw <coding agent [11]> — turns the whole framework off."), "Disable system prompt" ("Drops the added system prompt; keeps the agent controls."), "Post-merge cleanup" ("Runs quality passes once it is ready to merge."), then the three rungs of the handoff [9] ladder "Push branch" ("Pushes the agent branch when it finishes."), "Open PR" ("Opens a draft pull request when it finishes.") and "Auto-merge" ("Merges the pull request once it is opened."), and "Browser" ("Gives the agent a real browser to inspect pages."). Which of them are disabled, and what unticking a rung writes, is the table's rule in `lib/agent-option-rows.ts`.

Which surface shows what:

- The launcher [4] shows the whole table and the "Run on" submenu.
- A finished agent's composer on the agent view [10] shows only the rows that a resumed agent will honor (the ladder and "Browser"), writing the same preferences, and no "Run on": the location [5] of a continued agent is fixed by the conversation it continues.
- A running agent's composer shows no rows at all and no "Run on".

### "Run on": one flat list with one checkmark

#### Context

**User story**: the user opens "Run on" and sees one list of everything the next agent [2] can run on, with a single checkmark on the current choice, whether that is a location [5] or a device [7].

#### Business logic

- The submenu's trigger reads "Run on" with a summary on the right naming the current target: when the dashboard is itself connected to a device, that device's label (or "A device" when the device is not among the saved ones); otherwise the selected device's label; otherwise the location's label. The trigger is disabled while the surface is busy.
- The list, in order: the three locations — "This machine" ("Run on this machine, as today."), "GitHub Actions" ("Run on a fresh GitHub Actions runner.") and "Claude web" ("Hand off to a Claude Code cloud session, which opens its own PR.") — then one row per saved device, then "Add a device…" ("Paste the URL a box prints on its network bind."). The device rows and "Add a device…" exist only where the launcher [4] supplies its devices; the three locations exist wherever "Run on" does. There is no section header and no separate "Local" row: this machine is one of the locations.
- Exactly one row carries the checkmark. On this machine's own dashboard with no device selected, it is the current location. With a device selected, it is that device and no location row is marked. When the dashboard is connected to a device, it is the device whose URL the dashboard is on, and no location row is marked. A selection that names a device no longer saved counts as no selection.

### Picking a location or a device

#### Context

**Business logic story**: a location is a preference; a device is a target for the next start only. The local daemon relays [8] an agent [2] started on a device, so the agent renders in this dashboard like a local one and nothing navigates away.

#### Business logic

- Clicking a location row reports the location [5] to the launcher [4], which stores it as the preference, and clears any device selection so the checkmark never doubles up. Exception: clicking "This machine" while the dashboard is connected to a device returns the browser to this machine's own dashboard instead, and stores nothing.
- Clicking a device row selects that device [7] as the target of the next start: no navigation, and nothing written to the preferences [3].
- Clicking "Add a device…" opens the add-device flow; the item is disabled while the surface is busy.

### Device rows: reachability and removal

#### Context

**User story**: the user sees which saved devices are reachable before picking one, and can drop a device that is gone.

#### Business logic

- Each device row shows a device icon, a status dot, the device's label and its URL. The dot is green when the device answered its last reachability check; it is muted when the device is offline or has not been checked yet. An offline device's URL reads "<url> (offline)" and the whole row is dimmed; it can still be selected.
- Each row ends with an X button named "Remove device <label>" (tooltip "Remove <label>"), which removes the saved device without selecting it. Whether the removed device was the current target, and clearing that, is the launcher's [4] concern.
