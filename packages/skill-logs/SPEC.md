The agent logs for coding agents, as an npm package: the record of every run agents made on a project — for each run a card (what was asked, the ticket, the branch, the pull request, how it ended, what it cost) and a diary (what the agent said, its result) — under `agents/<who>/` on the `agent-data` branch of the project's own repository, never on a code branch; the `logs` command that reads it from any clone; and the instructions an agent follows to use it (`SKILL.md`): before planning or working a ticket, read its runs.

The package knows git, the filesystem, the card's fields and four kinds of diary line, nothing else. The card carries eleven plain fields of the package's own; whatever else the program that ran the agent recorded sits under one key, `caller`, stored and never read. The diary is JSON lines, of which the package reads four kinds — what the agent said, its result, how the run ended, what it cost — and skips the rest. The same functions serve every caller: a long-lived process (a daemon that records the runs it drives and shows them) that keeps a checkout of the branch, and an agent's own shell, through the `logs` command a caller puts on the PATH of every agent it starts on its machine. Agents only read; the process that ran an agent records its run, at its end.

The branch is a file store, the primitive `@gemstack/agent-data` provides: a branch nobody edits in a working tree, safe to push and pull eagerly. A long-lived process writes through its persistent checkout, `.branches/agent-data`, in one serialized cycle per branch — sync with origin, apply, commit, push — and reads the checkout; a push that loses a race is re-applied against the fresher state rather than forced. The `logs` command reads origin's copy of the branch, fetched once, and holds no checkout.

## Glossary

- **the card** - a run's `<id>.json`: the package's fields, and the writer's own under `caller`.
- **the diary** - a run's `<id>.jsonl`: one JSON object per line, four kinds the package knows among whatever the writer adds.
- **the funnel** - a caller's write cycle over the branch: apply a change to a checkout of it, commit, push. A long-lived process passes its own; the package's default is the persistent checkout's cycle.

## Business logic — TL;DR

- **The name** (`names`) - the runs directory, `agents`, at the root of the shared data branch `agent-data` (`@gemstack/agent-data` names the branch).
- **A run** (`run`) - the card and the diary as text and as values: which fields a card has and how one reads back, which lines are the agent's, how a person's directory is named from a git email, how a run matches a ticket, and newest first.
- **Where the runs live** (`store`) - the branch bound to a project, for a long-lived process: list, find, read a diary, record a run, patch two late facts onto its card, delete it, each write one commit through the funnel.
- **The command line** (`cli`, `bin/`) - the reads as commands for a shell: JSON on stdout, a reason on stderr, an exit code that tells a refusal from a usage error; the executable's directory and the skill's own directory are exported (`bin-dir`) for a caller that spawns agents.
- **The skill** (`SKILL.md`) - what the agent is told: the runs are on a branch and not in its checkout, the `logs` command is how it reads them, when to look back, and the two formats.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
