Fixes the user's driver [1] choice — `claude` or `codex`, listed in that order on every surface — with the label each one reads as ("Claude Code", "Codex"), the check that a value names a driver at all, and the rule that maps the implementation recorded on an agent [2] back to the driver the user chose. It depends on nothing, so the dashboard, the registry's preference check and the agent spec all read this one list.

## Context

**User story**: the user picks a driver in the launcher and in Settings; the dashboard shows an agent's driver by its label; an agent that ran in a cloud session or on a GitHub Actions runner still shows as Claude Code.

## Glossary

[1] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude` or `codex`; the driver implementations are `claude-code`, `codex`, `github-actions`, `claude-web` and `fake`.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).

## Business logic — TL;DR

- **Two drivers, in one order** - `claude` then `codex`, labeled "Claude Code" and "Codex", and every surface lists them in that order.
- **Only a known name is a driver** - a value outside the list does not name a driver, so a hand-edited preference or an unknown agent spec is not taken as one.
- **An implementation maps back to the driver** - `claude-code`, `claude-web` and `github-actions` are all `claude`; `codex` is `codex`; the fake implementation, or one from a newer version, maps to no driver.

## Business logic

### Two drivers, in one order

#### Context

See `## Context`.

#### Business logic

The drivers [1] the user can pick are exactly `claude` and `codex`, in that order, and each has one label: "Claude Code" and "Codex". Adding a driver is one entry here plus its implementation; the dashboard's per-driver table is keyed by this list, so a driver missing from that table fails the build rather than being silently absent from the dashboard.

### Only a known name is a driver

#### Context

**Problem**: the driver name travels through files the user can edit (the registry's preferences, an agent spec), so an arbitrary string must not be treated as a driver.

#### Business logic

A value names a driver [1] only when it is one of the two names above; anything else, including an absent value, does not. The callers that read preferences and start agents [2] decide what to do with a value that is not a driver.

### An implementation maps back to the driver

#### Context

**Problem**: an agent's record says which implementation ran it (`claude-code`, say), while the choice the user made and the label the dashboard shows are the driver's (`claude`); one driver has several implementations because it can run in several places.

#### Business logic

An implementation id maps to the driver [1] that owns it. `claude-code` (this machine), `claude-web` (a cloud session) and `github-actions` (an Actions runner) are all `claude`: every place Claude runs is still Claude, and where it runs is the agent's [2] location [3], not its driver. `codex` maps to `codex`. The fake implementation, an absent id, or an id from a newer version that no driver claims maps to no driver, and the caller has no label to show for it.
