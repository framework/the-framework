The `@gemstack/skill-question` npm package: the `question` skill [1], one `SKILL.md` and no code. It teaches a coding agent [2] how to ask the person to decide: when a choice is theirs, the agent ends its reply with one `await-choices` block, the question with its options, and stops; whoever runs the agent shows the question and resumes it with the answer. A project tracks a copy of the skill file under `.agents/skills/question/`, which `.claude/skills/question` links to, so both Codex and Claude Code read it. Unlike a command skill [3], the agent picks it by itself, so the dashboard's launcher, which lists command skills only, does not list it. Nothing depends on the package.

## Glossary

[1] skill: a skill file (`SKILL.md`) a coding agent reads when its description matches the work at hand.
[2] coding agent: the tool doing the work, Claude Code or Codex, run by a person in a terminal or by a runner with no terminal.
[3] command skill: a skill file whose body is a job's prompt, marked so that only a person or a runner starts it, never the agent by itself.

## Business logic — TL;DR

- **Asking** (`SKILL.md`) - when to ask the person and when to decide alone, and the one block a question is written in; an agent that has its own tool for asking uses that tool instead.
