The "UX (auto)" preset of the launcher: the agent [1] lists every UI flow of the target, rates the user experience of each, improves the badly rated ones in one commit per flow, and closes with the old and new ratings and links to the commits. It is unattended [2] by design: it ends in work rather than in a gate, so an agent started from it finishes on its own. The target is the preset's one parameter, "What to review the UX of", filled by the rule in `src/preset-prompt.ts`; left blank, it is the name the agent the preset was launched from gave its work, or the "entire codebase" when there is none. The prompt is also written to a project as `.the-framework/presets/ux.md`, so a queue entry can name it.

## Context

**User story**: the user clicks "UX (auto)" in a project's launcher, optionally naming what to review, and without answering anything gets back one commit per improved UI flow and a rated list of every flow, before and after.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.

## Business logic — TL;DR

- **List every UI flow first** - before starting to work, the agent lists all UI flows of the target, skipping none.
- **Rate each flow** - every flow gets a UX rating from 0 (unusable) to 10 (perfect) with a reason.
- **Improve the badly rated flows, one commit each** - each improved flow is a separate commit, and the agent works until the result is exceptionally good: mostly-perfect ratings are read as laziness, and it scrutinizes everything on its own rather than waiting to be prompted again.
- **Summarize old rating to new rating** - the closing summary repeats the flow list with each flow's old and new rating and links to the commits.
