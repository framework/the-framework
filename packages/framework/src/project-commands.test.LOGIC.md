Tests of a project's commands (`project-commands.ts`), against throwaway project directories on disk.

Covered:
- The commands are the skills of both folders, each once (the `.claude/skills/` copy wins), sorted by name; the front matter gives the description and marks a launcher button; a skill marked `user-invocable: false` is left out; a skill with no front matter, or front matter that does not parse, is a command with nothing to say about it; a folder without a `SKILL.md` and a folder whose name no slash command could have are skipped.
- A project with no skills folder has no commands.
