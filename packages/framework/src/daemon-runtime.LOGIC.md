What the daemon does for a project: starting an agent [1] through the project's own start hook [2], adding a project while the dashboard runs, and relaying [3] an agent to and from a device [4]. The daemon runs no agent itself and holds nothing about one.

## Context

**User story**: the user presses Start on a project's launcher and an agent [1] appears in the agent list within moments, working in its own checkout on its own branch; two Starts on the same project run side by side. A Start that cannot work says why. The user picks a saved device [4] as the target and the agent runs there, shown here like a local one. The user adds a repository from the dashboard and it appears in the project list.

**Business logic story**: the daemon names no tool. What starts an agent is one shell line the project's own `.the-framework/hooks.yml` names; the agent it begins is that tool's process, keeps its own record (card and diary [5]) in its own checkout, and outlives the daemon. So there is no map of live agents here, no cap, nothing to stop at shutdown and nothing to recover at boot.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] start hook: the one shell line under `start` in a project's `.the-framework/hooks.yml`, which the daemon runs when the user presses Start; it answers the id of the agent it began as JSON on stdout.
[3] relay: running an agent on a device: the local daemon forwards the start, streams the events back and forwards steering, so the agent renders like a local one.
[4] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[5] card / diary: an agent's record in two shapes, defined by The Framework (`store/runs.ts`): the card `<id>.json` (what was asked, the branch, the pull request, how it ended, what it cost) and the diary `<id>.jsonl` (what the agent said, one line per event). While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs it; a finished agent's are what the project's runs provider answers.
[6] hooks: the shell lines a project's own `.the-framework/hooks.yml` names: `open` and `close` lists run when the dashboard opens and closes, and the `start`, `resume`, `check`, `offset` and `switch` lines.
[7] home project: the directory the daemon was started in; a request that names no project, or names its id, addresses it without a registry lookup.

## Business logic — TL;DR

- **Which project a request is for** - no project id, or the home project's [7], is the daemon's own directory; any other id is looked up in the registry.
- **Starting an agent** - the project's start hook [2] is run with the prompt, the user's picks and the follow-up when there is one; the id it answers is the Start's answer; a refusal is its words; the project's checkouts are read again on the next look, so the new agent's checkout is found at once.
- **Starting an agent on a device** - the start is forwarded to the device, which runs its own project's hook; a memory-only row stands for the agent here.
- **Adding a project** - the directory is checked, installed and registered, and its `open` hooks [6] run.
- **Relaying a device's agent** - the events of an agent relayed from a device stream from memory; an agent a device relayed here is tailed off its diary [5]; one whitelisted read or write is run against the home project for the relaying daemon.

## Business logic

### Which project a request is for

#### Context

See `## Context`.

#### Business logic

A request with no project id, or with the home project's [7] id, addresses the directory the daemon was started in. Any other id is looked up among the registered projects; an id nobody registered is no project.

### Starting an agent

#### Context

**User story**: the user types a prompt, or loads one of the project's commands, picks Claude Code or Codex and a model, and presses Start.

**Problem**: the daemon must not know which tool runs agents, yet the dashboard needs the new agent's id at once to show it.

#### Business logic

A Start for an unknown project is refused with "unknown project: <id>". Otherwise the project's start hook [2] is run in the project, with the prompt in `PROMPT` and, only when the user made the pick, the coding agent in `DRIVER` and the model in `MODEL`, and, only when the Start carries one, the follow-up in `THEN` (the launcher's "Post-merge cleanup" box: a fresh agent on the branch before the pull request merges); how the line is run, bounded and read is `project-hooks.ts`'s. The id the line answers is returned as the started agent's id, and what The Framework kept of the project's checkouts (the branches provider's list, shared for a few seconds, `store/branches.ts`) is forgotten, so the new agent's checkout is found on the next look rather than a few seconds later. When the project has no start line the Start is refused with "this project has no start hook"; when the line fails, its own last line on stderr is the refusal. Nothing else happens here: the daemon allocates no checkout, holds no slot for the agent, applies no cap (a person's click is the brake) and never stops the agent, which goes on after the dashboard closes.

### Starting an agent on a device

#### Context

**User story**: the user picks a saved device [4] under "Run on" and presses Start; the agent runs on that machine and shows here.

#### Business logic

When the Start names a device [4], the prompt and the picks are forwarded to that device's daemon, with the device itself taken out of what is forwarded so the device never relays [3] onward; the device starts the agent in its own home project [7], through that project's own start hook [2]. When the device answers an id, a row for the agent is kept in memory only: running, started now, marked as remote, carrying the prompt and the device's label. That row is what the agent list shows and what a reloaded dashboard re-opens; it is never written to disk. A device that refuses, or cannot be reached, gives its refusal as the Start's answer (the wording is `dashboard/remote-run.ts`'s).

### Adding a project

#### Context

**User story**: the user adds a repository from the dashboard's Add-project dialog.

#### Business logic

The path is resolved against the daemon's directory. A path that does not exist or is not a directory is refused with "path does not exist or is not a directory: <path>". The repository is installed (`install.ts`; an already installed one is a success), then registered with the current time; a registration that fails does not fail the add. Then the project's `open` hooks [6] run, as they would have at boot, their outcome logged. The answer says whether the repository was already installed.

### Relaying a device's agent

#### Context

See `## Context`; the relay's [3] wire is `dashboard/remote-run.ts` and `dashboard/relay-endpoints.ts`.

#### Business logic

For an agent this daemon relays from a device [4], the dashboard's live feed reads the in-memory stream of that agent's events; for any other agent there is no such stream and the feed tails the agent's diary [5] on disk. The lookup of which device an agent runs on outlives the agent's event stream, so a finished remote agent's later actions still reach its device. In the other direction, for a daemon that relayed an agent here, the agent's diary in the home project [7] is tailed across its move from the checkout to the `agent-data` branch, each line turned into the event the dashboard draws; and one whitelisted read or write (`dashboard-rpc/relay-dispatch.ts`) is run against the home project, whatever project id the caller sent. Disposing of the runtime lets go of the relayed streams.
