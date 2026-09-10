Everything of The Framework that runs in Node: the `the-framework` command, the daemon [1] it runs in the foreground, the life of one agent [2] from its opening prompt to its handoff [3], the policies that decide what unattended [4] work may spend, and the server side of the dashboard. The browser app is the sibling `dashboard/` directory; this directory serves it and answers it. Each source file has a `LOGIC.md` beside it; a `*.test.ts` file's says what its tests cover. `prompts.generated.ts` is not written by hand and has none: the build compiles it from `prompts/**/*.md`, and the markdown is the only source of truth.

## Context

**User story**: the user runs one command in a repository, and from then on works entirely in the dashboard: they state what they want, an agent [2] does it in a checkout [5] of its own, stops only for decisions a human must make, and hands the result off as a pull request. When they walk away, the daemon [1] keeps spending what is left of the account's quota [6] on the project's own backlog, and stops before it eats into the quota the user will want.

**Business logic story**: two kinds of process live here. The daemon is one per machine; every agent is a process of its own that the daemon spawns with one file describing the whole run. They never call each other: an agent appends what it does to a file, the daemon tails that file to the browser, and steering flows back through a second file. Every surface — the dashboard live, a replay months later, the terminal — is therefore a projection of the same record.

## Glossary

[1] the daemon: the one foreground process per machine: serves the dashboard, starts agents, runs the sweeps. Ctrl-C closes it and every agent it is running.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[4] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[5] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[6] quota: the account's subscription allowance, as the coding agent reports it: a session window and a quota week, each with a percentage used.
[7] coding agent: the CLI doing the actual work: Claude Code or Codex.
[8] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[9] gate: a question with options at which an agent stops and waits for an answer; when nobody can answer, the recommended option is taken.
[10] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout.
[11] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[12] sweep: a background job the daemon runs on its clock.
[13] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[14] preset: a canned prompt the user launches from the dashboard.
[15] routine: a preset the daemon fires on its own on a schedule.

## Business logic — TL;DR

- **The command and the two processes it starts** (`bin.ts`, `cli.ts`, `cli-exec.ts`, `agent-spec.ts`, `index.ts`, `client.ts`) - four options and no verbs: the bare command serves the dashboard, and one private option runs a single agent [2] from the spec file the daemon [1] wrote for it, which is why an agent's configuration is never a command line. `client.ts` is the one entry the browser may import at run time.
- **The life of an agent** (`agent.ts`, `await-gate.ts`, `turn-gate.ts`, `todo-loop.ts`, `agent-messages.ts`, `agent-telemetry.ts`, `gate-keepalive.ts`, `agent-id.ts`, `agent-view.ts`, `usage.ts`) - frame the coding agent [7], send the opening prompt, read the turn's final message for everything The Framework learns, honor each gate [9], work the agent queue, take the user's messages, and end with a verdict.
- **What an agent is told** (`system-prompt.ts`, `system-prompt-file.ts`, `prompt-template.ts`, `preset-catalog.ts`, `preset-prompt.ts`, `presets.ts`, `preset-registry.ts`, `project-presets.ts`, `tickets.ts`) - the built-in system prompt, the project's own `SYSTEM.md`, the protocols and the preset [14] catalog composed into one system channel, with the user's text rendered into its own slot.
- **The driver seam** (`driver-cli.ts`, `driver-names.ts`, `target-driver.ts`, `agent-location.ts`, `fake-script.ts`) - which coding agent [7] does the work and where it runs are two separate choices; together they pick one driver [8] implementation, and `web` is the one location [13] whose work leaves this machine.
- **Files are the seam** (`events.ts`, `event-stream.ts`, `control.ts`, `jsonl-tail.ts`, `framework-dir.ts`, `node-fs.ts`, `error-message.ts`, `request-path.ts`, `runtime-keys.ts`, `session-link.ts`, `format-bytes.ts`, `terminal.ts`) - one vocabulary of events an agent appends to its own file and everything else projects, one file steering flows back through, and the small shared rules for reading, naming and rendering them.
- **The daemon** (`daemon.ts`, `daemon-runtime.ts`, `daemon-services.ts`, `daemon-tick.ts`, `loopback-host.ts`) - one foreground process that serves the dashboard, gives each agent a checkout [5] and a process, and runs every background job on one clock.
- **Projects on this machine** (`registry.ts`, `project.ts`, `install.ts`, `layout.ts`, `framework-gitignore.ts`, `project-errors.ts`, `project-pass.ts`, `pick-directory.ts`, `config.ts`, `config-layers.ts`, `preference-defaults.ts`, `agent-options.ts`) - the one user file listing the projects and the preferences, what activating a repository does to it, the per-repository defaults that travel with the code, and the order in which the layers of a decision are resolved.
- **Checkouts and what may be removed** (`worktrees.ts`, `merged-worktrees.ts`, `agent-locks.ts`) - one checkout [5] per agent under `.branches/`, and one rule for reclaiming it: only what is already on the remote may go.
- **Spending** (`quota-boundary.ts`, `quota-poller.ts`, `auto-pm.ts`, `maintenance.ts`, `routine-locks.ts`, `handoff-level.ts`, `on-before-mergeable-prompt.ts`) - the share of the quota [6] week that may be spent by now, what the daemon starts under it, the routines [15] it rotates through, the lock that keeps a routine to one machine, and the ladder a finished agent publishes itself by.
- **Getting the work out** (`ci-watch.ts`, `closing-keywords.ts`, `update-check.ts`) - the pull requests The Framework opened are merged once their checks pass and fixed by an agent when they go red, and closing keywords in an agent's text are defused so a pull request closes only what it should.
- **Work that runs somewhere else** (`cloud-work.ts`, `cloud-run-state.ts`, `cloud-scratch-refs.ts`, `bridge-browser.ts`) - a Claude Code cloud session is recognized by the commit its branch descends from, its state is worded the same way on every surface, and the daemon can run its own browser so the bridge works with no Chrome of the user's open.
- **The agent's browser** (`browser.ts`, `browser-stream.ts`) - a real Chrome an agent can drive, whose page the dashboard shows live and hands to the user at a login wall.
- **Being told what happened** (`preflight.ts`, `discord-credentials.ts`, `discord-credentials-store.ts`) - what is checked before a checkout is spent, and the credentials behind the Discord notifications.
- **The server side and the store** (`dashboard/`, `dashboard-rpc/`, `store/`, `driver/`, `e2e/`) - five subdirectories with their own `LOGIC.md`: what the dashboard is served and answered by, the remote procedures it calls, an agent's persisted record, the product's own cloud-session driver, and the end-to-end stories.
