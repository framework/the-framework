The `orchestration` skill [1]: a main agent [2] starts subagents [3] on parts of its task, lists them, reads their results and stops them from the shell with the `orchestration` command (`start`, `list`, `read`, `stop`). A subagent is a run of the runner's (`agent-runner`) started for the main agent: its own process, its own checkout, a branch started from the main agent's, and a run record like any other run's, so the dashboard shows it like any other agent. The command never waits: the runner tells the main agent when a subagent ends, as its next prompt. `SKILL.md` is what the agent reads; `package.json`, the `tsconfig*.json` files and the ignored build output (`dist/`, `dist-test/`) carry no business logic. The package depends on `agent-runner` (a run's first record, the spawn of its process, the readiness check, the tool's mark on a record, the live card), on `skill-logs` (the run records), on `skill-branches` (the project, a run's checkout and its branch) and on `agent-data`; nothing depends on it, the runner least of all: the runner names no skill.

## Context

**User story**: the user asks one agent for a piece of work with parts that can be worked alone. The agent starts a subagent per part with `npx orchestration start "<task>"` and ends its turn. Each subagent works alone, commits to its own branch, opens no pull request and asks nobody. Each time one ends, the main agent is continued with which one ended, how, where its work is and its last words; it merges the branch and goes on. The user passes nothing along.

**Business logic story**: the runner can start a run for another run and tell that run when it ends (`agent-runner`'s `run --parent`, `run --base` and `parent.ts`). This package is what an agent uses to do so: it fills in the parent and the base from the calling run, adds to every task the lines saying the reader is a subagent, and reads the runs back by their parent.

**Problem**: a main agent that waited for its subagents would hold a turn open for as long as they work; one that started them by the runner's own command line would have to name its own run and branch, could not tell its subagents from other runs, and could not stop one.

## Glossary

[1] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`) and a command on the agent's PATH.
[2] main agent: the run whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[3] subagent: a run started for a main agent [2]: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as its parent on its record.

## Business logic — TL;DR

- **What the agent is told** (`SKILL.md`) - what a subagent [3] is, the four command lines, to commit before starting and to write a task that stands alone, to end its reply after starting, and what the message a subagent's end sends is and what to do then.
- **The executable** (`bin/`) - the `orchestration` command, handing the shell to the command's rules.
- **The command and the subagents** (`src/`) - the four command lines and their JSON answers; a subagent started as a run with the caller as parent, from the caller's branch, told it is a subagent; no subagent of a subagent; the caller's subagents listed and read by the parent on their records; one stopped by a signal to its process.
