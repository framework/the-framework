The single table of agent options the dashboard offers — Transparent, Disable system prompt, Post-merge cleanup, the three publish rungs (Push branch, Open PR, Auto-merge) and Browser — together with the rules that decide which of them currently mean anything.

## User story

The user sets how their agents should run: whether the framework wraps the coding agent at all, whether finished work is pushed, turned into a pull request and merged, and whether the agent gets a real browser. The same options appear in the launcher, on the settings page, and in a finished agent's Resume composer, and must read identically in all three.

## Business logic — TL;DR

- **One table, every surface** - the launcher, the settings page and the Resume composer all show these rows and these rules, so no surface can offer an option the others don't or apply a different rule to it.
- **Rows show the effective value, never the stored one** - an option the agent will ignore reads as off and greyed, with the reason spelled out on the row itself.
- **Transparent is the master off-switch** - while it is on, Disable system prompt, Post-merge cleanup and Browser all read as off and cannot be changed.
- **Publishing is one ladder, shown as three rungs** - Push branch, Open PR and Auto-merge are three views of the agent's handoff level; each rung is only reachable while the rung below it is on, and unticking one lowers the level rather than leaving an upper rung armed with nothing beneath it.
- **Browser only applies to Claude Code** - under the Codex driver the row is off and greyed, because the browser reaches the agent through Claude Code's own tool configuration.
- **Resume offers only what a continuation can still change** - a finished agent's composer shows the publish ladder and Browser, and nothing that shapes the prompt.

## Business logic

### One table, every surface

#### User story

See `## User story`.

#### Business logic

The launcher renders the options as dropdown items, the settings page renders them as page rows, and a finished agent's composer renders a subset of them; all of them read the same row list with the same labels, one-line descriptions, long tooltips, effective checked state, disabled state and disabled reason. Ticking or unticking a row writes to the user's preferences, so a change made on one surface is the change every other surface shows.

#### Rationale

The rules between the options are not decoration — they decide whether ticking a box changes anything at all. A second hand-written copy of the table on a second surface would drift away from them.

### Rows show the effective value

#### User story

A greyed or unticked box must never leave the user guessing why, and must never claim an option is on while the agent ignores it.

#### Business logic

A row's ticked state is what the agent will actually do, not what is stored: an option overridden by another option reads as off. A row that is inert for a reason of its own is disabled and carries a short reason ("off while Transparent is on", "nothing to open while Push branch is off", "nothing to merge while Open PR is off", "only on Claude Code"), shown in the row's own description rather than only in its tooltip.

#### Rationale

A disabled dropdown item takes no pointer events, so its tooltip never opens — the reason has to be visible on the row itself.

### Transparent is the master off-switch

#### User story

The user wants the coding agent run exactly as the bare CLI, with nothing of The Framework added.

#### Business logic

Transparent runs the agent with no framework system prompt, no controls, no dashboard, no guard and no backlog loop. While it is on, Disable system prompt, Post-merge cleanup and Browser all read as off and are disabled — the framework they configure is not running.

### The publish ladder

#### User story

When an agent finishes, the user chooses how far the work travels: stay local, push the agent branch, open a draft pull request, or have that pull request merged.

#### Business logic

Push branch, Open PR and Auto-merge are three rungs of the one handoff level (`local` < `push` < `pr` < `merge`). A rung is ticked when the level reaches it, so Open PR being on implies the branch is pushed without the user having to say so. Unticking a rung lowers the level to the rung below it — unticking Open PR leaves `push`, unticking Push branch leaves `local`, which is how "publish nothing" is reachable here. Open PR is disabled while Push branch is off, and Auto-merge while Open PR is off. Open PR opens a *draft* pull request: it requests no review but still appears on the needs-you queue. Auto-merge uses GitHub's own auto-merge where the repository allows it, so the work lands when checks pass, and merges directly otherwise.

These rows set what every newly started agent begins from; an individual agent's own action bar can still lower its ladder afterwards.

#### Rationale

An earlier pair of independent boxes could express a contradictory state — a pull request armed without a push — and "Open PR: off" silently still pushed the branch, which read to users as "publishing off". A strict ladder cannot express that state. Auto-merge stays off by default, unlike the other rungs: publishing a branch is reversible, landing it on the default branch is not; the routines that merge their own work say so per job instead.

### Resume offers only what a continuation can still change

#### User story

The user resumes a finished agent for another leg of work and wants to set how that leg publishes.

#### Business logic

A finished agent's composer offers the publish ladder and Browser — the options the next leg will actually arm — with the same labels, gating and effective values as everywhere else. The prompt-shaping options (Transparent, Disable system prompt, Post-merge cleanup) are left out because the resumed conversation already carries its framing, and the run target, driver and model are pinned by the conversation being continued.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
