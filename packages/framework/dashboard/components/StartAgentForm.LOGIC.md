The launcher on a project home [1]: the box where the user says what an agent [3] should do, or picks one of the project's commands [2] from its `/` list, and Start. A Start is the project's own start hook [4]: the launcher hands it the prompt, with the Context [11] the user picked on its last line, the coding agent [5] and model the user picked, the follow-up [12] when the "Post-merge cleanup" box is ticked, and the device [6] when one is picked, and selects the agent the hook answers. A project that has no start hook cannot start an agent from here, and the launcher says what to add. What would stop the agent (a coding agent not installed or logged out) is said before the Start, from the project's check hook [10].

## Context

**User story**: the user opens a project's project home [1], types a task into the editor or picks a command [2] from its `/` list or its Commands menu, reviews it, and presses "Start agent". The agent appears in the dashboard at once and the box is empty again, ready for the next one. The section is headed "Start an agent".

**Problem**: The Framework ships no prompt text and runs no agent itself. What a project can be asked to do is what its own commands say, and what runs the agent is whatever tool the project's start hook names. So the launcher offers exactly what the project has, and when the project has no start hook it must say so before the user has typed a task into a box that cannot send it.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
[2] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[3] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[4] start hook: the one shell line under `start:` in the project's `.the-framework/hooks.yml`. The daemon runs it with the prompt and the user's picks in its environment, and the line answers the id of the agent it started. The Framework names no tool: the line does.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[7] relay: running an agent on a device: the local daemon forwards the start to the device, which runs its own project's start hook, and streams the events back, so the agent renders like a local one.
[8] saved prompt: a prompt the user saved under a name, either for themselves (kept with their preferences) or for the project (committed in the project's repository), and loads back into the editor verbatim.
[9] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[10] check hook: the one shell line under `check:` in the project's `.the-framework/hooks.yml`. The daemon runs it with the picked coding agent in its environment, and the line answers a list of problems, which would stop the agent, and a list of warnings, which are only worth knowing; each names its own fix. The Framework names no tool: the line does.
[11] Context: the set of paths the user picked to focus an agent on: other registered projects, by their absolute path, and files of the current project, by their path relative to the repository's root. The agent can still reach everything; the Context only says where to look.
[12] follow-up: a prompt a Start carries besides its own: once the agent ends done with a pull request, the tool the start hook names starts a fresh agent on the same branch with that prompt and the first agent's id, and holds the pull request's merge until that one is done. Handed to the start hook as `THEN`.

## Business logic — TL;DR

- **Commands load, never start** - the commands [2] are in the editor's `/` list and the Commands menu, not buttons; picking one loads `/<name> ` into the editor for review, and the form leaves a note saying so.
- **The Context picker** - a "Context" menu on the control row lists the other registered projects to tick and the picked files to remove; `@`/`#` mentions and the right rail's file tree feed the same Context [11].
- **The "Post-merge cleanup" box** - on the control row, after the Context menu, only when the project has the `post-merge-cleanup` command [2] and no device is picked; ticked from the user's saved setting, and a click writes that setting.
- **What a Start sends** - the text with the Context on one `Context:` line at its end, the coding agent [5] and the model when the user picked them, `/post-merge-cleanup` as the follow-up [12] when the box is offered and ticked, and the picked device's address and token; nothing else.
- **A project with no start hook** - Start is off and the form says to run `npx agent-runner init` in the project, or which line to add to which file; a picked device lifts the block, since the device runs its own hook.
- **Before the Start: what would stop the agent** - the check hook's [10] problems in red and its warnings in amber, under the editor, for the coding agent picked; read again when the pick changes; not asked for a picked device; neither turns Start off.
- **Feedback about the start itself** - "Starting…", the refusal in the start hook's own words, the note a loaded command or saved prompt [8] leaves, and an error that clears as soon as the user edits.
- **The moment an agent starts** - the agent is shown and selected immediately under the typed prompt, marked with the device it runs on, and the editor and the Context are emptied.

## Business logic

### Commands load, never start

#### Context

**User story**: the user wants to run one of the project's commands [2] (work the queue, review the UI flows) without remembering its name.

**Problem**: a command may take an argument, and a start spends the account's quota. Picking a command that started the agent outright would do both wrong. The editor's `/` list and the Commands menu already list every command; a button per command above the editor would repeat that list, a long row once a project has many.

#### Business logic

The form shows no command of its own: the commands are listed by the shared composer (`Composer.tsx`), in the editor's `/` list and in the Commands menu. The form reads whether the project has a start hook [4] once per project; until that read answers it says nothing about the start hook.

Picking a command loads `/<name> ` into the editor, replacing what was there, and starts nothing. The form then shows the note "`/<name>` loaded — review or edit, then Start", or "`/<name>` loaded over your draft — undo (⌘Z) brings the draft back" when it replaced typed text. A saved prompt [8] loads the same way under its own name.

### The Context picker

#### Context

**User story**: the user wants the agent to keep another registered project in mind, or to work on two particular files, without spelling out their paths in the prompt.

#### Business logic

The Context [11] belongs to the shell (`App.tsx`, `lib/use-context-set.ts`) and is handed to the form, so the right rail's file tree shows and changes the same set. The form hangs the "Context" menu (`ContextMenu.tsx`) at the start of the composer's control row, after the Commands button. It offers the registered projects other than this one, since this project is the agent's own checkout, and the picked files (every path in the Context that is not a registered project's path). Its trigger carries a summary of what is picked: "<n> project(s)" for the ticked other projects and "<n> file(s)" for the files, joined by " · ", nothing when nothing is picked.

Mentioning a project with `@` in the editor adds that project's path to the Context, and mentioning a file with `#` adds the file's path; deleting the chip takes the path out again (`PromptEditor.tsx`).

### The "Post-merge cleanup" box

#### Context

**User story**: the user wants every agent's work cleaned up before it merges: its maintainability and security follow-ups queued and the project's knowledge files brought up to date, in the same pull request. They tick "Post-merge cleanup" once; from then on each Start is followed by a second agent running `/post-merge-cleanup` on the first one's branch, and the pull request merges only after it.

**Problem**: the follow-up is a project command [2]: a project without it has nothing to follow up with, and a device [6] runs its own project, whose commands this launcher does not read.

#### Business logic

The form hangs a checkbox labelled "Post-merge cleanup" on the composer's control row, right after the "Context" menu, only when the project's commands (as the launcher read them) include one named `post-merge-cleanup` and no device [6] is picked in "Run on"; otherwise there is no box. Its tooltip reads "Once the run ends with a pull request, a fresh agent runs /post-merge-cleanup on its branch; the merge waits for it." It is ticked when the user's preferences [9] say `postMergeCleanup` is on, and unticked when it is off or was never set. Clicking it writes that preference, the same one Settings → Agent → "Post-merge cleanup" shows, so its state is every next Start's default, in every project. It is disabled while a start is in flight.

### What a Start sends

#### Context

See `## Context`.

#### Business logic

The editor and its control row are the shared composer (`Composer.tsx`); this form owns what pressing Start does with the text. The submit button reads "Start agent", and "Starting…" while a start is in flight. A second Start while one is in flight does nothing.

A Start sends the project, the text, and:

- the Context [11], when anything is picked, as one line at the end of the text: the text's trailing whitespace trimmed, a blank line, then `Context: ` and the picked paths joined by ", " (`lib/use-context-set.ts`). At the end, because a command's text must begin with `/<command>`;

- the coding agent [5] the user picked, and the model they picked, read off their preferences [9]. One that was never picked is not sent, so the project's start hook [4] applies its own default;
- `/post-merge-cleanup` as the follow-up [12], when the box is offered (the project has the command and no device is picked) and the preference is on. A preference left on sends nothing in a project without the command, or with a device picked;
- when a device [6] is picked in "Run on": that device's URL, token and label, so the local daemon relays [7] the start to it. The token travels with this one start and is never stored by the daemon.

Whether the text is a command, a saved prompt [8] or the user's own words makes no difference to what is sent: it is one prompt. The Context goes the same way whether the agent runs here or on a device.

### A project with no start hook

#### Context

**Problem**: without a `start:` line there is nothing that could run the agent. Letting the user press Start only to read a refusal wastes the task they typed.

#### Business logic

Once the project is read and it has no start hook [4], and no device [6] is picked, the submit stays disabled — by click and by keyboard — and the form shows, as an alert: "This project has no start hook. Run `npx agent-runner init` in the project, or add a `start:` line to `.the-framework/hooks.yml`."

A picked device lifts the block: the device runs its own project's start hook, so this project's lack of one says nothing about that start. Before the project is read nothing is shown and the submit is on, so the message never flashes on a project that does have the line.

### Before the Start: what would stop the agent

#### Context

**User story**: the user picks Codex, and before typing a task reads under the editor "`codex` is not logged in. Run `codex login`, then start again."; after logging in and picking again, the line is gone.

**Problem**: an agent whose coding agent [5] is missing or logged out would die before its first turn; said after the Start, the user has lost the task they typed and the tool may have spent a branch on it. The Framework does not know which CLI the project's tool needs, so it asks the project's check hook [10].

#### Business logic

The form asks the daemon for the project's check (`dashboard-rpc/projects.ts`, `onStartCheck`) with the coding agent read off the preferences [9] (none when never picked), once per project and again whenever the pick changes or a device [6] is picked or unpicked. With a device picked it asks nothing and shows nothing: the device runs on its own machine, and this machine's CLIs say nothing about it. Every problem the answer holds shows as an alert in red, then every warning as an alert in amber, each in the answer's own words, under the start's own feedback and above the no-start-hook message. A project without a check hook answers nothing, and nothing shows. Neither a problem nor a warning turns Start off: a Start pressed anyway is refused by the tool the start hook names, in its own words.

### Feedback about the start itself

#### Context

See `## Context`.

#### Business logic

- While the start is in flight the form shows "Starting…".
- A refused start shows its reason as an alert under the editor, in the words it came with: the start hook's own last line when the tool it names refused ("the start hook: …"), "this project has no start hook", "a non-empty prompt is required", or that the device could not be reached. A start that failed without a reason shows "Failed to start the agent.".
- Loading a command [2] or a saved prompt [8] leaves the note described under "Commands load, never start". The note goes when the editor is emptied.
- An error describes the attempt that failed: it is dropped as soon as the user edits the text or loads something.

### The moment an agent starts

#### Context

**Problem**: the agent's tool writes the agent's first file a moment after the start hook answers, and with several agents at once "the running one" does not say which agent was just started.

#### Business logic

The start hook answers the new agent's id. The form hands the shell the typed text (without the Context line), that id and, for a relayed [7] agent, the device's label: the shell selects exactly that agent and shows it at once under the typed prompt until the agent's own files take over, marked with the device it runs on. The editor is then emptied, and the shell empties the Context [11]: it went with that agent. A refused start leaves the text and the Context as they were.
