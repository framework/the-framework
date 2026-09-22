The `@gemstack/skill-plan-tickets` npm package: the `plan-tickets` command skill [1], one `SKILL.md` and no code. A command skill is a job for a coding agent [2] that composes the capability skills [3] of a project; it names no skill, no command and no package, and it is marked so that only a person or a runner invokes it, never the agent by itself. One package per command, named `@gemstack/skill-<command>`. A project tracks the skill file as `.claude/skills/plan-tickets/SKILL.md`; the scheduler, `agent-scheduler`, starts an agent with the skill's slash command, `/plan-tickets`, when the project's schedule says so, and a person fires it by hand the same way. Nothing depends on the package.

## Glossary

[1] command skill: a skill file (`SKILL.md`) whose body is a job's prompt, marked so that only a person or a runner invokes it; a runner starts the agent with the skill's slash command and the coding agent's harness expands it.
[2] agent: the unit of work: one task worked by a coding agent under a runner's control, in its own checkout, on its own branch.
[3] capability skill: a skill that says how to do one thing and ships its command — `branches`, `tickets`, `queue`, `logs`; a command skill composes them and none of them knows another.

## Business logic — TL;DR

- **The job** (`SKILL.md`) - queueing a plan for the open tickets that have none or an outdated one, at most ten a run, unattended; the command the scheduler fires on the interval the project's schedule gives it.
