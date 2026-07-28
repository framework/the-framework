`parsePrompt` — parses a prompt bundle (a `SKILL.md`-shaped markdown file) into a frozen `Prompt`, plus `PromptError`.

## TLDR

- Reuses `@gemstack/ai-skills`' `parseSkillManifest` for frontmatter + body, then reads prompt-specific fields from `metadata`: `loopId` (dispatch id, defaults to the manifest `name`), `title` (defaults to name), `passes` (positive integer, default 1), `event`.
- Throws `PromptError` on an empty instructions body, a non-kebab id, or a bad `passes` value; `event` is omitted (not empty) when unset; `appliesTo` copied from the manifest and frozen.
