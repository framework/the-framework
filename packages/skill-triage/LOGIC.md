The `@gemstack/skill-triage` npm package: the `triage` command skill [1], one `SKILL.md` and no code. A command skill is a job for a coding agent [2] that composes the capability skills [3] of a project; it names no skill, no command and no package, and it is marked so that only a person or a runner invokes it, never the agent by itself. One package per command, named `@gemstack/skill-<command>`. A project tracks the skill file as `.claude/skills/triage/SKILL.md`; the scheduler, `agent-scheduler`, starts an agent with the skill's slash command and a mode word, `/triage quick` or `/triage consensual`, when the project's schedule says so, one line per mode, and a person fires it by hand the same way, with or without the word. Nothing depends on the package.

## Glossary

[1] command skill: a skill file (`SKILL.md`) whose body is a job's prompt, marked so that only a person or a runner invokes it; a runner starts the agent with the skill's slash command and the coding agent's harness expands it, handing the skill the word typed after the command.
[2] agent: the unit of work: one task worked by a coding agent under a runner's control, in its own checkout, on its own branch.
[3] capability skill: a skill that says how to do one thing and ships its command — `branches`, `tickets`, `queue`, `logs`; a command skill composes them and none of them knows another.

## Business logic — TL;DR

- **The job** (`SKILL.md`) - putting the tickets whose plan says they are ready on the project's agent queue, unattended: the quick wins, the consensual work, or both, by the word after the command; the routine the scheduler fires per mode, on the interval and the check the project's schedule gives that mode's line.
