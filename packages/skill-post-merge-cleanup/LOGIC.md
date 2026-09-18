The `@gemstack/skill-post-merge-cleanup` npm package: the `post-merge-cleanup` command skill [1], one `SKILL.md` and no code. A command skill is a job for a coding agent [2] that composes the capability skills [3] of a project; it names no skill, no command and no package, and it is marked so that only a person or a runner invokes it, never the agent by itself. One package per command, named `@gemstack/skill-<command>`. A project tracks the skill file as `.claude/skills/post-merge-cleanup/SKILL.md`; a person fires it from the dashboard's launcher, picking it from the `/` list or typing its slash command, `/post-merge-cleanup`, a project's schedule can fire it with a line such as `- post-merge-cleanup: every 1d`, and the launcher's "Post-merge cleanup" box has it run, with the first agent's run id after it, on an agent's branch before that agent's pull request merges. Nothing depends on the package.

## Glossary

[1] command skill: a skill file (`SKILL.md`) whose body is a job's prompt, marked so that only a person or a runner invokes it; a runner starts the agent with the skill's slash command and the coding agent's harness expands it.
[2] agent: the unit of work: one task worked by a coding agent under a runner's control, in its own checkout, on its own branch.
[3] capability skill: a skill that says how to do one thing and ships its command — `branches`, `tickets`, `queue`, `logs`; a command skill composes them and none of them knows another.

## Business logic — TL;DR

- **The job** (`SKILL.md`) - after work is merged, putting a maintainability refactor and a security audit of the changes that need one on the agent queue, and bringing the project's knowledge files up to date in a pull request a person merges; given an agent run's id, doing the same for that run's pull request before it merges, its changes added to that pull request.
