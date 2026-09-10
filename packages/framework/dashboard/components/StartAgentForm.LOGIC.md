The launcher on a project home [1]: the box where the user says what an agent [2] should do and starts it. It gathers the prompt, the agent Context [3] the agent should look beyond its own project at, and the agent options the user's preferences [4] resolve to, then hands all of it to the daemon as one start. Before that start is spent it says everything it already knows will go wrong or disappoint: a coding agent [5] that cannot run, a model that will not finish cleanly, a merge this repository will not perform by itself.

## Context

**User story**: the user opens a project's project home [1], types a task or loads a preset [6] into the editor, optionally points the agent [2] at other registered projects and at individual files, and presses "Start agent". The agent appears in the dashboard at once and the box is empty again, ready for the next one. The section is headed "Start an agent".

**Problem**: a start spends real things — a branch, a checkout [7] and the account's quota. A start that was never going to work costs all of that and reports it as an agent that dies before it exists. Everything this form can find out beforehand is therefore said above the Start button, in the user's own words, with the fix in the same line.

## Glossary

[1] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[3] the agent Context: the set of other registered projects and individual files an agent is pointed at on top of its own project, carried into its system prompt as one `Context:` line.
[4] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] preset: a canned prompt the user launches from the dashboard.
[7] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[8] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[9] live chat: the user's own messages to a running agent, each continuing the same driver session.
[10] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles. The opposite is attended.
[11] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[12] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[13] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`.
[14] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[15] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[16] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[17] preflight: the check that the chosen driver's coding agent can start an agent, run before a checkout is spent.
[18] CI watch: the sweep that merges the pull requests The Framework opened once their checks pass, and starts a fix agent when a check goes red.
[19] the built-in system prompt: the standing instructions every agent starts with; `SYSTEM.md` is the project's own instructions added on top.
[20] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[21] transparent: an agent started with nothing of The Framework's — the raw coding agent.

## Business logic — TL;DR

- **Typed prompt or preset, and what that changes** - typed text starts a build agent that stays open for the user; a loaded preset starts a prompt agent that runs unattended and ends on its own.
- **The agent Context: other projects and files** - the agent can be pointed at other registered projects and at individual files, never at its own project, and the picker's header counts both kinds.
- **What a Start sends** - the options the user's preferences resolve to, plus the picked device's address; the device's token travels with the start and is never stored.
- **Pre-flight before anything is spent** - the chosen coding agent must be installed, logged in and not running as root, and an armed pull request also wants the GitHub CLI; problems and warnings are printed above the Start.
- **The Haiku warning** - a start on Haiku is told it will end as an unmerged draft pull request, and is never blocked.
- **An armed merge on a repository that refuses GitHub auto-merge** - the user is told before the start that the daemon will do the merging instead, and only while it runs.
- **Feedback about the start itself** - "Starting…", the refusal when the project already has an active agent, the note a loaded preset leaves, and an error that clears as soon as the user edits.
- **The moment an agent starts** - the agent is shown and selected immediately under the typed prompt, marked with the device it runs on, and the editor is emptied.
- **One set of options, shown and sent** - the system prompt preview reads the very options the Start will send, so it can never promise a smaller prompt than the agent gets.

## Business logic

### Typed prompt or preset, and what that changes

#### Context

**User story**: the user either writes a task in their own words and stays with the agent [2] afterwards, or picks one of the canned presets [6] and lets it run to the end by itself, the same way the daemon runs that preset on its own schedule.

#### Business logic

The editor and its control row are the shared composer (`Composer.tsx`); this form owns what pressing Start does with the text.

- Text the user typed starts a build agent [8]. It is attended: it stays open when its work settles [11], so the user can keep talking to it in live chat [9].
- Text loaded from a preset [6] starts a prompt agent [8], and that agent is additionally marked unattended [10]: it answers its own questions with the recommended option, ends when its work settles, and fires its armed handoff [12] on the way out. This is deliberately the same treatment the daemon gives that preset when it starts it on its own, so a preset behaves the same whoever pressed the button.

The submit button reads "Start agent", and "Starting…" while a start is in flight. A second Start while one is in flight does nothing.

### The agent Context: other projects and files

#### Context

**User story**: the agent [2] can reach every repository the user registered, not only the one it works in, so the user ticks the other projects and the individual files it should look at. Those picks become one `Context:` line in the agent's system prompt, which is what narrows its focus.

#### Business logic

The agent Context [3] is a set of paths, shared with the right rail's file tree, and it mixes two kinds of entry: whole registered projects, and individual files relative to the project. Both are collected in one picker beside the editor (`ContextMenu.tsx`).

- The project the launcher belongs to is never offered as a target and never counts: it is already the agent's checkout [7], so ticking it would say nothing.
- Every other registered project is offered. A path in the set that is not a registered project's path is an individual file, listed so it can be seen and removed.
- The picker's header summarizes the picks as counts, projects first, joined by a middle dot: for example "2 projects · 3 files". A kind with nothing picked is left out of the summary, and with nothing picked at all the summary is empty.
- Paths also enter and leave the set through the editor's own `@` and `#` mentions.

### What a Start sends

#### Context

**Business logic story**: which coding agent [5] runs, on which model, where, with which handoff [12] rungs armed, with a browser or without — all of that is the user's preferences [4] resolved for this project. The launcher does not re-derive those rules; it asks for the same resolved answer the daemon uses when it starts an agent [2] itself, so an agent started here and an agent started by the daemon are configured identically.

#### Business logic

A Start carries the agent options that the resolved preferences [4] imply, together with the agent Context [3] paths (the mapping itself is in `../../src/agent-options.ts`).

When the user has picked a device [15] in the composer's "Run on" control, the start additionally carries that device's address, its label and its token, which turns the start into a relay [16]. The token is a secret held by this browser alone: it rides along with the start in memory and is never written to the user's preferences.

### Pre-flight before anything is spent

#### Context

**Problem**: a coding agent [5] that is installed but logged out, or a daemon started with `sudo`, kills every agent [2] before it writes anything, while the daemon goes on spending a branch and a checkout [7] per attempt. The user sees a dashboard waiting for an agent that will never appear, and nothing that names the cause.

#### Business logic

The launcher asks the daemon whether the chosen driver [13] can start an agent at all (the check itself is `../../src/preflight.ts`), and prints what comes back above the Start button:

- Each problem is one line in red: the coding agent's CLI is not installed, or it is not logged in. Each line names its own fix.
- Each warning is one line in amber: the daemon runs as root, or the GitHub CLI is missing or logged out. A warning never blocks the Start.
- The answer is per coding agent, so it is asked again whenever the driver [13] changes: `claude` being logged in says nothing about `codex`.
- The GitHub CLI half is only asked for when the handoff [12] reaches the pull request rung, because that is the only case where the GitHub CLI is used at the end.
- The check is skipped entirely when nothing local will run it: an agent whose location [14] is `actions` runs on a GitHub Actions runner, and an agent aimed at a device [15] runs on that other machine, so neither is probed here. Nothing is printed in those cases.

Problems are shown, never enforced: the user can still press Start.

### The Haiku warning

#### Context

**Problem**: Haiku skips the turn signals that say an agent's work is complete, so an agent [2] started on it with publishing armed ends as an unmerged draft pull request that a human has to finish. The product's stance is to teach and never block: no model floor overriding the user's pick, and no refusal to arm the handoff [12].

#### Business logic

When the model the Start would use is `haiku`, an amber line appears above the Start button, before anything is spent: "Haiku consistently skips the session-finish protocol, so a publishing run ends as an unmerged draft PR and needs hand-holding. Pick Fable for real work — Haiku is best kept for throwaway experiments." The Start itself is unaffected.

### An armed merge on a repository that refuses GitHub auto-merge

#### Context

**Problem**: with the top handoff [12] rung armed, the user expects the pull request to merge itself. A repository that does not allow GitHub's own auto-merge still gets its merge, but from the daemon's CI watch [18] — which merges on green only while the daemon is running. That difference matters and must be said before the agent [2] is started, not discovered later.

#### Business logic

While the handoff [12] is armed all the way to `merge`, and the agent [2] is not aimed at a device [15], the launcher asks whether this project's repository allows GitHub auto-merge. When the answer is a definite no, a muted line appears above the Start: "This repo has GitHub auto-merge disabled, so the daemon merges the PR once its checks pass (merge on green) — handled locally, only while the dashboard is running. For the server-side version, enable **Allow auto-merge** in the repo settings and mark a check (e.g. `build`) as required."

Nothing is shown when the question could not be answered — the GitHub CLI is missing, or the project is not a GitHub repository — rather than crying wolf. Nothing is shown when the merge rung is not armed, and nothing is asked when the agent runs on a device, which merges on that machine.

### Feedback about the start itself

#### Context

**Problem**: the feedback about a Start must sit where the Start button is. A message printed below a tall, expanded picker is past the fold from the button that caused it, and a red error left standing while the user retypes describes an attempt that no longer exists.

#### Business logic

One status line and one error line sit directly under the editor, above the pre-flight [17] lines:

- While a start is in flight the status reads "Starting…".
- A failed start shows its error in red, and it replaces the status line. The daemon's refusal of a second agent [2] on the same project is rephrased for the dashboard as "An agent is already active for this project."; any other failure reads "Failed to start the agent.".
- Editing the prompt clears a standing error, so the red line never outlives the attempt it describes. Emptying the editor also clears the status line.
- Loading a preset [6] clears any error and leaves a note naming the preset: "<name> preset loaded — review or edit, then Start", or, when a typed draft was overwritten, "<name> preset loaded over your draft — undo (⌘Z) brings the draft back".

### The moment an agent starts

#### Context

**User story**: the user presses Start and expects to see the agent [2] at once, already selected, showing the task they typed.

#### Business logic

On a successful start the agent [2] is announced to the rest of the page with the typed prompt, the new agent's id, and — when the start was a relay [16] — the label of the device [15] it executes on, so the agent can be listed and marked "runs on <device>" before it has written anything of its own. The launcher then empties the editor and the prompt it holds. A failed start leaves the text in place, so nothing the user wrote is lost.

### One set of options, shown and sent

#### Context

**Problem**: the preview of the system prompt an agent [2] will run under is worthless if it describes a different configuration than the Start sends. The two are read from the same resolved options rather than each deriving their own.

#### Business logic

The system prompt preview (`SystemPromptDisclosure.tsx`) sits at the start of the composer's resolved-options row, and is fed from the same options the Start will send: whether the agent gets a browser, and the agent Context [3] paths. It also carries the project's own `SYSTEM.md`, which the launcher reads from the daemon for the open project, because that file lives on the daemon's disk and the preview would otherwise under-report the prompt the agent receives.

The preview's two switches write straight to the user's preferences [4]: turning the built-in system prompt [19] off makes agents vanilla [20], and the master off-switch makes them transparent [21].
