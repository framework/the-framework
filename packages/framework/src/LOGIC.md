Everything of The Framework that executes in Node: the `the-framework` command, the daemon [1] it runs in the foreground, the reading of a project's agents [2] from the files their tools write, the starting of an agent through the project's own start hook [3], and the server side of the dashboard. The browser app is the sibling `dashboard/` directory; this directory serves it and answers it. Each source file has a `LOGIC.md` beside it; a `*.test.ts` file's says what its tests cover.

## Context

**User story**: the user runs one command in a repository, and from then on works entirely in the dashboard: they pick one of the project's commands [4] or type what they want, an agent [2] does it in a checkout [5] of its own, stops when it has a question, and publishes its own work. Everything they see about an agent — live, or read back months later — is read from the agent's own files.

**Business logic story**: The Framework runs no agent. Pressing Start runs the project's start hook [3], one shell line the project itself names, and whatever tool that line names begins the agent and owns it from there. The daemon never learns what that tool is: it reads the agent's card [6] and diary [7] off disk to show the agent, writes a line into the agent's inbox [8] when the user says something to it, runs the resume hook [9] when the agent has already ended, and signals the agent's own process to stop it.

## Glossary

[1] the daemon: the one foreground process per machine: serves the dashboard, runs each project's hooks, runs the background sweeps [10]. Ctrl-C closes it; the agents it started go on to their own end.
[2] agent: the unit of work: one task worked by a coding agent [11], in its own checkout [5], on its own branch, keeping a card [6] and a diary [7], publishing its own work when it ends.
[3] start hook: the one shell line under `start` in a project's `.the-framework/hooks.yml`, which the daemon runs when the user presses Start. It is given the prompt, and the coding agent [11] and model the user picked, in its environment, and answers the id of the agent [2] it began as JSON on stdout.
[4] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[6] card: `.the-framework/<id>.json` in an agent's checkout: the agent's own record while it works — what was asked, which coding agent [11], the branch, the process running it, how it ended — written by the tool that runs the agent.
[7] diary: `.the-framework/<id>.jsonl` in an agent's checkout: one line per thing the agent said or did, written by the tool that runs the agent.
[8] inbox: `.the-framework/inbox.jsonl` in an agent's checkout: one JSON line per message or answer, which the agent's session takes when a turn ends.
[9] resume hook: the one shell line under `resume` in a project's `.the-framework/hooks.yml`, given an agent [2] and either the user's words or their answer to the question it stopped on, which continues that agent.
[10] sweep: a background job the daemon runs on its clock.
[11] coding agent: the CLI doing the actual work: Claude Code or Codex.
[12] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, and the lasting record of every agent [2].
[13] quota: the account's subscription allowance, as the coding agent [11] reports it: a session window and a quota week, each with a percentage used.
[14] the Claude web bridge: the daemon's bridge endpoints plus a Chrome extension: carries the question a Claude Code cloud session is parked on into the dashboard, and types the pick back into the session.
[15] spend offset: the user's adjustment of the quota boundary, in percentage points of the week: how far past it unattended work may start. Each project's scheduler holds its own, as `spendOffset` in its state file.
[16] schedule switch: a person's choice, on one machine, whether a scheduled command (a line of the project's `agent-schedule.md`) runs there; the project's scheduler keeps it in its state file, and the schedule line is the default where nobody switched the command.

## Business logic — TL;DR

- **The command** (`bin.ts`, `cli.ts`, `cli-exec.ts`, `index.ts`, `client.ts`) - four options and no verbs: the bare command serves the dashboard and nothing else. It starts no agent [2], so there is no way to begin one from a terminal here. `client.ts` is the one entry the browser may import at run time.
- **Starting and steering an agent** (`project-hooks.ts`, `project-commands.ts`, `open-choices.ts`) - the seven shell lines a project may name for itself (open, close, start [3], resume [9], check, which says what would stop an agent before Start, offset, which sets the spend offset [15] of the project's scheduler, and switch, which sets a schedule switch [16] of the project's scheduler), the project's commands [4] read off its skills folders, and the one rule for which question an agent is still waiting on.
- **The daemon** (`daemon.ts`, `daemon-runtime.ts`, `daemon-services.ts`, `daemon-tick.ts`, `loopback-host.ts`) - one foreground process that serves the dashboard, runs each project's hooks, relays a start to a connected device when the user picked one, and runs every background job on one clock.
- **Files are the seam** (`events.ts`, `event-stream.ts`, `jsonl-tail.ts`, `framework-dir.ts`, `node-fs.ts`, `error-message.ts`, `request-path.ts`, `format-bytes.ts`, `terminal.ts`) - the one vocabulary an agent's diary [7] is read as, the tail that follows a log across the move from a checkout [5] to the `agent-data` branch [12], and the small shared rules for reading, naming and rendering.
- **Projects on this machine** (`registry.ts`, `project.ts`, `install.ts`, `framework-gitignore.ts`, `project-errors.ts`, `project-pass.ts`, `pick-directory.ts`, `project-presets.ts`, `preference-defaults.ts`) - the one user file listing the projects and the preferences, what activating a repository does to it, and the prompts a project saves for itself.
- **Checkouts and what may be removed** (`worktrees.ts`, `agent-locks.ts`) - one checkout [5] per agent under `.branches/`, and one rule for reclaiming it: only what is already on the remote may go.
- **Spending** (`quota-boundary.ts`, `quota-poller.ts`) - where the quota boundary sits in the account's quota [13] week, and the line unattended work stops at (the boundary plus the schedulers' spend offset [15]), read on a timer for the usage panel.
- **Work that happens somewhere else** (`cloud-work.ts`, `cloud-run-state.ts`, `cloud-scratch-refs.ts`, `bridge-browser.ts`, `browser.ts`, `browser-stream.ts`) - a Claude Code cloud session is recognized by the commit its branch descends from, its state is worded the same way on every surface, and the daemon can run its own Chrome so the bridge [14] works with no browser of the user's open.
- **Being told what happened** (`discord-credentials.ts`, `discord-credentials-store.ts`, `update-check.ts`) - the credentials behind the Discord notifications, and whether a newer version of the package is published.
- **Naming what an agent is on** (`driver-names.ts`, `agent-id.ts`, `agent-view.ts`, `tickets.ts`) - the two coding agents [11] a user can pick, how an agent's id and its start time convert into each other, and how an agent reads as a row.
- **The server side and the store** (`dashboard/`, `dashboard-rpc/`, `store/`, `e2e/`) - four subdirectories with their own `LOGIC.md`: what the dashboard is served and answered by, the remote procedures it calls, how a project's agents are read off disk, and the end-to-end stories.
