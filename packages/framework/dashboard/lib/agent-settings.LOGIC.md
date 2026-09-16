Fixes what the dashboard calls the three things an agent's [1] start is made of — which coding agent [2] drives it, which model it runs on, and where it runs.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).

## Business logic — TL;DR

- **The models each coding agent offers** - Claude Code offers "Fable", "Opus", "Sonnet" and "Haiku"; Codex offers "GPT-5 Codex", "GPT-5" and "o3". Every menu lists them in that order, and every entry is a model the coding agent [2] actually accepts.
- **Where an agent runs, in words** - the three locations [3] are named "This machine", "GitHub Actions" and "Claude web" wherever the user picks one, in the options menu and on the Settings page alike.
- **No model pinned, in words** - a surface that has no model to name says "the CLI's own default" rather than borrowing the first entry of the list, so it never promises a model that will not be passed.
