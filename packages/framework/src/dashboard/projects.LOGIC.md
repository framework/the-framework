The read side of the registered projects: one summary per project for the sidebar and the launcher [1] (its name, whether it is still activated, when it was last active, and the defaults its repo file [2] sets), the list itself, which serves only projects whose directory is on disk while keeping every registration, the lookup from a project id to its path, and the shape every cross-project projection is read in, which tells "nothing found" from "could not read".

## Context

**User story**: the sidebar lists the user's projects by name, greys out one that lost its `.the-framework/` marker, and orders them by activity; the launcher [1] on a project shows what an agent [3] started there will resolve to from the project's `the-framework.yml`. A project whose directory the user renamed or deleted disappears from the sidebar without any action, and is back the moment the directory is.

**Problem**: a registration whose directory is gone looks, when listed, exactly like a project that merely lost its marker: a grey "not activated" entry with no files and nothing to click to make it go away. Skipping it while keeping its registration removes the ghost without a removal the user did not ask for.

## Glossary

[1] launcher: the Start form on a project's own page.
[2] the repo file: `the-framework.yml` at a project's root: per-repo defaults that travel with the code.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] registry: `~/.the-framework.json`, which lists the projects and keeps the user's preferences.
[5] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[6] sweep: a background job the daemon runs on its clock.

## Business logic — TL;DR

- **A project's summary** - its registry id, its path, the directory's name as its display name, whether the `.the-framework/` marker is present, the newest activity among its agents, and the repo file's defaults when it sets any, each read forgivingly.
- **Only projects whose directory is on disk are served** - a renamed or deleted directory leaves the list and comes back on the next read once it is there again; the registration is never pruned.
- **A project id resolves to its path** - only for a project currently on disk; anything else is unknown.
- **A projection read says which projects it saw whole** - every cross-project read returns its items together with the ids of the projects every source answered for, so a caller that announces new items can tell an empty project from an unreadable one.

## Business logic

### A project's summary

#### Context

See `## Context`.

#### Business logic

A summary is derived from a registry [4] record: the record's id, which is stable and safe in a URL; the absolute path; the display name, which is the last segment of the path; whether the project is activated, meaning its `.the-framework/` marker is present; and its last activity. The last activity is the newest among the project's agents [3], live and archived [5] alike, taking each agent's last-update time or, failing that, its start time; a project with no agents has no last activity. The repo file's [2] defaults are read fresh on every summary, so an edit to `the-framework.yml` shows on the next read; when the project sets nothing, or the file is malformed, which the loader reports as empty rather than failing, the summary carries no defaults at all. Every read is forgiving: a failed marker check reads as not activated, failed agents read as no activity, a failed repo file read as no defaults, and none of them fails the summary. What the daemon's sweeps [6] currently find wrong with a project is not part of the summary; the dashboard's project list attaches it from the daemon's error state (`../project-errors.ts`).

### Only projects whose directory is on disk are served

#### Context

See `## Context`.

#### Business logic

The registry's [4] records are read, and a record whose path is not a directory on disk, or whose check fails, is skipped. The registry itself is left alone: the record is skipped, not pruned, so a directory that comes back, renamed back or on a remounted volume, is a project again on the next read. Every kept record is summarized as above. A registry that cannot be read serves no projects.

### A project id resolves to its path

#### Context

**Business logic story**: every read the dashboard makes names a project by its id, and the rules underneath run against the project's directory; the resolution from one to the other happens here, once.

#### Business logic

A project id resolves to the absolute path of the registry [4] record with that id, provided the record's directory is on disk at the time of the lookup; a missing directory or an unknown id resolves to nothing.

### A projection read says which projects it saw whole

#### Context

**Problem**: a project whose sources cannot be read contributes no items, which is exactly what a project with nothing waiting contributes. A page that only renders the list does not care; a notification feed that keeps a baseline of what it has already announced must not mistake an unreadable project for one that went quiet.

#### Business logic

Every cross-project projection is read as two things: the items found, possibly only part of them when some project could not be read, and the ids of the projects every source answered for, meaning their share of the items is all of it. Renderers read the items and ignore the rest; only a caller keeping a baseline reads the ids.
