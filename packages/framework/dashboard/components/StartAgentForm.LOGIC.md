The launcher on a project home [1]: the box where the user says what an agent [3] should do, or picks one of the project's commands [2] from its `/` list, and Start. A Start is the project's own start hook [4]: the launcher hands it the prompt, with the Context [11] the user picked on its last line, the coding agent [5] and model the user picked, the publish level [13] when the publish menu [15] says one, the follow-up [12] when the "Post-merge cleanup" box is ticked, and the device [6] when one is picked, and selects the agent the hook answers. A project that has no start hook cannot start an agent from here, and the launcher says what to add. What would stop the agent (a coding agent not installed or logged out) is said before the Start, from the project's check hook [10].

## Context

**User story**: the user opens a project's project home [1], types a task into the editor or picks a command [2] from its `/` list or its Commands menu, reviews it, and presses "Start agent". The agent appears in the dashboard at once and the box is empty again, ready for the next one. The section is headed "Start an agent"; under the heading and above the box, a row of chips [16] says where the Start goes.

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
[13] publish level: how far an agent publishes its work when it finishes: `branch` (push the branch and open no pull request), `pr` (push the branch and open its pull request) or `merge` (push the branch and open its pull request, set to merge on its own once its checks pass). An agent given none publishes only what its prompt asks. Handed to the start hook as `PUBLISH`.
[14] git host provider: the package of the project that declares it provides the git host; The Framework opens and lands pull requests through the command that package declares. A project with none has no git host: no pull request can be opened for it.
[15] publish menu: the part of the launcher's "Auto" menu that lists the publish options: "Nothing", then one option per publish level [13].
[16] chip: a small, bordered, rounded label in muted text: an icon and a few words that say one thing. A chip is either plain or the button of a menu.
[17] local branch: the branch the project's folder has checked out, as this machine has it: its commits that are not pushed are included, and edits that are not committed are not.

## Business logic — TL;DR

- **Commands load, never start** - the commands [2] are in the editor's `/` list and the Commands menu, not buttons; picking one loads `/<name> ` into the editor for review, and the form leaves a note saying so.
- **The Context picker** - a "Context" menu on the control row lists the other registered projects to tick and the picked files to remove; `@`/`#` mentions and the right rail's file tree feed the same Context [11].
- **The row of chips** - above the box, under the "Start an agent" heading: the "Run on" chip [16], which reads "This machine" or the picked device's [6] label and opens the "Run on" menu, then a plain chip with a folder icon and the project's name, then the "start from" chip, which reads the branch the agent starts from and opens a menu to pick it; the project's chip is absent until the name is known, and the "start from" chip is absent wherever the pick would not be obeyed.
- **Where the agent starts** - the project's main branch, or the user's local branch [17], picked on the "start from" chip and saved per project; the local pick sends the branch's name with the Start, the main pick sends none; no chip, and no branch sent, when the project's start line does not pass the branch on, when the repository has no remote, when the folder is on no branch, and when a device [6] is picked.
- **The "Auto" menu** - under the box at the left, with the coding-agent-and-model select at the right: what the agent does by itself when it finishes; it holds the publish menu [15] and the "Post-merge cleanup" box, its button reads what is picked ("Auto: Open PR · cleanup"), and a project offered neither has no "Auto" menu.
- **The publish menu** - in the "Auto" menu: "Nothing", "Publish branch", "Open PR", "Merge on green"; the check is on the user's saved setting, "Nothing" when none is saved, and a pick writes that setting; a project with no git host provider [14] is offered "Nothing" and "Publish branch" only, and a saved pull request option is shown and started there as "Publish branch"; a project whose repository has no remote is offered no option, and a Start sends no publish level.
- **The "Post-merge cleanup" box** - in the "Auto" menu, under the publish menu, only when the project has the `post-merge-cleanup` command [2] and no device is picked; ticked from the user's saved setting, and a click writes that setting.
- **What a Start sends** - the text with the Context on one `Context:` line at its end, the coding agent [5] and the model when the user picked them, the publish level [13] when the publish menu's option is one, `/post-merge-cleanup` as the follow-up [12] when the box is offered and ticked, and the picked device's address and token; nothing else.
- **A project with no start hook** - Start is off and the form says which line to add to which file; a picked device lifts the block, since the device runs its own hook.
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

### The row of chips

#### Context

**User story**: before typing a task, the user reads above the box where the agent [3] will start: on which machine, in which project, and from which branch.

**Problem**: where an agent runs was an icon inside the box, which said nothing in words, and the project was named only at the top of the page. The row is also where more of the Start's facts go later, so it must take one more chip without moving anything.

#### Business logic

The form shows the heading "Start an agent", then the row of chips [16], then the box. The composer draws the row (`Composer.tsx`): the "Run on" chip first, then the chips this form hands it.

- The "Run on" chip reads "This machine", or the label of the device [6] picked, and opens the "Run on" menu (`RunOnMenu.tsx`). At the launcher the "Run on" pick is this chip only: it is not inside the box.
- The project's chip is plain, not a button and not a menu: a folder icon and the name of the project the agent starts in. The name is the one the shell read for the open project and hands down (`ProjectHome.tsx`). Until the shell knows it, the form hands no project chip: no other name, and no project id, is shown in its place. The row is asked for all the same, so the "Run on" chip is there from the start, and since the row's height is fixed the project's chip appearing moves nothing.

The project's chip is the same whether the agent runs on this machine or on a device.

- The "start from" chip is the row's last: a branch icon, the branch the agent starts from, and a menu to pick it (`StartFromMenu.tsx`); see "Where the agent starts" below. Being the last chip, it has nothing beside it to push when it appears or when its words change. It is drawn only once the project's chip is (the name landing after it would push it) and once the user's preferences [9] have been read (drawn before, it would read the main branch and then change to the saved pick).

### Where the agent starts

#### Context

**User story**: the user has commits on a branch of their own that are not pushed, and wants the agent to continue from them. They pick "My local branch" on the chip above the box; the launcher remembers it for this project.

**Problem**: the pick is carried out by the project's start line, which is written once into the project's hooks file and kept. A line written before the pick existed, or a person's own, may not pass the branch on, and a branch of this machine names nothing on another machine. A chip shown in either case would be a pick that silently does nothing.

#### Business logic

The launcher's read of the project (`lib/use-project-launcher.ts`) names the two branches an agent can start from: the project's main branch (the default branch of its remote) and the user's local branch [17]. The daemon names them only when the project's start line passes the branch on, the repository has a remote, and the project's folder is on a branch (`dashboard-rpc/projects.ts`). The chip is drawn when the read names them and no device [6] is picked in "Run on"; otherwise there is no chip.

The pick in force is the one saved for this project in the user's preferences [9] (`startFrom`, which names the projects set to the local branch): the local branch for a project in it, the main branch for any other. Picking "My local branch" adds the project to it and picking the main branch takes it out; another project's pick is left as it is.

A Start sends the local branch's name, as the launcher read it and as the chip shows it, when the chip is drawn and the local branch is the pick; the daemon hands it to the start hook [4] as `BASE`, and the agent's own branch starts from that branch as this machine has it. In every other case the Start names no branch, and the agent starts from the project's main branch, fetched first: the main branch is the pick, or there is no chip (a saved local pick then sends nothing, and stays saved). The agent's page says which branch it was started from, in its "Session set up" line (`SessionLine.tsx`).

### The "Auto" menu

#### Context

**User story**: the user types a task and wants to say, before Start, what the agent does by itself once it is done, and to read it back at a glance on every next Start without opening anything.

**Problem**: a choice kept inside a shut menu is hidden: the user would press Start without seeing that the agent is set to open a pull request and merge it. And the choices are about the end of the agent's work, not about the prompt, so they do not belong among the box's own controls.

#### Business logic

The form hands the composer the "Auto" menu (`AutoMenu.tsx`), which the composer draws in the row under its box, at the left; the coding-agent-and-model select is at the right of the same row (`Composer.tsx`). The menu holds the publish menu [15] and the "Post-merge cleanup" box, both below. Its button reads what is picked, for example "Auto: Open PR · cleanup". A project offered neither (no remote, and no `post-merge-cleanup` command [2]) has no "Auto" menu, and the row holds the select alone. The menu is disabled while a start is in flight.

### The publish menu

#### Context

**User story**: the user types a task and wants to say, before Start, what happens to the work when the agent is done: nothing published, the branch pushed and left for them, a pull request opened, or the pull request set to merge once its checks pass. They pick once; every next run keeps the pick until they change it.

**Problem**: nothing in a typed prompt says how far to publish, and the agent publishes its own work: with nobody saying it, an agent commits and stops. A project with no git host provider [14] can open no pull request, a project whose repository has no remote can publish nothing, and a device [6] runs its own project, which this launcher does not read.

#### Business logic

The publish menu [15] lists four options in this order: "Nothing" (`nothing`), "Publish branch" (`branch`), "Open PR" (`pr`) and "Merge on green" (`merge`); the options and their rules are `../../src/publish-levels.ts`'s. The option in force is the one the user's preferences [9] hold as `publish`, and "Nothing" when none is saved: it carries the check mark, and the "Auto" button names it. Picking an option writes that preference at once, so the pick is every next Start's default, in every project.

A project with no git host provider [14], as the launcher read it, is offered "Nothing" and "Publish branch" only. A saved "Open PR" or "Merge on green" is shown there as "Publish branch" and a Start sends `branch`; the saved preference stays as it is. A project whose repository has no remote, as the launcher read it, is offered no option at all: the "Auto" button names no option, and a Start sends no publish level whatever is saved. While the launcher's read of the project has not answered, and when a device [6] is picked in "Run on", all four options are offered: the daemon that starts the agent holds a `pr` or `merge` level to `branch` where its own project has no git host provider (`../../src/daemon-runtime.ts`).

The option in force is sent with the Start as its publish level [13] (below), and the tool the start hook [4] names turns the level into one sentence after the prompt.

### The "Post-merge cleanup" box

#### Context

**User story**: the user wants every agent's work cleaned up before it merges: its maintainability and security follow-ups queued and the project's knowledge files brought up to date, in the same pull request. They tick "Post-merge cleanup" once; from then on each Start is followed by a second agent running `/post-merge-cleanup` on the first one's branch, and the pull request merges only after it.

**Problem**: the follow-up is a project command [2]: a project without it has nothing to follow up with, and a device [6] runs its own project, whose commands this launcher does not read.

#### Business logic

The "Auto" menu holds a checkbox labelled "Post-merge cleanup", under the publish menu [15], only when the project's commands (as the launcher read them) include one named `post-merge-cleanup` and no device [6] is picked in "Run on"; otherwise there is no box. It is ticked when the user's preferences [9] say `postMergeCleanup` is on, and unticked when it is off or was never set; ticked, the "Auto" button ends with " · cleanup". Clicking it writes that preference, the same one Settings → Agent → "Post-merge cleanup" shows, so its state is every next Start's default, in every project.

### What a Start sends

#### Context

See `## Context`.

#### Business logic

The editor and its control row are the shared composer (`Composer.tsx`); this form owns what pressing Start does with the text. The submit button reads "Start agent", and "Starting…" while a start is in flight. A second Start while one is in flight does nothing.

A Start sends the project, the text, and:

- the Context [11], when anything is picked, as one line at the end of the text: the text's trailing whitespace trimmed, a blank line, then `Context: ` and the picked paths joined by ", " (`lib/use-context-set.ts`). At the end, because a command's text must begin with `/<command>`;

- the coding agent [5] the user picked and the model they picked, read off their preferences [9]. One that was never picked is not sent, so the project's start hook [4] applies its own default;
- the publish level [13] of the option in force in the publish menu [15]: `branch`, `pr` or `merge`. "Nothing" sends no level, and so does a project offered no option, so the start hook is handed none and the agent publishes only what the prompt asks;
- the name of the user's local branch [17], when the "start from" chip is drawn and the local branch is the pick; nothing otherwise, so the agent starts from the project's main branch;
- `/post-merge-cleanup` as the follow-up [12], when the box is offered (the project has the command and no device is picked) and the preference is on. A preference left on sends nothing in a project without the command, or with a device picked;
- when a device [6] is picked in "Run on": that device's URL, token and label, so the local daemon relays [7] the start to it. The token travels with this one start and is never stored by the daemon.

Whether the text is a command, a saved prompt [8] or the user's own words makes no difference to what is sent: it is one prompt. The Context goes the same way whether the agent runs here or on a device.

### A project with no start hook

#### Context

**Problem**: without a `start:` line there is nothing that could run the agent. Letting the user press Start only to read a refusal wastes the task they typed.

#### Business logic

Once the project is read and it has no start hook [4], and no device [6] is picked, the submit stays disabled — by click and by keyboard — and the form shows, as an alert: "This project has no start hook. Add a `start:` line to `.the-framework/hooks.yml`." It names no command to run: a project gets its lines when it is added, and a command typed with `npx` in a project with nothing installed would download whatever package holds that name.

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
