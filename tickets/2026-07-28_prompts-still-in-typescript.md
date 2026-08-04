Priority: 5
Topics: [the-framework]
GitHub: [#1347](https://github.com/gemstack-land/the-framework/issues/1347)

# Four agent-facing prompts are still written in TypeScript

## TLDR

`prompts/README.md` claims nothing agent-facing is written in TypeScript any more (#551), but `steps.ts` still builds four prompts as TS strings: `buildPrompt` (greenfield), `extendPrompt` (existing codebase), `scaffoldPrompt` (empty workspace), `improvePrompt` (fix blockers). Move them to `prompts/` like the rest, so all prompting lives in one place and can be reviewed as prose. Maintainer endorses ("that would be 💯"), with permission to postpone if it turns out complex.

## Why it matters

Changing what we tell an agent in those four cases means editing code, and they're invisible to anyone reading `prompts/`. #1224 was a one-word prompt edit that had to go through a TypeScript file and a changeset.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1347](https://github.com/gemstack-land/the-framework/issues/1347), created 2026-07-28, labels: `priority: medium`, `the-framework ♻️`, 1 comment (folded above).
