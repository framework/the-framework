The product itself, published as the npm package `framework`: one command, `the-framework`, that runs a daemon [1] in the foreground, serves the dashboard [2] the user works in, and does the background work that keeps a project moving while nobody is at the keyboard. The daemon starts no agent of its own: an agent [3] is begun by the project's own start hook [4], and the dashboard is a projection of the files that agent writes. Ctrl-C closes the daemon; the agents it started go on to their own end.

## Context

**User story**: the user installs one package, runs one command inside a repository, and from then on works in a browser: they pick one of the project's own commands [5] or type what they want, an agent [3] does it in a checkout [6] of its own, asks only when a decision is theirs to make, and hands the result off as a pull request. Nothing they own is touched, and nothing is configured to get there.

**Business logic story**: the package is a daemon and a browser app, and neither of them runs a coding agent [12]. Pressing Start runs one shell line the project itself names; whatever tool that line names begins the agent [3] and owns it. That tool keeps the agent's card [7] and diary [8] in the agent's checkout [6] and copies both onto the `agent-data` branch [9] when the agent ends. The daemon reads those files to show the agent, and writes into the agent's inbox [10] — or runs the project's resume hook [11] — when the user says something to it. Because the record is the seam, watching an agent live and reading it back months later are the same projection of the same lines, and The Framework never learns which tool did the work.

## Glossary

[1] the daemon: the one foreground process per machine: serves the dashboard, runs each project's hooks, runs the sweeps.
[2] the dashboard: the browser app the daemon serves — the product's only user interface.
[3] agent: the unit of work: one task worked by a coding agent [12], in its own checkout [6], on its own branch, keeping a card [7] and a diary [8], publishing its own work when it ends.
[4] start hook: the one shell line under `start` in a project's `.the-framework/hooks.yml`, which the daemon runs when the user presses Start. It is given the prompt, and the coding agent [12] and model the user picked, in its environment, and answers the id of the agent [3] it began as JSON on stdout.
[5] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[6] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[7] card: `.the-framework/<id>.json` in an agent's checkout: the agent's own record while it works — what was asked, which coding agent [12], the branch, the process running it, how it ended — written by the tool that runs the agent.
[8] diary: `.the-framework/<id>.jsonl` in an agent's checkout: one line per thing the agent said or did, written by the tool that runs the agent.
[9] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, and the lasting record of every agent [3].
[10] inbox: `.the-framework/inbox.jsonl` in an agent's checkout: one JSON line per message or answer, which the agent's session takes when a turn ends.
[11] resume hook: the one shell line under `resume` in a project's `.the-framework/hooks.yml`, given an agent [3] and either the user's words or their answer to the question it stopped on, which continues that agent.
[12] coding agent: the CLI doing the actual work: Claude Code or Codex.
[13] widget: a browser module one of a project's packages brings to the dashboard, named by the package's `exports["./dashboard"]`; it adds pages to the dashboard and reads its data through its own package's command.

## Business logic — TL;DR

- **The dashboard is a projection, never a peer** - an agent [3] writes its card [7] and diary [8] in its own checkout [6] and talks to nothing; the daemon [1] tails those files to the browser, so every surface shows the same record and an agent working on another machine needs only its lines carried home.
- **The Framework names no tool** - Start runs one shell line the project itself names, and the agent [3] belongs to whatever that line begins; The Framework ships no prompt text and no runner of its own.
- **A package brings its own pages** - a dependency of a project whose package exports `./dashboard` is a widget [13]: the dashboard shows its pages and sidebar rows, loads it at run time and lets it run only its own package's command for its data, so The Framework names no skill's page either; the package publishes `framework/widget` (types) and `framework/widget.css` for widget authors.
- **The CLI is four options and no verbs** - the bare command serves the dashboard [2]; only the port and the bind address, plus help and version, are flags, and every decision about an agent [3] is made in the dashboard.
- **Everything that executes in Node** (`src/`) - the command, the daemon [1], the reading of a project's agents, the hooks, and the server side of the dashboard [2].
- **The browser app** (`dashboard/`) - the single page the daemon serves: a pure projection of the files the agents write, reading over the daemon's calls and one live event stream, and steering agents back through the same daemon.
- **The build steps** (`scripts/`) - shipping the bridge extension inside the package, and running the package's test suite in isolation.

## Business logic

### The dashboard is a projection, never a peer

#### Context

**Problem**: an agent [3] is its own process, begun by a tool The Framework does not know, and it may run on another machine entirely. If the dashboard [2] read an agent by talking to it, every tool would need a channel of its own, and a finished agent would have nothing left to show.

#### Business logic

The tool that runs an agent writes the agent's card [7] and diary [8] under `.the-framework/` in the agent's own checkout [6], and talks to nothing. The daemon [1] tails those files and pushes each new line to the browser. Steering goes back the same way: what the user says to an agent while it works becomes a line in the agent's inbox [10], which the agent's tool reads when a turn ends; once the agent has ended, the project's resume hook [11] continues it instead. Stopping an agent is a signal to the process its card names. Nothing else connects the two.

So a working agent and a finished one render identically, and an agent whose machine is elsewhere needs only its lines carried home. The lasting record outlives the checkout: the agent's tool copies its card and diary onto the project's `agent-data` branch [9] when the agent ends, which is also how a second machine can list what this one did.

### The Framework names no tool

#### Context

**User story**: the user's project decides how its agents are run — which tool, which flags, which sandbox. The Framework should show the work and get out of the way.

**Problem**: The Framework used to run the coding agent [12] itself, which meant it also owned the prompt text, the questions, the model and the publishing ladder. Every project got one opinion, and a project that wanted another had nothing to change.

#### Business logic

Pressing Start runs the project's start hook [4]: one shell line from the project's own `.the-framework/hooks.yml`, given the prompt and the user's picks in its environment, answering the id of the agent [3] it began. A project with no such line cannot start an agent from the dashboard, and the dashboard says so instead of offering a button that would do nothing.

What the user may ask for is the project's own commands [5] — its skills, read from the folders the coding agents [12] already read them from — plus free text and whatever prompts the user has saved. The Framework ships no prompt text at all.

### The CLI is four options and no verbs

#### Context

**User story**: the user should not have to learn a command line to run agents. They run one command in a repository and do everything else in the dashboard [2].

#### Business logic

The bare command serves the dashboard in the foreground. The only options are the two things a browser cannot ask for — the port and the bind address — plus help and version. Binding to an address that is not loopback exposes the daemon to the network, so it generates a shared token, carries it in the printed URL, and refuses every request without it.

There is no option that begins an agent [3]: the command cannot start one at all. Starting an agent, choosing its coding agent [12] and model, and choosing whether it runs here or on a connected device, are all dashboard decisions, and the agent itself belongs to the tool the project's start hook [4] names.
