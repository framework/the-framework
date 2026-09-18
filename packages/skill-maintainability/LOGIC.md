The `@gemstack/skill-maintainability` npm package: the `maintainability` command skill [1], one `SKILL.md` and no code. A command skill is a job for a coding agent [2] that composes the capability skills [3] of a project; it names no skill, no command and no package, and it is marked so that only a person or a runner invokes it, never the agent by itself. One package per command, named `@gemstack/skill-<command>`. A project tracks the skill file as `.claude/skills/maintainability/SKILL.md`; a person fires it from the dashboard's launcher, where it is a button, or by typing its slash command, `/maintainability`. Nothing depends on the package.

## Glossary

[1] command skill: a skill file (`SKILL.md`) whose body is a job's prompt, marked so that only a person or a runner invokes it; a runner starts the agent with the skill's slash command and the coding agent's harness expands it.
[2] agent: the unit of work: one task worked by a coding agent under a runner's control, in its own checkout, on its own branch.
[3] capability skill: a skill that says how to do one thing and ships its command — `branches`, `tickets`, `queue`, `logs`; a command skill composes them and none of them knows another.

## Business logic — TL;DR

- **The job** (`SKILL.md`) - refactoring a part of the code to make it as maintainable as possible, published as a pull request a person reviews.
