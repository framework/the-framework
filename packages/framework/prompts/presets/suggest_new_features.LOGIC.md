The "Suggest new features" preset of the launcher: the agent [1] studies what the product does today, proposes, as a product manager would, net-new features the product should have next, writes each proposal as a ticket, and shows a short summary as a view [2]. Its tooltip reads "Propose net-new features as tickets in `tickets/`". It takes no parameter and stops at no gate: a proposal is a reviewable ticket, so the user triages it afterwards instead of approving mid-run, which also keeps the preset usable unattended [3]. It differs from its neighbors on purpose: "Suggest new tickets" expands a line the user typed, "Market research" looks outward at the market, and "Suggest tickets to work on" picks among tickets that already exist.

## Context

**User story**: the user clicks "Suggest new features" in a project's launcher and finds new tickets proposing capabilities the product lacks, none duplicating an existing ticket or something already built, with a summary of the proposals in the dashboard's right rail.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[3] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[4] skill: one of the four capabilities an agent is taught (`branches`, `tickets`, `queue`, `logs`), each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.

## Business logic — TL;DR

- **Study the product first** - the agent skims the README, the docs and the main user-facing surfaces, and the existing tickets through `tickets list` of the `tickets` skill [4].
- **Propose net-new features** - thinking like a product manager, it proposes capabilities a user would want, not bugs, refactors or chores; it skips anything an existing ticket already covers or that is already built, and favors features that fit the product's direction and are worth building.
- **One ticket per proposal** - each proposed feature is written as a new ticket with `tickets put <DATE>_<SLUG>.md`, in the ticket format the `tickets` skill gives.
- **Summarize without stopping** - a short summary of what was proposed is shown via `showMarkdown()`, the `show-markdown` block of `protocols/await.md`, which becomes a view [2].
