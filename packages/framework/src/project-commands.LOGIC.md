A project's commands [1]: its skills, read off the folders the coding agents read them from. The Framework ships no prompt text; what a project can be asked to do is what its own skills say, and the launcher lists them the way Claude Code's `/` list does.

## Context

**User story**: the launcher of a project shows a button per command the project has, such as `/work-queue` or `/update-tickets`, and typing `/` in the prompt box lists them all with their descriptions. A project with no skills shows none, and the free-text box still works.

## Glossary

[1] command: a skill of the project that a person can run by name: a folder under `.claude/skills/` or `.agents/skills/` holding a `SKILL.md`; what is typed after the slash is the folder's name.

## Business logic

The two folders are read at the project's root, `.claude/skills/` first and then `.agents/skills/` (the one Codex reads); a skill present in both is listed once. A folder counts when its name is lowercase letters, digits and dashes and it holds a readable `SKILL.md`. The file's front matter gives the command's [1] description (the `description` key, when it is a non-empty text). A skill whose front matter says `user-invocable: false` is no command, as in Claude Code. A skill whose front matter says `disable-model-invocation: true` is one written to be run by a person rather than picked up by the agent on its own: it is marked as a launcher button; every command is in the `/` list either way. Front matter that is missing or does not parse counts as empty. The commands are answered sorted by name; a project with neither folder has none.
