How The Framework reads, and changes, a project's finished agents [1]: through the runs provider [2], a command one of the project's own packages declares, never through a package The Framework knows. It also owns the shape of what that command answers: the card and the diary [3].

## Context

**User story**:
- The user sees every agent of a project in the history, working and finished, including those other machines recorded; opens a finished agent and reads everything it said; opens a pull request or deletes an agent from its page.
- A project that installed no logs skill still shows its working agents; a finished agent is gone once its checkout is removed.

**Business logic story**: The Framework names no skill. A project picks the package that keeps its finished agents by listing it as a dependency; that package says, in its own package.json, which of its commands answers for them (`"framework": { "runs": "logs" }` for the `logs` skill's package). Swap it for another package that answers the same command line and prints the same shapes, and nothing in The Framework changes.

**Problem**: the dashboard reads the same list many times per second across its polls, and every read of the provider is a process.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[2] runs provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's finished agents, in its own package.json under `"framework": { "runs": "<command>" }`.
[3] card / diary: an agent's record in two shapes. The card, `<id>.json`: the agent id, the start time, the status, and when known the end time, the intent, the coding agent, the model, the branch, the pull request (its number and link), the ticket and the cost, plus one key, `caller`, where the program that ran the agent keeps its own bookkeeping (its process id, host, session id and so on). The diary, `<id>.jsonl`: one JSON object per line, each with a `kind`. The tool that runs an agent writes both in the agent's checkout while it works; once the agent is finished, the runs provider [2] answers them.
[4] status: how an agent stands: `running`, `done`, `stopped`, `failed`, or `waiting` (it ended on a question, and the answer resumes it).

## Business logic — TL;DR

- **Which command provides** - the first of the project's dependencies, in its package.json's order, that declares a runs provider [2] naming one of its own commands; no dependency declares one, the project has no finished agents.
- **The command line it answers** - the list of finished agents, one agent with its whole diary, a delete, and a patch of the two late facts; each prints one JSON document; `--local` reads the copy on this machine, with no network.
- **The shape** - a card [3] is kept only with an id, a start time and a known status [4]; each field only with the right type; anything that fails to answer is read as "nothing", never an error.
- **Reads are shared for five seconds** - the same list or the same agent read again within five seconds reuses the answer; reads at the same moment share one call; a change, a widget's command having run in the project, or a caller that knows an agent just finished, reads fresh.

## Business logic

### Which command provides

#### Context

See `## Context`.

#### Business logic

The project's own package.json is read; its `dependencies` then `devDependencies` are taken in their order, a name listed twice read once. Each is looked up in the project's `node_modules`, links followed. The first whose own package.json declares `"framework": { "runs": "<command>" }`, where `<command>` is one of that package's own commands, is the runs provider [2]. A declaration naming a command the package does not have is skipped. No package.json, no installed dependency, or no declaration: the project has no runs provider, and every read below answers "no finished agents". The provider is looked up again at most every five seconds, so a project that installs, swaps or drops its provider is read the new way within five seconds.

### The command line it answers

#### Context

**Business logic story**: the command is the same one an agent runs to look back at earlier agents; The Framework uses the flags an agent does not.

#### Business logic

The provider's command runs with Node, in the project's root, never through a shell, for at most 30 seconds and 16 MB of output. Each call prints one JSON document and exits 0; anything else is a failure, and a failure reads as "nothing":
- `<command> --local --full --limit 10000`: every finished agent's whole card [3] (with `caller`), newest first. A failure is no agents.
- `<command> show <id> --local --full`: one agent's whole card with `diary`, every line of it. A failure, or a refusal because there is no such agent, is no agent.
- `<command> delete <id>`: remove the agent, card and diary. A failure answers the command's last line of error output.
- `<command> patch <id> [--branch <branch>] [--pr <number> --pr-url <link>]`: set the branch the agent's work landed on, and its pull request. A failure answers the same way.
`--local` asks for the copy of the agent records kept on this machine, read without contacting the remote, because The Framework polls. An id that is not letters, digits, `-` and `_` never reaches the command.

### The shape

#### Context

See `## Context`.

#### Business logic

A card [3] is only a card with a string id made of letters, digits, `-` and `_`, a string start time, and one of the five statuses [4]; anything else is dropped from a list and is no agent for a single read. Of the other fields, each is kept only with the right type: the strings as strings, the cost as a number, the pull request only with both a number and a link, `caller` only as an object; a field of the wrong type is left out rather than failing the card. A diary line is kept only when it is an object with a string `kind`; the lines keep their order.

### Reads are shared for five seconds

#### Context

**Problem**: see `## Context`.

#### Business logic

Per project, the list is read once and the same answer reused for five seconds; reads made while a read is still running wait for it instead of starting another. One agent read with its diary is reused the same way, per agent. A read that failed is not kept, so the next read tries again. A delete or a patch drops everything kept for the project, so the next read sees the change; so does being told the project changed (`provided.ts` says it after any widget command ran there). A caller that knows an agent just finished (its checkout disappeared since its last look) asks for the list fresh, past the five seconds (`agent-store.ts`).
