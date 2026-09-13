The `@gemstack/routines` npm package: the routines [1] a daemon fires on its own, one skill file each under `skills/<name>/SKILL.md`, no code. A routine is a job for a coding agent [2] that composes the capability skills [3] of a project; it names no command and no package, and it is marked so that only a person or a daemon invokes it, never the agent by itself. The Framework's daemon depends on this package and starts an agent with a routine's slash command, `/work-queue`; a project that installs the skills without The Framework can fire the same routine by hand or from another runner.

## Glossary

[1] routine: a job the daemon fires on its own — the queued work, and later update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[2] agent: the unit of work: one task worked by a coding agent under a runner's control, in its own checkout, on its own branch.
[3] capability skill: a skill that says how to do one thing and ships its command — `branches`, `tickets`, `queue`, `logs`; a routine composes them and none of them knows another.

## Business logic — TL;DR

- **One folder per routine** (`skills/`) - the skills-npm layout, so a tool that scans `node_modules/**/skills/*/SKILL.md` finds them and `$ skills` can copy them into a project.
- **Working the queue** (`skills/work-queue/`) - one queued task off the agent queue, unattended.
