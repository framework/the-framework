Maps The Framework's status snapshot [1] and event stream [2] onto the `logs` skill's [3] run [4] — a card and a diary — and back, so the daemon can record an agent [5] as a run on the `agent-data` branch [6] when the agent ends, and so every reader of a recorded run — the replay of an ended agent, the tail of one, a continuation's restore — comes back through the one mapping.

## Context

**Business logic story**: the `logs` skill [3] owns what a run's [4] card says to an agent [5] and which kinds of diary line an agent reads; everything else The Framework records about an agent is its own bookkeeping, which the skill stores under one key it never reads. The skill's contract for the card and the diary is in `packages/skill-logs/SKILL.md`.

## Glossary

[1] status snapshot: `.the-framework/agent.json` in an agent's checkout: the agent's current state as one small JSON document, folded from its event stream, so that reading an agent's status never means replaying the stream.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads (its `SKILL.md`, linked into the checkout where the coding agent's harness looks for skills), a command on the agent's PATH, and an API the product calls.
[4] run: only the `logs` skill's record of one agent on the `agent-data` branch: a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said). Never the unit of work.
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[6] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks. Born as an orphan, written through one sync → commit → push cycle.
[7] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[8] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[9] cloud anchor: an empty commit a web agent pushes before its task leaves this machine, unique to the agent: the branch the cloud session later pushes descends from it, which is how the daemon recognises that branch as the agent's (cloud work adoption).
[10] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it). "Handoff level" is a rung of that ladder.
[11] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[12] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[13] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session). On the status snapshot a fourth value, `remote`, marks an agent relayed to a device.
[14] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[15] coding agent: the CLI doing the actual work: Claude Code or Codex.
[16] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[17] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.

## Business logic — TL;DR

- **The card: the skill's fields on top, the rest under `caller`** - eleven fields of the status snapshot [1] are the card's own; every other fact rides under the card's one `caller` key.
- **Back from a card** - `caller` is unfolded into the status snapshot, and the card's own fields win over anything of the same name under `caller`.
- **The diary: four kinds of line are the skill's** - what the agent said, its result, how it ended and what it cost become the skill's four kinds; every other event is written as it is, under its own kind, and read back the same way.

## Business logic

### The card: the skill's fields on top, the rest under `caller`

#### Context

See `## Context`.

#### Business logic

The card carries, from the status snapshot [1]: the agent id [7], the start time and the status always; and, only when known, the end time, the intent, the driver [8], the model, the branch, the pull request (number and URL), the ticket and the cost in US dollars. Everything else the snapshot holds — the last-updated time, the owning process's id and host, the workspace, the session id and session link, the cloud anchor [9], the ready-for-merge flag, the handoff [10] arming, report, skip reason and merge outcome, the pending gate [11], the settled [12] time, the browser preview port, the location [13], the device's [14] label and the agent's kind — rides under the card's one `caller` key, which the skill stores and never prints or reads. The `caller` key is left off when there is nothing to put under it.

### Back from a card

#### Context

See `## Context`.

#### Business logic

Reading a card back unfolds `caller` into the status snapshot [1], and the card's own fields win over anything of the same name found under `caller`. A card whose `caller` carries no last-updated time gets the end time as its last-updated time, or the start time when the run [4] has not ended.

### The diary: four kinds of line are the skill's

#### Context

See `## Context`.

#### Business logic

- Writing: a line of the coding agent's [15] text becomes a `said` line with the text; the final answer of a turn [16] becomes a `result` line carrying the answer's own fields (its text, its session id and whatever else it reports); the end event becomes an `ended` line with the status — `done` when the agent [5] finished well, `stopped` when it was stopped [17], `failed` otherwise — and the detail when there is one; a usage event becomes a `cost` line with the price under `usd`, when it carried one, and the token and turn counts beside it. Every other event, and every other driver [8] event, is written as it is under its own kind.
- Reading: a `said` line becomes the coding agent's text again, a `result` line the turn's final answer, an `ended` line the end event (finished well only when the status is `done`, marked stopped only when it is `stopped`, with its detail), a `cost` line the usage event with the price as its cost. A line of any other kind is an event as written.
