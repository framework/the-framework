The dashboard's prompt editor with the controls around it, shared by the launcher [1] (where a submit starts an agent [2]) and by live chat [3] on an agent view [1] (where a submit sends a message): a rich editor opened by `/` for presets, `<` for tags, `@` for projects and `#` for files, the driver [4] and model select, the presets menu, the options gear with its "Run on" choice of a location [5] or a device [6], and the submit arrow. It decides what kind of agent a submit asks for (build or prompt), keeps every choice in the user's preferences [7], refuses to start on a device that is offline, and hides the controls a continuation cannot change; what a submit does is decided by the surface that embeds it.

## Context

**User story**: the user types what to build on project home [1], or picks a preset, points the agent at a project or a file with `@` or `#`, chooses the coding agent, the model and where it runs, and presses "Start agent". On an agent view the same box is the live chat: the user types a message and presses "Send"; once the agent has ended, the next message resumes it.

**Problem**: the launcher and live chat are the same surface (same editor, same presets, same mentions, same preferences), so they share one composer; they differ only in what a submit does and in which controls still mean something.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat). agent view: one agent's page.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] live chat: the user's own messages to a running agent, each continuing the same driver session. One of them is a message.
[4] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`.
[5] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[6] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[7] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[8] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[9] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[10] coding agent: the CLI doing the actual work: Claude Code or Codex.
[11] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[12] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[13] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[14] Context: the launcher's "Context": the set of projects and files the agent is told to focus on, picked in the "Context" menu or by mentioning them in the prompt with `@` and `#`.
[15] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.

## Business logic — TL;DR

- **What the composer shows** - one bordered box: the editor, and under it the presets button, the launcher's "Context" picker, then the driver-and-model select, the options gear and the submit arrow; everything is disabled while the embedding surface is busy.
- **Build agent or prompt agent** - a submit is a build until a preset is loaded, then a prompt run verbatim; emptying the box goes back to build and drops the preset's rules.
- **Presets prefill the editor** - fourteen built-in presets in a fixed order, the user's own and the project's saved ones, each replacing the box in one undoable step and rendered against the agent it is launched from; "New preset…" saves the current text for "Just me" or "This project".
- **Driver and model** - a tree of Claude Code and Codex with each driver's own models; picking a model sets both, and no model is pinned by default.
- **The options gear** - "Session options" at the launcher with "Run on" and the seven option rows; no gear at all inside a live agent; "Resume options" with four rows once the agent has ended.
- **"Run on": a location or a device, and the offline rule** - the three locations then the saved devices, one checkmark; a device selected in place is relayed to; a device known to be offline blocks starting and says so.
- **Submitting** - the arrow exists only once there is text; refused while blank, busy, already submitting or targeting an offline device; a double press starts one agent; an idle control (Stop, Resume) can take the arrow's slot while the box is empty.
- **Mentions feed the Context** - `@` a registered project or `#` a file adds it to the Context; removing the chip drops it again.
- **A carried draft** - at the launcher, a draft carried from another device or from a click elsewhere in the dashboard seeds the editor once, as a build.
- **What a continuation hides** - inside an agent the driver-and-model select, "Run on" and the "Settings:" strip are gone, and the gear too while the agent is live.
- **The "Settings:" strip** - under the launcher's box, every option in effect as a chip, marked "repo" when the repo file set it.
- **The compact single row** - a one-row variant with the editor, the select, the gear and the submit, and none of the presets surfaces.

## Business logic

### What the composer shows

#### Context

See `## Context`.

#### Business logic

The composer is one bordered box: the editor on top, a control row tucked under it. From left to right the row holds the presets button (tooltip "Load a preset prompt — also available by typing / in the editor"), the launcher's [1] "Context" picker when the launcher passes one, and, clustered at the right end, the driver-and-model select, the options gear and the submit arrow. The editor's placeholder is "Describe what to build…  ( / commands · < tags · @ projects · # files )" unless the embedding surface supplies its own: live chat [3] says "Message the agent…  ( / commands · < tags · @ projects · # files )" while the agent [2] is live and "Message the agent to continue it…  ( / commands · < tags · @ projects · # files )" once it can be resumed. Below the box, at the launcher only, a second row starts with the launcher's "Enhanced System Prompt" disclosure and ends with the "Settings:" strip. While the embedding surface reports itself busy (a start or a message in flight) the editor is read-only, every menu and button is disabled, and the submit arrow shows a spinner. The editor's own rules (what `/`, `<`, `@`, `#` open, Enter versus Shift+Enter, markdown, chips) are in `PromptEditor.tsx`.

### Build agent or prompt agent

#### Context

**Business logic story**: the daemon starts either a build agent [8], which works the agent queue after its opening exchange, or a prompt agent, which runs one prompt and stops; the kind travels with the submit.

#### Business logic

A submit carries the box's text, trimmed, and a kind. The kind is build until a preset is loaded, after which it is prompt: the preset's rendered prompt runs verbatim, and editing that text does not change the kind. Emptying the box is a fresh start: the kind returns to build, and a preset's "open an agent of its own" rule is dropped with it. When the embedding surface clears the box (after a successful start) the kind returns to build as well. The submit also says whether the loaded preset must open an agent [2] of its own; the surfaces that sit inside an agent then start a new agent instead of sending into the one they sit in. Among the built-in presets only "Update from GitHub" carries that rule; a saved preset never does.

### Presets prefill the editor

#### Context

**User story**: the user opens the presets button or types `/` and picks "Security audit"; the editor fills with the rendered prompt, its tags shown as chips, ready to edit or to start.

#### Business logic

- The built-in presets, in the order offered: "Research", "Readability", "Maintainability", "Security audit", "UX (auto)", "Suggest new tickets", "Suggest new features", "Suggest tickets to work on", "Plan tickets (aka spike)", "Market research", "Update from GitHub", "Maintenance", "Add quick-win work to AI Queue", "Add consensual work to AI Queue". The list, its order, each label and each tooltip come from the preset catalog in `src/preset-catalog.ts`.
- A preset is rendered against the agent [2] it is launched from: on an agent view [1] the composer knows that agent's session name [9], and a preset whose subject is left blank targets that agent's work; at the launcher no agent exists yet, and the same blank falls through to the "entire codebase".
- Loading a preset, from the presets menu or from the `/` menu, replaces whatever is in the box without asking first; the embedding surface is told the preset's label and whether a typed draft was overwritten, so the launcher can note that undo brings the draft back.
- The presets menu also lists the user's saved presets under "Your presets" and the open project's under "Project presets", each with a delete cross ("Delete preset <label>"). Deleting removes the preset from the user's preferences [7] or from the project's saved list respectively.
- "New preset…", offered in the presets menu and in the `/` menu, opens the "New preset" dialog prefilled with the current text. Saving for "Just me" adds it to the user's saved presets; saving for "This project" adds it to the open project's shared presets, and that choice is offered only while a project is open. After saving or cancelling, focus returns to the editor. The dialog's own rules are in `PresetCreatePanel.tsx`.

### Driver and model

#### Context

**Problem**: the model is passed straight through to the coding agent [10], so a model must be chosen within its own driver's [4] list; an incompatible pair, such as Codex with a Claude model, must be impossible to choose.

#### Business logic

The select is a tree: "Claude Code" with "Fable", "Opus", "Sonnet" and "Haiku"; "Codex" with "GPT-5 Codex", "GPT-5" and "o3". Picking a model sets the driver and the model together. Both are global preferences [7]: the select reads and writes the same values wherever it appears, and an agent [2] started anywhere uses them. The default driver is Claude Code, and no model is pinned by default: the trigger then shows the driver's logo with no model name and reads "Driver: Claude Code · Model: the CLI's own default", never naming a model the agent would not be passed. The model lists are shared with the Settings page and the routine cards (`lib/agent-settings.ts`); the menu's own rules are in `DriverModelMenu.tsx`.

### The options gear

#### Context

**Problem**: every agent option is fixed when the agent [2] is spawned, so a control that looks adjustable inside a running agent would only rewrite the next agent's default.

#### Business logic

- At the launcher [1] the gear, named "Session options", opens with "Run on" at the top, then one checkbox per option: "Transparent", "Disable system prompt", "Post-merge cleanup", "Push branch", "Open PR", "Auto-merge" and "Browser". Ticking a row writes the preference [7] at once, and the menu stays open so several can be flipped in a row. Which rows are disabled and why, and how the three handoff [11] rungs gate each other, is decided in `lib/agent-option-rows.ts`. The gear's trigger carries a dot while any option is on, and its tooltip counts them ("Session options — 2 on").
- Inside a live agent there is no gear at all: nothing is adjustable while the agent runs.
- Once the agent has ended, the next message resumes it as a new leg that reads the current preferences at its start, so the gear returns, named "Resume options", with only the rows that shape that leg: "Push branch", "Open PR", "Auto-merge" and "Browser". "Run on" and the devices are not offered there: where an agent runs is fixed when it is spawned.

### "Run on": a location or a device, and the offline rule

#### Context

**User story**: the user opens the gear, then "Run on", and picks "GitHub Actions", "Claude web" or a saved laptop; the next start goes there. If the laptop is off, the launcher says so instead of trying.

#### Business logic

- "Run on" lists the three locations [5] as "This machine", "GitHub Actions" and "Claude web" (a hand-off to a cloud session [12] that opens its own pull request), then every saved device [6] with an online/offline dot and a remove cross, then "Add a device…". The location is a preference [7]. The selected device is not: it is held in memory for the life of the page, because a device's token is a per-browser secret that never reaches the daemon's registry.
- Picking a device selects it in place as the target of the next start, with no navigation: the local daemon relays [13] the agent [2] to it. Picking a location clears the device selection. The one checkmark sits on the device or on the location, never on both. The exact rows, including what "This machine" does while the dashboard is itself connected to a remote daemon, are in `OptionsMenu.tsx`.
- A device known to be offline blocks starting: the submit arrow is disabled, the keyboard shortcut does nothing, and a red note under the box reads "<device label> is offline. Pick another target in "Run on" to start." ("The selected device" stands in for the label when the device's saved entry is gone). A device whose status is not known yet, because its first reachability check has not come back, does not block. Nothing falls back to another target on its own.
- Removing a saved device that is the selected target clears the selection back to the chosen location. "Add a device…" opens the "Add a device" dialog (`AddDeviceDialog.tsx`); once a device is added, focus returns to the editor.

### Submitting

#### Context

**User story**: the user presses Enter or the arrow and the agent [2] starts; pressing twice must not start two agents.

#### Business logic

- The submit arrow appears only once the box has text: an empty box has nothing to send, and the arrow is hidden and out of the keyboard focus order. Its name is the embedding surface's label — "Start agent" at the launcher [1], "Send" in live chat [3] — and its tooltip adds the shortcut, "Start agent  (Enter · Shift+Enter for a new line)". While busy the tooltip is the surface's busy label ("Starting…", "Sending…" or "Resuming…").
- A submit is refused when the text is blank (whitespace only counts as blank), when the surface is busy, when a submit is already in flight, or when the target device [6] is offline. The rule is the same for the arrow and for the keyboard shortcut.
- Two submits fired before the first has been acknowledged count as one: the second is ignored rather than starting a second agent and surfacing a spurious "already active" error.
- When the embedding surface provides an idle control, the empty box shows it in the arrow's slot — on an agent view [1], "Stop agent" while the agent is live and "Resume" once it has stopped — and typing swaps the arrow back in. Without one the slot collapses while the box is empty.

### Mentions feed the Context

#### Context

**User story**: the user types `@` and picks another registered project, or `#` and picks a file; the agent [2] is focused on it, and the "Context" picker shows it as picked.

#### Business logic

The `@` picker offers the registered projects, which the composer loads itself; the `#` picker offers the current project's files, which the embedding surface supplies. Picking one inserts a chip and adds the project's path or the file's repository-relative path to the Context [14]. When a chip leaves the editor, deleted or overwritten by a preset, the path is dropped from the Context again, so the prompt and the Context cannot disagree; a surface that keeps no Context simply does not receive the removal.

### A carried draft

#### Context

**User story**: the user typed a prompt and then switched the dashboard to another device, or clicked a ticket that leads to the launcher [1]: the text is waiting in the box.

#### Business logic

At the launcher, and never in the compact row nor inside an agent [2], a draft carried in — from a device [6] switch or from a click elsewhere in the dashboard that navigated here — seeds the editor once. The draft is taken out of its holding place as it is read, so a reload does not seed it again, and the address bar is cleaned of it at once so a prompt never sits in the URL, the history or a referrer. A carried draft is plain text: the kind stays build. How the draft travels is in `lib/draft-handoff.ts`.

### What a continuation hides

#### Context

**Problem**: an agent [2] is bound to the driver [4], model, location [5] and options it was spawned with; showing those controls on its page would promise control over this agent while only changing the next one's defaults.

#### Business logic

Inside an agent, both in live chat [3] and for the resume after the agent has ended, the composer hides the driver-and-model select, the "Run on" choice with its devices, and the "Settings:" strip; while the agent is live it hides the gear too. The presets menu and the `/` menu stay: a preset can still be sent as a message, or opened as an agent of its own when it is marked so.

### The "Settings:" strip

#### Context

**Problem**: the options in effect are invisible until the gear is opened, and the gear shows only the user's own preferences [7]; the repo file [15] can put an option in play that the user never chose and the gear cannot change.

#### Business logic

At the launcher [1], below the box, a strip labeled "Settings:" lists every option currently on as a chip, built from the same rows and rules as the gear so the two never disagree. A chip whose value comes from the repo file is drawn dashed and tagged "repo", with the tooltip "From this repo's the-framework.yml, committed for everyone who clones it"; the user's own chips say "Your setting, from the options gear". The strip disappears when nothing is on. The chip rules are in `ResolvedOptions.tsx`.

### The compact single row

#### Context

**Problem**: a quick-launch that must fit in one header row cannot spend a second row on controls, yet an agent [2] started from it must still say which driver [4], model and options it uses.

#### Business logic

The compact variant is one row: the editor, then the driver-and-model select, the gear and the submit slot, with no presets button, no "New preset…" entry in the `/` menu, no "Settings:" strip, no preset dialog and no carried draft. Its select and gear read and write the same preferences [7] as the full composer, so an agent started from it uses exactly what they show.
