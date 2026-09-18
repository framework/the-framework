Fixes the user's driver [1] choice — `claude-code` or `codex`, listed in that order on every surface — with the label each one reads as ("Claude Code", "Codex"), the check that a value names a driver at all, and the rule that maps the driver an agent's [2] record names back to the choice. The names are `agent-driver`'s own, the ones an agent's card carries, so the pick handed to a project's start hook as `DRIVER` and the record that comes back say the same word. It depends on nothing, so the dashboard and the registry's preference check both read this one list.

## Context

**User story**: the user picks a driver in the launcher and in Settings; the dashboard shows an agent's driver by its label; an agent recorded as having run in a cloud session or on a GitHub Actions runner still shows as Claude Code.

## Glossary

[1] driver: the coding agent a person picks for an agent: `claude-code` or `codex`. An agent's record names the driver that ran it; older records also name `claude-web` and `github-actions`.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.

## Business logic — TL;DR

- **Two drivers, in one order** - `claude-code` then `codex`, labeled "Claude Code" and "Codex", and every surface lists them in that order.
- **Only a known name is a driver** - a value outside the list does not name a driver, so a hand-edited preference is not taken as one.
- **A record's driver maps back to the choice** - `claude-web` and `github-actions` are `claude-code`; the two choices map to themselves; anything else maps to no driver.

## Business logic

### Two drivers, in one order

#### Context

See `## Context`.

#### Business logic

The drivers [1] the user can pick are exactly `claude-code` and `codex`, in that order, and each has one label: "Claude Code" and "Codex". The dashboard's per-driver table is keyed by this list, so a driver missing from that table fails the build rather than being silently absent from the dashboard.

### Only a known name is a driver

#### Context

**Problem**: the driver name travels through a file the user can edit (the registry's preferences), so an arbitrary string must not be treated as a driver. The old name of Claude Code, `claude`, is such a string now.

#### Business logic

A value names a driver [1] only when it is one of the two names above; anything else, including an absent value, does not. The callers that read preferences decide what to do with a value that is not a driver.

### A record's driver maps back to the choice

#### Context

**Problem**: records of agents [2] from before name the place Claude ran in as the driver (`claude-web`, `github-actions`), while the label the dashboard shows is the choice's.

#### Business logic

`claude-web` (a cloud session) and `github-actions` (an Actions runner) map to `claude-code`: every place Claude ran is still Claude. `claude-code` and `codex` map to themselves. A fake driver, an absent value, or a name from a newer version maps to no driver, and the caller has no label to show for it.
