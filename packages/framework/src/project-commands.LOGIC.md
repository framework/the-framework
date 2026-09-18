A project's commands [1]: the skills it has written to be run by a person, read off the folders the coding agents read them from. The Framework ships no prompt text; what a project can be asked to do is what its own command skills say.

## Context

**User story**: typing `/` in a project's prompt box, or opening the Commands menu beside it, lists the jobs a person can start there, such as `/work-queue` or `/ux`, with their descriptions. The skills that teach an agent how to use the project's tickets, queue or logs are not listed: typed alone, they would start an agent with nothing to do. A project with no command shows none, and the free-text box still works.

## Glossary

[1] command: one of the project's skills written to be run by a person, never picked up by the coding agent on its own (its front matter says `disable-model-invocation: true`), read off the folders the coding agents read them from (`.claude/skills/`, `.agents/skills/`); typed as `/<name>`, optionally followed by an argument.

## Business logic

The two folders are read at the project's root, `.claude/skills/` first and then `.agents/skills/` (the one Codex reads). A folder counts when its name is lowercase letters, digits and dashes and it holds a readable `SKILL.md`. A skill's first readable copy decides: a skill present in both folders is judged by its `.claude/skills/` copy, and the other copy is not looked at. A skill is a command [1] only when its front matter says `disable-model-invocation: true`; every other skill, one the agent may pick up on its own or one only the agent may use (`user-invocable: false`), is not listed. Front matter that is missing or does not parse says nothing, so such a skill is no command. The command's description is the front matter's `description` key, when it is a non-empty text. The commands are answered sorted by name; a project with neither folder has none.
