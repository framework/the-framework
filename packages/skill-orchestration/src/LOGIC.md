The rules of the `orchestration` skill [1]: the `orchestration` command's command lines and their JSON answers, what a main agent's [2] plan and its approval are, what starting, listing, reading, stopping and landing a subagent [3] is, the person's subagent settings [4], and the dashboard's hook line that saves them. Every file here has a `LOGIC.md` of its own.

## Context

**User story**: an agent asked for a piece of work it can split saves a plan, asks the person to approve it, then starts a subagent per part, ends its turn, and is continued by the runner each time one ends, with which one, how it ended and its last words; it lists them, reads a result again, stops one, or lands one's work on its own branch, with one short command each.

**Business logic story**: each `orchestration` call is a short process (`cli.ts`) that reads the command line, finds the project and the calling run, and does one thing through the runner's library and the run records (`subagents.ts`). Nothing runs between calls. A subagent is a run of the runner's, and everything about it is on its run record; the package keeps two files of its own: the main agent's plan, beside that agent's run record (`plan.ts`), and the person's subagent settings on this machine, at the project's root (`settings.ts`), which the dashboard's Settings → Subagents writes through the project's `subagents` hook line (`init.ts`).

## Glossary

[1] skill: a capability an agent is taught, as a package with the instructions the agent reads (its `SKILL.md`) and a command on the agent's PATH.
[2] main agent: the run whose agent calls the command: the run named by `AGENT_ID` in the caller's environment, which the runner sets for every agent it starts.
[3] subagent: a run started for a main agent [2]: a run of its own, in its own checkout, on its own branch started from the main agent's, with the main agent as its parent on its record.
[4] subagent settings: the person's choice, on one machine, of the coding agent and model a task the main agent [2] calls simple runs on, the same for a task it calls hard, and how many of one main agent's subagents [3] run at once; one file, `.orchestration/settings.json` at the project's root, hidden from git.

## Business logic — TL;DR

- **The `orchestration` command** (`cli.ts`, `cli.test.ts`) - `plan [<file>]`, `start --level <simple|hard> <task>`, `settings [<json>]`, `init`, `list`, `read <id>`, `stop <id>`, `land <id>`; one JSON document on stdout, a line for a person on stderr, exit 0, 1 or 2.
- **A main agent and its subagents** (`subagents.ts`) - who is calling (`AGENT_ID`); a subagent's record written and its process started as a run with the caller as parent, from the caller's branch, its task followed by fixed lines saying it is a subagent, on the coding agent and model the subagent settings [4] name for the level the caller gave, else the caller's own; refused past the settings' limit of subagents running at once; the caller's subagents read back by the parent on their records; one stopped by SIGTERM to the process on its live card; the plan saved and shown; no subagent before the plan is approved; one landed: merged into the caller's branch, its last commit kept under a ref of its own and named on its record, its branch deleted; the refusals.
- **The plan and its approval** (`plan.ts`) - the plan's file beside the run record, the question that names one plan's text, and the approval read off the main agent's diary: the person's `Approve` to that question, as the runner words an answer.
- **The subagent settings** (`settings.ts`) - the two levels, `simple` and `hard`; the settings [4] file, hidden from git; settings that are not settings refused whole; the coding agent and model for a level: the level's setting, else the main agent's own; 4 at once when unset.
- **The dashboard's line** (`init.ts`) - the `subagents` line written into the dashboard's `.the-framework/hooks.yml`, a person's line already there kept.
- **The entry point** (`index.ts`) - re-exports the command's runner and usage, the operations, the plan's parts, the settings' parts and the hook line's writer.
- **The tests' project** (`test-repo.ts`) - a throwaway repository with an origin and the `agent-data` branch.
