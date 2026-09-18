Fixes what the dashboard calls the two picks an agent's [1] start carries — which coding agent [2] works it, and which model it runs on.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.

## Business logic — TL;DR

- **The models each coding agent offers** - Claude Code offers "Fable", "Opus", "Sonnet" and "Haiku"; Codex offers "GPT-5 Codex", "GPT-5" and "o3". Every menu lists them in that order, and every entry is a model the coding agent [2] actually accepts.
- **No model pinned, in words** - a surface that has no model to name says "the CLI's own default" rather than borrowing the first entry of the list, so it never promises a model that will not be passed.
