Fixes what the dashboard calls the three things an agent's [1] start is made of — which coding agent [2] drives it, which model it runs on, and where it runs — and renders them as one line for surfaces that must state settings the user cannot see from where they are standing, such as the tooltip on a routine's [3] card.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] coding agent: the CLI doing the actual work: Claude Code or Codex.
[3] routine: a preset the daemon fires on its own on a schedule.
[4] driver: a coding agent wrapped as a black box. The user's driver choice is `claude` or `codex`.
[5] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[6] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).
[7] the launcher: the Start form on a project's own page.

## Business logic — TL;DR

- **The models each coding agent offers** - Claude Code offers "Fable", "Opus", "Sonnet" and "Haiku"; Codex offers "GPT-5 Codex", "GPT-5" and "o3". Every menu lists them in that order, and every entry is a model the coding agent [2] actually accepts.
- **Where an agent runs, in words** - the three locations [5] are named "This machine", "GitHub Actions" and "Claude web" wherever the user picks one, in the options menu and on the Settings page alike.
- **The settings as one line** - the coding agent [2], the model and the location [5], joined by a middle dot, as in "Claude Code · Opus · This machine". A driver [4] choice that names no coding agent The Framework can drive reads as Claude Code, and an unset location reads as "This machine".
- **Never name a model the agent will not get** - a model is named only when it belongs to the selected coding agent's [2] own list. A model pinned while the other coding agent was selected, or no model at all, reads as "the CLI's own default" rather than borrowing the first entry of the list, so the line never promises a model that will not be passed. The launcher [7] follows the same rule.
