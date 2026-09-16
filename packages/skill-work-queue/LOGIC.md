The `@gemstack/skill-work-queue` npm package: the `work-queue` command skill [1], one `SKILL.md` and no code. A command skill is a job for a coding agent [2] that composes the capability skills [3] of a project; it names no skill, no command and no package, and it is marked so that only a person or a runner invokes it, never the agent by itself. One package per command, named `@gemstack/skill-<command>`. A project tracks the skill file as `.claude/skills/work-queue/SKILL.md`; the scheduler, `agent-scheduler`, starts an agent with the skill's slash command, `/work-queue`, when the project's schedule says the queue has entries, and a person fires it by hand the same way. Nothing depends on the package.

## Glossary

[1] command skill: a skill file (`SKILL.md`) whose body is a job's prompt, marked so that only a person or a runner invokes it; a runner starts the agent with the skill's slash command and the coding agent's harness expands it.
[2] agent: the unit of work: one task worked by a coding agent under a runner's control, in its own checkout, on its own branch.
[3] capability skill: a skill that says how to do one thing and ships its command — `branches`, `tickets`, `queue`, `logs`; a command skill composes them and none of them knows another.

## Business logic — TL;DR

- **Working the queue** (`SKILL.md`) - one queued task off the agent queue, unattended, published by the agent as a pull request that merges on green and names its ticket, the ticket put in review and closed only at the merge; the job the scheduler fires while the queue has entries.
