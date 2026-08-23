Builds what the dashboard's Overview page shows: which agents are working right now, the agent queue of every project, and, per project, whether it has any tickets at all. Purely a reading of files The Framework already writes — nothing here changes anything.

## User story

- The user opens the dashboard and wants one at-a-glance answer to "what is going on across all my projects" without visiting each project in turn.
- A user who has just registered a project follows the onboarding checklist, which needs to know whether that project has any tickets yet and which project to point them at first.

## Business logic — TL;DR

- **Working now** - every agent currently going, across all projects, most recently updated first.
- **The backlog** - each project's agent queue, plus the total number of entries still open across all of them.
- **Ticket presence, not ticket counts** - each project reports only whether it has any ticket, which is all the onboarding checklist needs.
- **Projects in most-recently-active order** - the checklist acts on the first one, so the order is itself part of the answer.
- **A project that cannot be read contributes nothing** - it never fails the whole page.

## Business logic

### The Overview payload

#### User story

See `## User story`.

#### Business logic

The page reports the number of registered projects, the total number of agent queue entries still open across all of them, the agents working right now, each project's own agent queue, and one row per project saying whether that project has any tickets.

The agent queue is read once and reused for both the total and the per-project rows, so the same backlog is not read twice per refresh.

Projects are listed most recently active first, because the onboarding checklist takes the first project in the list as the one to act on — the ordering is part of the answer even though the activity timestamps themselves are not reported.

A project whose ticket folder cannot be read is reported as having no tickets rather than failing the page.

#### Rationale

Only presence is reported for tickets, never a count, and past agents are not summarised at all. The page used to carry per-project agent counts, how past agents ended, and a two-week activity window; the surfaces that showed them were removed, leaving those numbers computed for nobody — at the cost of reading every project's entire agent archive on every poll, twice per cycle across the two pollers. What remains is only what somebody actually reads.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
