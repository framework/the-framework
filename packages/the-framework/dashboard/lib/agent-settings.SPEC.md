The dashboard's names for the three things every agent start is made of — which driver, which model, and which run target — plus the one-line summary of them that several surfaces show.

## Business logic — TL;DR

- **One set of names for all surfaces** - the launcher's driver tree, the gear's "Run on" list and the Routine work card's tooltips all use the same driver names, model names and run-target wording, so no surface can name a setting differently from another.
- **Each driver offers its own models** - Claude Code offers Fable, Opus, Sonnet and Haiku; Codex offers GPT-5 Codex, GPT-5 and o3; menus list them in that order.
- **Run targets are named for the user** - `local` reads "This machine", `actions` reads "GitHub Actions", `web` reads "Claude web".
- **A model is never invented** - the summary names a model only when the pinned model belongs to the selected driver's own list; a model pinned for the other driver, or none pinned at all, reads "the CLI's own default" rather than borrowing the first entry, because naming a model the agent will not be passed is worse than saying nothing.
- **The summary is driver, model, run target** - the three, in that order, as one line; an unrecognised stored driver reads as Claude Code and a missing run target as this machine.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
