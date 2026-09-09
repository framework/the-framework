A run: one agent's work on the project from its start to its end, recorded as two files — the card and the diary. This is the pure half: what the two files hold, how they read back, how a run is matched. Nothing here touches git or a disk.

## User story

- An agent about to work a ticket reads the runs that worked it before, and what those agents said, without learning anything about the program that ran them.
- The user opens a run's card in a file listing and reads it as a person: the plain fields first, the program's own bookkeeping last.

## Glossary

- **the card** - a run's `<id>.json`: eleven fields of the package's own, and the writer's under `caller`.
- **the diary** - a run's `<id>.jsonl`: one JSON object per line, each with a `kind`.

## Business logic — TL;DR

- **The card's fields** - id, start and end time, status, intent, driver, model, branch, pull request, ticket, cost; the writer's own under one key.
- **A card reads back strictly** - each field kept only in the right shape, unknown top-level fields dropped, and no card at all without an id, a start and a status.
- **The diary's four kinds** - what the agent said, its result, how the run ended, what it cost; every other line is the writer's and is skipped.
- **A run id is a file name** - letters, digits, dashes and underscores only, so no id can climb out of a directory.
- **A person's directory is their git email, made safe** - lowercased, unsafe characters replaced, `anonymous` when nothing usable is left.
- **A run worked a ticket by its path or its file name** - the exact path recorded, or one ending in `/<file>`.
- **Newest first is the id order reversed** - the writer's ids sort by time.

## Business logic

### The card's fields

#### Business logic

A card holds: `id`; `startedAt` and `endedAt` (ISO timestamps, the end absent while the run is going); `status`, one of `running`, `done`, `stopped`, `failed`; `intent`, what the agent was asked; `driver`, the agent program that ran, as the writer names it; `model`; `branch`, where the work is; `pr`, the pull request's number and URL; `ticket`, the ticket the run worked, as the writer names tickets; `cost`, in US dollars. Every field but the id, the start and the status may be absent. Under `caller` the writer keeps whatever else it records, as one object: the package stores it as given and never reads it. Two late facts, the branch and the pull request, are what a writer may patch onto a card after it landed.

A card is written with the package's fields first in a fixed order, `caller` last, pretty-printed, so a person reads the plain part before the bookkeeping.

### A card reads back strictly

#### Business logic

A card's text reads back as a card only when it is a JSON object with a string id that is a run id, a string start and a known status; anything else is not a card. Each other field is kept only in the shape the card defines — a string, a number, a pull request with a number and a URL, an object under `caller` — and a field of another shape is dropped rather than kept. A top-level field the card does not define is dropped too: the card is the package's contract, and the writer's place is `caller`.

### The diary's four kinds

#### Business logic

A diary's lines are JSON objects with a string `kind`, in order; a line that is not one is skipped, and a line that does not parse ends the read, keeping what came before — a writer torn mid-line wrote nothing after it that can be trusted. Four kinds are the agent's: `said` with the text the agent said; `result` with the text of its final answer for a turn; `ended` with the status the run ended in — `done`, `stopped` or `failed` — and a detail when it did not end well; `cost` with what a stretch of the run cost in US dollars, when known. A line of one of these kinds without the fields it needs is not the agent's line. Any other kind is the writer's, and a line of any kind may carry more fields than named here; they pass through untouched.

### A run id is a file name

#### Business logic

An id is a file name on the branch and a path segment in every read, so it is letters, digits, dashes and underscores only; anything else — a dot, a slash, a space, nothing at all — is not an id, and a file not named `<id>.json` after one is not a card.

### A person's directory is their git email, made safe

#### Business logic

The directory a person's runs go under is the git email their repository commits as: trimmed, lowercased, every character outside letters, digits, `@`, `.`, `_`, `+` and `-` replaced by `-`. The result must start with a letter or digit and be at most 64 characters, which rules out `.`, `..`, a dotfile name and a separator — the value comes from repository configuration and is joined onto a path. An email that cannot be made to fit, or none, files under `anonymous`, so the run is kept rather than dropped.

### A run worked a ticket by its path or its file name

#### Business logic

A run worked a ticket when its card's ticket is exactly that text, or ends in `/` followed by it — so a ticket's file name and the path a queue entry links to both find it. Where tickets live is the writer's business, not the package's.

### Newest first is the id order reversed

#### Business logic

The writer's ids sort by time, so sorting ids as text in reverse is newest first; no timestamp is parsed.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
