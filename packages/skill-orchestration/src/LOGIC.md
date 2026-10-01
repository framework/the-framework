The rules of the `orchestration` skill [1]: the `orchestration` command's command lines and their JSON answers, what a main agent's [2] plan and its approval are, and what starting, listing, reading, stopping and landing a subagent [3] is. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: an agent asked for a piece of work it can split saves a plan, asks the person to approve it, then starts a subagent per part, ends its turn, and is continued by the runner each time one ends, with which one, how it ended and its last words; it lists them, reads a result again, stops one, or lands one's work on its own branch, with one short command each.

**Business logic story**: each `orchestration` call is a short process (`cli.ts`) that reads the command line, finds the project and the calling run, and does one thing through the runner's library and the run records (`subagents.ts`). Nothing runs between calls. A subagent is a run of the runner's, and everything about it is on its run record; the one file the package keeps is the main agent's plan, beside that agent's run record (`plan.ts`).

## Glossary

[1] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`) and a command on the agent's PATH.
[2] main agent: the run whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[3] subagent: a run started for a main agent [2]: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as its parent on its record.

## Business logic — TL;DR

- **The `orchestration` command** (`cli.ts`, `cli.test.ts`) - `plan [<file>]`, `start <task>`, `list`, `read <id>`, `stop <id>`, `land <id>`; one JSON document on stdout, a line for a person on stderr, exit 0, 1 or 2.
- **A main agent and its subagents** (`subagents.ts`) - who is calling (`AGENT_ID`); a subagent's record written and its process started as a run with the caller as parent, from the caller's branch, its task followed by fixed lines saying it is a subagent; the caller's subagents read back by the parent on their records; one stopped by SIGTERM to the process on its live card; the plan saved and shown; no subagent before the plan is approved; one landed: merged into the caller's branch, its last commit kept under a ref of its own and named on its record, its branch deleted; the refusals.
- **The plan and its approval** (`plan.ts`) - the plan's file beside the run record, the question that names one plan's text, and the approval read off the main agent's diary: the person's `Approve` to that question, as the runner words an answer.
- **The entry point** (`index.ts`) - re-exports the command's runner and usage, the operations, and the plan's parts.
- **The tests' project** (`test-repo.ts`) - a throwaway repository with an origin and the `agent-data` branch.
