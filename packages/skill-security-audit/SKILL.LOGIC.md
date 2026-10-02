The `security-audit` command skill: a skill file the coding agent's harness expands from `/security-audit`, the prompt of the agent a person starts for auditing a part of the code for security issues, exhaustively, each issue fixed in its own commit, published as far as whoever started the agent said. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/security-audit` and, after it, the part of the project to audit. The agent scrutinizes every file of the part, lists every aspect it considered with a verdict, fixes each issue in its own commit, and publishes the work as far as the person said when starting it: with "Open PR" picked in the launcher's publish menu, it opens a pull request whose body is that list; with nothing said, the fixes stay committed on its branch and the list is its last message; with no issue found, the list is its last message and nothing is published.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone. The skill names no publish level: how far the work is published is said by whoever started the agent (the launcher's publish menu, or the `publish` clause of a schedule line, which the runner tells the agent in one sentence after its prompt), and the skill says to follow it.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The part** - what follows the slash command, a folder, a file or a feature in words; the whole project when nothing follows it.
- **Exhaustive** - every file of the part scrutinized; every aspect considered listed with a verdict, explained when the verdict is not obvious.
- **One commit per issue** - each security issue found is fixed in its own commit.
- **Publishing** - each change committed on the agent's branch; then the work is published as far as whoever started the agent said, and nothing is published when they said nothing. A pull request's body and the last message are the list of aspects with their verdicts.
- **No issue** - the list is the last message and nothing is published.
