"Update from GitHub": the one button that starts an agent [1] bringing a project's `tickets/` up to date with its GitHub issues, rendered identically wherever the widget offers it — a project's tickets list and that list's empty state (the dashboard's own onboarding checklist offers the same command with a button of its own). The label, the instruction sent, and what the tooltip promises all come from the one place, so pressing the same words on a different surface always sends the same ask.

## Context

**User story**: the user keeps a project's issues on GitHub and wants them as tickets on the `agent-data` branch [2], where the agents read them. One press does it, whether the project has never imported anything or imported an hour ago.

**Problem**: the same offer written out per surface drifts: one wording change and the other surfaces keep saying the old thing while sending a different instruction under the same label.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs.
[3] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.
[4] launcher: the Start form on a project's own page.

## Business logic — TL;DR

- **One instruction behind one label** - the button sends the project's `update-tickets` command [3], `/update-tickets`.
- **The promise depends on what is on record** - the tooltip says "everything open comes across" only when no import was ever recorded.
- **Configure first, then run** - the chevron beside it hands the same instruction to the launcher instead of spending an agent.
- **Busy while it starts** - the button reads "Starting…" and is out while its start is in flight.

## Business logic

### One instruction behind one label

#### Context

See `## Context`.

#### Business logic

The button reads "Update from GitHub" with a refresh icon and sends `/update-tickets`, the project's `update-tickets` command [3]. That command covers both cases: a project with no tickets at all is treated as a first import, which is why an empty `tickets/` needs no separate offer of its own.

### The promise depends on what is on record

#### Context

**Problem**: "update" and "import everything" are different promises, and pressing the button without knowing which one applies is how a user is surprised by a hundred new tickets.

#### Business logic

When the caller knows when the tickets last caught up with GitHub, the tooltip reads "Bring tickets/ up to date with the issues and comments changed since the last import." With no import on record it reads "Bring tickets/ up to date with GitHub. With no import on record, everything open comes across."

### Configure first, then run

#### Context

**Problem**: which coding agent runs, on which model and where, is set in the launcher [4], not here.

#### Business logic

Beside the button sits a chevron, labeled "Other ways to update from GitHub", offering "Configure first, then run": "Opens the launcher with the update prompt, so you can set the model and where it runs." Choosing it leaves the same instruction waiting in the launcher and starts nothing. The chevron stays live while a start is in flight, since it spends nothing.

### Busy while it starts

#### Context

**Problem**: an import spends a checkout and a share of the account's quota; a second press while the first is still starting would spend another.

#### Business logic

While the surrounding surface reports a start in flight, the button itself reads "Starting…" with a spinner and cannot be pressed. A caller with nothing to act on — no project chosen — can disable both halves.
