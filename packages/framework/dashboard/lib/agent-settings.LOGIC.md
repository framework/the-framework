Fixes the words a surface uses for the model when an agent's [1] start pins none: "the CLI's own default", meaning the coding agent [2] picks its own model. The models each coding agent offers come from the coding agents themselves (`models.ts`).

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **No model pinned, in words** - a surface that has no model to name says "the CLI's own default" rather than borrowing the first entry of a list, so it never promises a model that will not be passed.
