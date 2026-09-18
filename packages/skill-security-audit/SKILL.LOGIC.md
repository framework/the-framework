The `security-audit` command skill: a skill file the coding agent's harness expands from `/security-audit`, the prompt of the agent a person starts for auditing a part of the code for security issues, exhaustively, each issue fixed in its own commit, published as a pull request a person reviews. Marked so that only a person or a runner invokes it; the agent never chooses it by itself.

## Context

**User story**: a person types `/security-audit` and, after it, the part of the project to audit. The agent scrutinizes every file of the part, lists every aspect it considered with a verdict, fixes each issue in its own commit, and opens a pull request whose body is that list; with no issue found, the list is its last message and nothing is published.

**Business logic story**: the skill names no skill and no command, and assumes no capability. The agent composes the capability skills tracked in the project on its own; what this file carries is the rules of the job, which an agent nobody answers cannot infer from the skills alone.

## Business logic — TL;DR

- **Nobody answers** - the agent never asks and decides by itself.
- **The part** - what follows the slash command, a folder, a file or a feature in words; the whole project when nothing follows it.
- **Exhaustive** - every file of the part scrutinized; every aspect considered listed with a verdict, explained when the verdict is not obvious.
- **One commit per issue** - each security issue found is fixed in its own commit.
- **Publishing** - each change committed on the agent's branch, the branch pushed and its pull request opened; the merge is left to a person. The pull request's body and the last message are the list of aspects with their verdicts.
- **No issue** - the list is the last message and nothing is published.
