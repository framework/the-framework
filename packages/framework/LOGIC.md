The product itself, published as the npm package `framework`: one command, `the-framework`, that runs a daemon [1] in the foreground, serves the dashboard [2] the user works in, spawns each agent [3] as its own process, and does the background work that keeps a project moving while nobody is at the keyboard. Ctrl-C closes the daemon and every agent it is running.

## Context

**User story**: the user installs one package, runs one command inside a repository, and from then on works in a browser: they state what they want built or fixed, an agent [3] does it in a checkout [4] of its own, asks only when a decision is theirs to make, and hands the result off as a pull request. Nothing they own is touched, and nothing is configured to get there.

**Business logic story**: the package is a daemon and a browser app that never speak directly. An agent appends what it does to a file in its own checkout; the daemon tails that file to the browser; steering flows back through a second file. Because the record is the seam, watching an agent live and reading it back months later are the same projection of the same lines — and a terminal, a replay and the dashboard cannot disagree.

## Glossary

[1] the daemon: the one foreground process per machine: serves the dashboard, starts agents, runs the sweeps.
[2] the dashboard: the browser app the daemon serves — the product's only user interface.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] the agent queue: the priority-ordered list of what agents will work on next, kept on the `agent-data` branch.

## Business logic — TL;DR

- **The dashboard is a projection, never a peer** - an agent [3] writes what it does to a file and talks to nothing; the daemon [1] tails that file to the browser and appends steering to a second file the agent's process tails, so every surface shows the same record and an agent running elsewhere needs only its lines carried home.
- **The CLI is four options and no verbs** - the bare command serves the dashboard [2]; only the port and the bind address, plus help and version, are flags, and every other decision about an agent is made in the dashboard and travels to it as one file.
- **Everything that runs in Node** (`src/`) - the command, the daemon [1], the life of an agent [3] from its opening prompt to its handoff, the policies that bound unattended spending, and the server side of the dashboard [2].
- **The browser app** (`dashboard/`) - the single page the daemon serves: a pure projection of the files the daemon and its agents write, reading over the daemon's calls and one live event stream, and steering agents back through the same daemon.
- **Everything an agent is told** (`prompts/`) - every prompt The Framework sends a coding agent [5], as markdown: the built-in system prompt, the protocols it answers through, the presets behind the launcher's buttons, and the fallbacks for an agent working outside a checkout [4] The Framework made. The markdown is the only source of truth; a prompt change is a readable diff.
- **The build steps** (`scripts/`) - compiling that markdown into the strings the code imports, and running the package's two test suites.

## Business logic

### The dashboard is a projection, never a peer

#### Context

**Problem**: an agent [3] runs in its own process, and may run on a GitHub Actions runner, in a cloud session, or on another machine entirely. If the dashboard [2] read an agent by talking to it, every one of those cases would need a channel of its own, and a finished agent would have nothing left to show.

#### Business logic

An agent writes what it does to `.the-framework/events.jsonl` in its own checkout [4] and never talks to anything. The daemon [1] tails that file and pushes each new line to the browser; the browser sends steering back to the daemon, which appends it to `.the-framework/control.jsonl`, which the agent's process tails. Nothing else connects the two.

So a running agent and a finished one render identically, the terminal shows the same story as the browser, and an agent whose machine is elsewhere needs only its lines carried home. The lasting record of a run outlives the checkout: it is written to the project's `agent-data` branch when the agent ends, which is also how a second machine can list what this one did.

### The CLI is four options and no verbs

#### Context

**User story**: the user should not have to learn a command line to run agents. They run one command in a repository and do everything else in the dashboard [2].

#### Business logic

The bare command serves the dashboard in the foreground. The only options are the two things a browser cannot ask for — the port and the bind address — plus help and version. Binding to an address that is not loopback exposes a process spawner to the network, so it generates a shared token, carries it in the printed URL, and refuses every request without it.

Starting an agent [3], choosing its coding agent [5], its model, where it runs and how far it publishes itself are all dashboard decisions. The daemon [1] hands a spawned agent one file describing the whole run, so an agent's configuration is never also a human-facing flag surface. One private option reads that file, which is how the daemon starts an agent process at all.
