The skill's instructions: what an agent is told about the project's agent logs — where they live, how to read them, when to look back, and the two formats.

## User story

- The user expects an agent starting on a ticket to know how the last attempt went — what that agent said before it stopped or failed, or that a done run already has a pull request — without the user putting any of that in a prompt.

## Business logic — TL;DR

- **The runs are on a branch, not in your checkout** - every run's card and diary live under `agents/<who>/` on the `agent-data` branch, never on a code branch; the agent's own checkout does not contain them.
- **The `logs` command is how to read them, and reading is all it does** - it ships with the `@gemstack/skill-logs` package the repository depends on: the agent installs the repository's dependencies once, when there is no `node_modules` yet, and runs `npx logs`, so every command the skill names runs as written on a fresh clone. The program that ran an agent records its run; a refusal exits 1 with a line on stderr, a wrong command line exits 2 with the usage.
- **Read: the bare command and `show`** - the runs newest first as cards, the newest 20 unless `--limit` says otherwise, narrowed by `--ticket` (a ticket's filename or the path a queue entry links to) or `--branch`; `show <id>` one run's card with what the agent said, its result, how it ended and what it cost.
- **Before you plan or work a ticket, read its runs** - a stopped or failed run says what to avoid, and `show` says what that agent said before it ended; a done run with a pull request means the work may already be there, so read the pull request before doing it again; a run with no ticket is found by branch or in the list.
- **The formats** - the card's fields, one example, with `status` one of four words, `cost` in US dollars, every field but three optional, and the writing program's own bookkeeping under `caller`, never printed; the diary's four kinds of line, one example each, any other kind the writing program's and left out of `show`.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
