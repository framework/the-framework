The "Maintainability" preset of the launcher, deliberately minimal so that its results can be judged before a more explicit prompt is written: the agent [1] refactors the target to make it as maintainable as possible, by looking for maintainability red flags and fixing them. The target is the preset's one parameter, "What to refactor for maintainability", filled by the rule in `src/preset-prompt.ts`; left blank, it is the session the preset was launched from, or the "entire codebase" when there is none. The same prompt is also written to a project as `.the-framework/presets/maintainability.md`, which is how the follow-up in `on_before_mergeable_prompt.md` queues a maintainability pass over one agent's changes for a later agent to work.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
