The dashboard's prompt editor with the controls around it, shared by the launcher [1] (where a submit starts an agent [2]) and by an agent view [1] (where a submit says the text to that agent): a rich editor opened by `/` for the project's commands [3] and the saved prompts [4], `@` for projects and `#` for files, the Commands menu, the launcher's own controls (its Context [10] picker and its "Post-merge cleanup" box), the coding agent [5] and model select, the "Run on" pick of this machine or a device [6], and the submit arrow.

## Context

**User story**: the user types what to do on project home [1], or loads a command or a saved prompt, mentions a project or a file with `@` or `#`, chooses the coding agent, the model and where the agent runs, and presses "Start agent". On an agent view the same box talks to that agent: the user types a message and presses "Send".

**Problem**: the launcher and the agent view are the same surface (same editor, same commands, same saved prompts, same preferences), so they share one composer; they differ only in what a submit does and in which controls still mean something. The Framework ships no prompt text: what the `/` list and the menu offer is what the open project's own skills say, plus what people saved.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent). agent view: one agent's page.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[3] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[4] saved prompt: a prompt the user saved under a name, either for themselves (kept with their preferences) or for the project (committed in the project's repository), and loads back into the editor verbatim.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[7] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[8] relay: running an agent on a device: the local daemon forwards the start to the device, which runs its own project's start hook, and streams the events back, so the agent renders like a local one.
[9] start hook: the one shell line under `start:` in the project's `.the-framework/hooks.yml`, which starts an agent and answers its id.
[10] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root. The agent can still reach everything; the Context only says where to look.

## Business logic — TL;DR

- **What the composer shows** - one bordered box: the editor, and under it the Commands button and, at the launcher, its own controls (the Context [10] picker and, where offered, the "Post-merge cleanup" box), then the coding-agent-and-model select, the "Run on" pick and the submit arrow; everything is disabled while the embedding surface is busy.
- **Commands and saved prompts load into the editor** - the open project's commands [3] and the user's and the project's saved prompts [4], from the `/` list or the Commands menu, each replacing the box in one undoable step; "Save prompt…" saves the current text for "Just me" or "This project".
- **Mentions feed the Context** - where the surface keeps a Context (the launcher), an `@` or `#` mention adds the project's path or the file to it and deleting the chip takes it out; elsewhere a mention is only text.
- **Driver and model** - a tree of Claude Code and Codex with each one's own models; picking a model sets both, and no model is pinned by default.
- **"Run on": this machine or a device, and the offline rule** - this machine then the saved devices, one checkmark; a device selected in place is relayed [8] to; a device known to be offline blocks starting and says so.
- **Submitting** - the arrow exists only once there is text; refused while blank, busy, already submitting, targeting an offline device, or when the surface says nothing can be submitted; a double press starts one agent; an idle control (Stop, Resume) can take the arrow's slot while the box is empty.
- **A carried draft** - at the launcher, a draft carried from another device or from a click elsewhere in the dashboard seeds the editor once.
- **What an agent view hides** - inside an agent the coding-agent-and-model select and "Run on" are gone.
- **The compact single row** - a one-row variant with the editor, the select, "Run on" and the submit, and no Commands button.

## Business logic

### What the composer shows

#### Context

See `## Context`.

#### Business logic

The full composer is one bordered box. The editor is on top (`PromptEditor.tsx`). Under it is one row: the Commands button at the start, followed by whatever controls the surface hangs there (the launcher hangs its Context [10] picker, `ContextMenu.tsx`, and, where the project offers it, its "Post-merge cleanup" box, `StartAgentForm.tsx`); the coding-agent-and-model select, the "Run on" pick and the submit slot clustered at the end. Under the box, when it applies, is the note that the target device [6] is offline.

While the embedding surface is busy (a start or a send is in flight) the editor and every control are disabled.

The composer reads the open project's commands [3] itself, for whichever project the dashboard has open, so the launcher and an agent view offer the same list.

### Commands and saved prompts load into the editor

#### Context

**User story**: the user wants to run one of the project's commands [3], or reuse a prompt they or a teammate saved [4], without retyping it.

**Problem**: loading only behind typing `/` gave a first-time user no sign that anything exists to load, so the same items also sit behind a visible button.

#### Business logic

Two ways in, one result. Typing `/` in the editor lists the commands and the saved prompts (`PromptEditor.tsx`); the Commands button opens a menu (`CommandsMenu.tsx`) with three sections, "Commands", "Your saved prompts" and "Project saved prompts".

- A command loads as `/<name> `, the name and one trailing space, so an argument can be typed after it. What is then submitted is that line as typed: the coding agent [5] resolves the command from the project's skills.
- A saved prompt loads verbatim.
- Either replaces what the editor held, in one step the editor's undo takes back. The embedding surface is told what was loaded and whether a typed draft was replaced, so the launcher can say so in its note.
- "Save prompt…" opens a dialog (`PresetCreatePanel.tsx`) seeded with the editor's current text; the user names it and saves it for "Just me" (kept with their preferences [7]) or "This project" (committed in the project's repository; offered only while a project is open). The `X` on a saved prompt's row deletes it without loading it.

Nothing about a loaded text changes what a submit does: a command, a saved prompt and the user's own words are all one prompt.

### Mentions feed the Context

#### Context

**User story**: at the launcher the user types "port the login flow from @my-other-app" and the other project is picked in the Context [10] as well, so the agent's prompt ends by naming its path.

#### Business logic

The surface may hand the composer two edits of its Context: add a path, and remove one. When it does (the launcher), picking a project in the `@` menu adds that project's path, picking a file in the `#` menu adds the file's repository-relative path, and a chip that leaves the editor removes its path again (the rules in `PromptEditor.tsx`). When it does not (an agent view, the compact row), a mention changes nothing but the text.

### Driver and model

#### Context

**Problem**: the model is passed straight through to the coding agent [5], so a model must be chosen within its own coding agent's list; an incompatible pair, such as Codex with a Claude model, must be impossible to choose.

#### Business logic

The select is a tree: "Claude Code" with "Fable", "Opus", "Sonnet" and "Haiku"; "Codex" with "GPT-5 Codex", "GPT-5" and "o3". Picking a model sets the coding agent and the model together. Both are global preferences [7]: the select reads and writes the same values wherever it appears, and an agent [2] started anywhere uses them. Claude Code is shown when none was picked, and no model is pinned by default: the trigger then shows the coding agent's logo with no model name and reads "Driver: Claude Code · Model: the CLI's own default", never naming a model the agent would not be passed. The model lists are shared with the Settings page (`lib/agent-settings.ts`); the menu's own rules are in `DriverModelMenu.tsx`.

### "Run on": this machine or a device, and the offline rule

#### Context

**User story**: the user has a second machine running the dashboard's daemon and wants the next agent [2] to run there, without leaving this dashboard.

#### Business logic

The "Run on" pick (`RunOnMenu.tsx`) lists "This machine", then the saved devices [6], then "Add a device…", with one checkmark. Picking a device makes it the target of the next start in place, with no navigation: the local daemon relays [8] the start to it, and the device runs its own project's start hook [9]. The pick is kept in this browser only, never in the preferences [7], because a device's token is this browser's secret. Removing a saved device that was the target clears the pick.

A device whose reachability check says offline blocks the submit, by click and by keyboard, and the composer says under the box, as an alert: "`<label>` is offline. Pick another target in "Run on" to start." A device whose status is still unknown does not block. Nothing falls back to this machine by itself.

### Submitting

#### Context

**User story**: the user presses Enter or the arrow and the agent [2] starts; pressing twice must not start two agents.

#### Business logic

- The submit arrow appears only once the box has text: an empty box has nothing to send, and the arrow is hidden and out of the keyboard focus order. Its name is the embedding surface's label — "Start agent" at the launcher [1], "Send" on an agent view [1] — and its tooltip adds the shortcut, "Start agent  (Enter · Shift+Enter for a new line)". While busy the tooltip is the surface's busy label ("Starting…", "Sending…" or "Resuming…").
- A submit is refused when the text is blank (whitespace only counts as blank), when the surface is busy, when a submit is already in flight, when the target device [6] is offline, or when the embedding surface says nothing can be submitted — the launcher does for a project that has no start hook [9]. The rule is the same for the arrow and for the keyboard shortcut.
- Two submits fired before the first has been acknowledged count as one: the second is ignored rather than starting a second agent.
- When the embedding surface provides an idle control, the empty box shows it in the arrow's slot — on an agent view, "Stop agent" while the agent is working and "Resume" once it was stopped — and typing swaps the arrow back in. Without one the slot collapses while the box is empty.

### A carried draft

#### Context

**User story**: the user typed a prompt and then switched the dashboard to another device, or clicked a ticket that leads to the launcher [1]: the text is waiting in the box.

#### Business logic

At the launcher, and never in the compact row nor inside an agent [2], a draft carried in — from a device [6] switch or from a click elsewhere in the dashboard that navigated here — seeds the editor once. The draft is taken out of its holding place as it is read, so a reload does not seed it again, and the address bar is cleaned of it at once so a prompt never sits in the URL, the history or a referrer. How the draft travels is in `lib/draft-handoff.ts`.

### What an agent view hides

#### Context

**Problem**: an agent [2] is bound to the coding agent [5] it started on and runs where it was started. A control that could only change the *next* agent's default would read as a control over this one.

#### Business logic

Inside an agent the coding-agent-and-model select and the "Run on" pick are not shown, no carried draft is taken, and there is no Context [10] picker: a mention there is only text. The Commands button, the `/` list, the mentions and "Save prompt…" work as at the launcher.

### The compact single row

#### Context

**Problem**: a quick-launch that must fit in one header row cannot spend a second row on controls, yet an agent [2] started from it must still say which coding agent [5] and model it uses and where it runs.

#### Business logic

The compact variant is one row: the editor, then the coding-agent-and-model select, the "Run on" pick and the submit slot, with no Commands button, no "Save prompt…" entry in the `/` list, no save dialog and no carried draft. Its controls read and write the same preferences [7] and the same "Run on" pick as the full composer, so an agent started from it uses exactly what they show.
