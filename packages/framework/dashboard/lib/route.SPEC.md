Defines the dashboard's addresses and translates between a URL and what the dashboard is looking at, in both directions.

## Business logic — TL;DR

- **The URL is the selection** - which project, which agent, which ticket the dashboard shows is carried entirely by the address, not tracked separately.
- **The address map** - the Overview, a project's launcher, one agent, Settings, the cross-project ticket list, one project's tickets, one ticket, and that ticket's plan.
- **Reserved words that cannot collide** - `settings`, `tickets` and `plan` are safe to reserve because no real project id, agent id or ticket name can ever be those bare words.
- **An unreadable address is the Overview** - a hand-typed URL is treated as input: nonsense lands on the Overview, extra segments are ignored, and a broken escape sequence is taken literally.

## Business logic

### The URL is the selection

#### User story

The user navigates the dashboard, uses the browser's back button, bookmarks a page, or shares a link to what they are looking at.

#### Business logic

What the dashboard shows is read from the address alone. There is no second record of the selection to fall out of step with it.

#### Rationale

The selection was once three separate pieces of state in the interface, each guessing at the others, which was the source of a family of bugs where the dashboard disagreed with itself about what was selected.

### The address map

#### User story

Each thing the user can look at needs its own address.

#### Business logic

The root address is the Overview. A project's own address is its launcher, and a further segment names one agent within that project. `settings` at the top level is the Settings view. `tickets` at the top level is the cross-project ticket list — every project's backlog with a section each and no single project selected. Under a project, `tickets` is that project's ticket list, a further segment names one ticket by its filename, and `plan` after that ticket shows the ticket's plan.

A ticket belongs to one project, so the cross-project list never names a ticket, and a plan belongs to one ticket, so a plan is only ever addressed after a real ticket — `tickets/plan` with no ticket in between names nothing.

The agent segment carries the agent id, never the agent's conversation id with its driver: only the agent id belongs to The Framework, is stable, and is already the name of the agent's worktree directory.

### Reserved words that cannot collide

#### User story

A project could in principle be called "settings" or "tickets", and then its address would be ambiguous.

#### Business logic

Reserving these words is safe by construction. Every project id ends in a hash suffix derived from the project's path, so no project id is ever one of these bare words. Every agent id is derived from its start time, so no agent id is either. And a ticket is named by a markdown filename, so no ticket is ever the bare word `plan`.

### An unreadable address is the Overview

#### User story

Someone types or edits a dashboard URL by hand.

#### Business logic

A URL is treated as untrusted input. An address that names nothing recognisable is the Overview, segments beyond the ones that mean something are ignored, and a segment with a malformed escape sequence is taken exactly as written rather than rejected. Both ids are URL-safe by construction, but segments are still escaped when a path is built and unescaped when one is read.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
