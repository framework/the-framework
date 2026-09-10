Fixes what a run [1] is on the `agent-data` branch [2]: the card [3], `<id>.json`, and the diary [4], `<id>.jsonl`; how each is written and read back; which fields and lines are the skill's and which are the recording program's [5]; and how a run is matched to a ticket, ordered, and shown. Nothing here touches git or a disk.

## Context

**User story**: an agent [6] runs `npx logs` before working a ticket and reads cards it can trust: every field means the same for every run whichever program recorded it, and none of that program's private bookkeeping is in the way; the user opens a run's page on another machine and sees the same record.

**Business logic story**: the recording program records a run at the agent's end through `store.ts`, and the `logs` command reads runs off origin through `cli.ts`; both go through the shapes fixed here.

**Problem**: the card and the diary are the public API of the branch, so a program's private fields must not become the skill's contract; and every value read from a file, an id or an email in particular, is joined onto a path, so nothing read may be trusted to be safe.

## Glossary

[1] run: the `logs` skill's record of one agent on the `agent-data` branch: a card and a diary. Never the unit of work.
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[3] card: the run's `<id>.json`: what was asked, the ticket, the branch, the pull request, how it ended, what it cost.
[4] diary: the run's `<id>.jsonl`: what the agent said.
[5] recording program: the program that ran an agent and records its run when the agent ends; in the product, the daemon.
[6] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[7] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[8] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[9] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[10] queue entry: an item on the agent queue, `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down.

## Business logic — TL;DR

- **The card's fields** - eleven plain fields are the skill's; everything else the recording program keeps sits under one key, `caller`, stored as given and never read.
- **How a run stands** - `running`, `done`, `stopped` or `failed`, and nothing else.
- **A run id is a safe file name** - letters, digits, `-` and `_` only, so an id can never climb out of a directory; the card is `<id>.json`, the diary `<id>.jsonl`.
- **A person's directory from a git email** - `agents/<who>/` is the email the recording repository commits as, lowercased and made safe; `anonymous` when unusable.
- **Reading a card back** - a card is kept only with an id, a start and a status; every other field is kept only in its right shape, and anything unknown is dropped.
- **Writing a card** - the skill's fields first, `caller` last, pretty-printed, absent fields not written.
- **The diary is JSON lines** - one JSON object with a `kind` per line; a line that is not one is skipped, and a torn line ends the read.
- **The four kinds that are the agent's** - `said`, `result`, `ended` and `cost`, each with the fields its kind needs; every other kind is the recording program's and is left out of what the agent reads.
- **The two late facts** - only the branch and the pull request may be patched onto a card after it lands.
- **Which run worked a ticket** - the card's ticket is that exact path or ends with `/<file>`, so a file name and a linked path both find it.
- **Newest first** - ids sort by time, so the id order reversed is the time order.
- **What the command prints** - the skill's fields only, never `caller`.

## Business logic

### The card's fields

#### Context

**Problem**: owning the recording program's whole record, renamed field by field, would make that program's private fields a standalone package's public API.

#### Business logic

The card [3] is the skill's and small. Its fields: `id`, the run's [1] name and, in the product, the agent id [7]; `startedAt` and `endedAt`, timestamps, the end absent while the run is going; `status`, how the run stands; `intent`, what the agent [6] was asked to do; `driver` [8], the coding agent program that ran, as the recording program [5] names it; `model`; `branch`, the branch the work is on; `pr`, the pull request the work is on, as a number and a URL; `ticket`, the ticket the run worked, as the recording program names tickets (a path or a file name); and `cost`, in US dollars. Every field but `id`, `startedAt` and `status` is absent when unknown. Everything else the recording program keeps sits under one more key, `caller`, as one object the skill stores as given and never reads.

### How a run stands

#### Context

See `## Context`.

#### Business logic

A run's [1] status is one of `running`, still going; `done`, ended well; `stopped`, ended before it finished; or `failed`. Any other value is not a status, and a card [3] carrying one is not a card.

### A run id is a safe file name

#### Context

**Problem**: an id is a file name on the branch and a path segment in every read, so it is the one value that must never carry a separator or a parent reference.

#### Business logic

An id names a run [1] only when it is made of letters, digits, `-` and `_` and nothing else; it can then be neither `.`, `..`, a path, nor a hidden file. The card [3] is the file `<id>.json` and the diary [4] the file `<id>.jsonl`, both under the person's directory. A file counts as a card only when its name is a valid id followed by `.json`: a diary, a hidden file, or a stray note in the directory is not a run.

### A person's directory from a git email

#### Context

**Problem**: the directory groups runs by person in any file listing and protects nothing, since ids never collide and the same email authors the commits; but its name comes from repository configuration and is joined onto a path.

#### Business logic

The directory a person's runs [1] are filed under, `<who>` in `agents/<who>/`, is the git email the recording program's [5] repository commits as: trimmed, lowercased, with every character outside letters, digits, `@`, `.`, `_`, `+` and `-` replaced by `-`. The result must start with a letter or digit and be at most 64 characters long, which rules out `.`, `..`, hidden names and absurd lengths. Anything that cannot be made to fit, a missing or blank email included, files the run under `anonymous` rather than under a guess, so the run is still kept.

### Reading a card back

#### Context

See `## Context`.

#### Business logic

A card [3] read from its file is kept only when the file is a JSON object with a valid id, a `startedAt` text and a known status; anything else (not JSON, an array, a missing or unknown status, an unsafe id) is not a card and reads as none. Of the other fields, each is kept only in its right shape: the texts as texts, `cost` as a number, `pr` as an object with a numeric `number` and a text `url`, and `caller` as an object; a field of the wrong shape, and any field the skill does not know, is dropped rather than passed on. The card is the skill's contract, and a reader never sees a shape it did not promise.

### Writing a card

#### Context

See `## Context`.

#### Business logic

A card [3] is written as pretty-printed JSON with one trailing newline, the skill's fields first in a fixed order (`id`, `startedAt`, `endedAt`, `status`, `intent`, `driver`, `model`, `branch`, `pr`, `ticket`, `cost`) and `caller` last; a field that is absent is not written. What is written reads back as the same card.

### The diary is JSON lines

#### Context

**Problem**: a recording program torn mid-line wrote nothing after that line that can be trusted.

#### Business logic

The diary [4] is one JSON object per line, in the order things happened, each with a text `kind`; it is written one object per line and read back in order. On reading, a blank line is skipped; a line that parses but is not an object with a text `kind` is skipped; a line that does not parse ends the read, and everything before it is kept.

### The four kinds that are the agent's

#### Context

**Problem**: the recording program's diary carries its own bookkeeping too, which an agent cannot be made to read through, while the program's own pages replay the whole file themselves.

#### Business logic

Four kinds of line are the agent's [6], and the skill knows only those: `said`, something the agent said, with a `text`; `result`, the agent's final answer for a turn [9], with a `text`; `ended`, how the run [1] ended, with a `status` that is `done`, `stopped` or `failed` (never `running`) and an optional `detail` text; and `cost`, what a stretch of the run cost, with an optional `usd` number. A line of one of these kinds whose required fields are missing or of the wrong type is not the agent's line. A line may carry more fields than its kind needs; they pass through untouched. Every line of another kind is the recording program's [5] own: stored, never read by the skill, and left out of what the agent is shown.

### The two late facts

#### Context

**Problem**: the branch the work landed on and the pull request are known only once the run's process is gone.

#### Business logic

Only two facts may be patched onto a card [3] after it lands: `branch` and `pr`. Nothing else on a card changes afterwards.

### Which run worked a ticket

#### Context

**User story**: an agent [6] asks `npx logs --ticket <file>` for a ticket by its file name, or by the path a queue entry [10] links to, and finds the same runs either way.

#### Business logic

A run [1] worked a ticket when its card [3] names that exact path, or names a path ending in `/` followed by it; a run with no ticket matches nothing, and a mere suffix of the file name (`01_fix.md` for `2026-09-01_fix.md`) does not match. Where tickets live is the recording program's [5] business, not the skill's.

### Newest first

#### Context

See `## Context`.

#### Business logic

The recording program's [5] ids sort by time, so runs [1] are ordered newest first by comparing their ids as text, descending, whichever person's directory each sits in.

### What the command prints

#### Context

See `## Context`.

#### Business logic

The public form of a card [3] is the skill's fields only: `caller` is removed before anything is printed to an agent [6], since the recording program's [5] bookkeeping is not the agent's business.
