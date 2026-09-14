The `@gemstack/skill-work-queue` npm package: the `work-queue` command skill [1], one `SKILL.md` and no code. A command skill is a job for a coding agent [2] that composes the capability skills [3] of a project; it names no skill, no command and no package, and it is marked so that only a person or a runner invokes it, never the agent by itself. One package per command, named `@gemstack/skill-<command>`. The Framework's daemon depends on this package and starts an agent with the skill's slash command, `/work-queue`; a project that installs the skill without The Framework fires it by hand or from another runner.

## Glossary

[1] command skill: a skill file (`SKILL.md`) whose body is a job's prompt, marked so that only a person or a runner invokes it; a runner starts the agent with the skill's slash command and the coding agent's harness expands it.
[2] agent: the unit of work: one task worked by a coding agent under a runner's control, in its own checkout, on its own branch.
[3] capability skill: a skill that says how to do one thing and ships its command — `branches`, `tickets`, `queue`, `logs`; a command skill composes them and none of them knows another.

## Business logic — TL;DR

- **Working the queue** (`SKILL.md`) - one queued task off the agent queue, unattended; the job The Framework's daemon fires when the `agent-data` branch moved (the rules in `packages/framework/src/auto-pm.ts`).
