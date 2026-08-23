Settles an agent's configuration across the tiers that can set it — what the agent itself was told, the repo's `the-framework.yml`, and the wider tiers around them — and reports which tier decided each setting.

## Business logic — TL;DR

- **Nearest tier wins, per setting** - the closest tier that actually set a setting decides it; a tier that said nothing about a setting does not participate in it at all.
- **Silence is not "off"** - a setting nobody set falls to its built-in default: vanilla and transparent off, and the handoff at the `pr` rung.
- **Every decision is attributable** - the resolved configuration carries which tier won each setting, and settings left at their default carry no source.
- **An agent narrates only what was configured** - the startup summary lists each set setting with its value and the tier that supplied it, and an agent with no configuration anywhere says nothing.

## Business logic

### Nearest tier wins, per setting

#### User story

A project puts its defaults in `the-framework.yml`; the dashboard lets the user override one of them for a single agent, including turning off something the repo file turned on.

#### Business logic

The tiers are ordered nearest first — what this agent was told, then the project-user tier, then the repo's `the-framework.yml`, then the global tier. For each setting, the nearest tier that set it decides it, and a tier that left it unset is ignored for that setting rather than counting as a "no". This is what lets a project override only the settings it names, and what lets an explicit "off" beat a nearer-to-the-repo "on".

The handoff level is resolved the same way as the two mode switches, so how far a finished agent publishes itself is configurable at every tier.

#### Rationale

The tiers used to combine by logical OR, which meant any tier could only ever turn a mode *on* — no tier could say "off". A per-project override of a global setting cannot be built on that. The switch to nearest-wins leaves absent-everywhere behavior identical; the one changed behavior is that an explicit "off" in a nearer tier now wins.

### Defaults when nobody decided

#### User story

A user who has configured nothing still gets a working agent that hands its work back without being asked.

#### Business logic

A setting no tier set resolves to its built-in default: the built-in system prompt stays on, transparent mode stays off, and the handoff resolves to `pr` — the agent pushes its branch and opens a draft pull request. Merging sits one rung above that default, because landing work on the default branch is not reversible the way pushing a branch is.

### Saying which tier decided

#### User story

When a mode is in force, the user should be able to tell whether it came from their own choice or from a file in the repo, without going to look.

#### Business logic

The resolved configuration records the winning tier's name for each setting a tier actually set; a setting left at its default records nothing. The agent's startup summary lists those settings as name, value and deciding tier — for example `vanilla=off (flag), handoff=local (the-framework.yml)` — and is empty when nothing anywhere was configured, so an unconfigured agent narrates nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
