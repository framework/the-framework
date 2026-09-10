Makes the browser's address the dashboard's selection: the URL path alone says what the dashboard is looking at — the Overview [3], a project home [4], one agent view [5], Settings [6], the cross-project tickets list, a project's tickets, one ticket, or a ticket's plan — and this file reads a path into that selection and writes a selection back into a path. Because the selection is the address, a page is a link the user can paste, reload and open twice, and Back and Forward work without any extra bookkeeping.

## Context

**User story**: the user opens `/` and sees the Overview [3]. Clicking a project takes the address to `/<project id>`, opening one of its agents [1] takes it to `/<project id>/<agent id>`, and pasting that address into a new tab lands on the same agent. `/settings` opens Settings [6], `/tickets` lists every project's tickets, `/<project id>/tickets` one project's tickets, and a ticket's own page and its plan each have an address of their own.

**Problem**: a selection kept as several pieces of in-memory state drifts, and the dashboard ends up showing a project, an agent and a view that disagree with one another. With the address as the one source of the selection, nothing can disagree with it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[2] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[3] the Overview: the dashboard's cross-project page at `/`.
[4] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[5] agent view: one agent's page.
[6] Settings: the settings page.
[7] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.

## Business logic — TL;DR

- **The route patterns** - eight shapes of path, each selecting exactly one thing: the Overview, Settings, the cross-project tickets list, a project home, an agent view, a project's tickets, one ticket, or a ticket's plan.
- **Reserved words never collide with ids** - `settings` and `tickets` are reserved as a first segment, `tickets` as a second and `plan` as a fourth, and only the exact word is reserved, because no project id, agent id or ticket file can ever be that bare word.
- **Reading a path is lenient** - anything unparseable is the Overview, empty and extra segments are ignored, and a segment that cannot be percent-decoded is kept as typed.
- **Writing a path** - the inverse of reading, with a view outranking stale ids, no agent without a project, no plan without a ticket, and every segment percent-encoded so the path reads back to the same selection.
- **What the path does not carry** - the query string is not part of the selection; the tickets view keeps its filters there under its own rules.

## Business logic

### The route patterns

#### Context

See `## Context`.

#### Business logic

The path is split on `/` and read segment by segment:

- `/` is the Overview [3]: no project and no agent [1] selected.
- `/settings` is Settings [6], which belongs to no project.
- `/tickets` is the cross-project tickets list: every project's tickets, one section per project, with no single project selected.
- `/<project id>` is the project's home [4].
- `/<project id>/<agent id>` is the agent view [5] of one agent. The second segment is the agent id [2] — never the id of the agent's driver session [7], because only the agent id is The Framework's own, stable, and already the name of the agent's checkout directory.
- `/<project id>/tickets` is the project's tickets page.
- `/<project id>/tickets/<ticket file>` is one ticket's own page, named by the ticket's filename on the `agent-data` branch (`<date>_<slug>.md`). A ticket belongs to one project, so the cross-project list never names a ticket.
- `/<project id>/tickets/<ticket file>/plan` is that ticket's plan, rendered as markdown.

### Reserved words never collide with ids

#### Context

**Problem**: a fixed word in the address must never be mistaken for a project or an agent, and a real project or agent must never be swallowed by a fixed word. The ids are built so that the collision is impossible, and the reservation is kept to the exact word so that ids merely resembling it still route to their project or agent.

#### Business logic

- A project id is built from the project's path as `<slugified folder name>-<hash>`, so every real project id carries a `-<hash>` suffix and is never the bare word `settings` or `tickets`.
- An agent id [2] is derived from the moment the agent started, so it is never the bare word `tickets`.
- A ticket file is a `.md` filename, so it is never the bare word `plan`.
- Only the exact word is reserved: `/settings-a1b2` and `/my-settings` select projects, `/tickets-a1b2` and `/my-tickets` select projects, and `/my-repo/tickets-ab` selects an agent [1] of project `my-repo`.
- `plan` only means the plan view as the fourth segment, sitting past a ticket file. `/<project id>/tickets/plan` selects a ticket whose file is named `plan`, with no plan view.

### Reading a path is lenient

#### Context

**Problem**: an address may be typed by hand, come from an old link, or carry a trailing slash; reading must never fail on it, and a bad address must land somewhere sensible.

#### Business logic

- The selection is read from the path only. The query string and the fragment are not part of it.
- Empty segments are dropped, so leading, trailing and doubled slashes change nothing: `/my-repo/run-1/` selects the same agent [1] as `/my-repo/run-1`.
- Segments past what a pattern uses are ignored: `/settings/anything` is Settings [6], `/tickets/anything` is the cross-project tickets list, `/<project id>/<agent id>/whatever` is the agent view [5], and `/<project id>/tickets/<ticket file>/whatever` is the ticket's page.
- Every segment is percent-decoded, so `a%20b` reads as `a b` and `c%2Fd` as `c/d`. A segment whose escapes are malformed is kept exactly as typed instead of being rejected.
- An empty path is the Overview [3]. Any other first segment that is not a reserved word is a project id, whether or not such a project exists.

### Writing a path

#### Context

**Business logic story**: the dashboard navigates by handing this file a selection and putting the resulting path in the address bar; the rules for pushing versus replacing a history entry and for reacting to Back and Forward live in `use-route.ts`.

#### Business logic

Writing is the inverse of reading, with precedence rules for selections that carry more than they should:

- Settings [6] outranks everything: a selection marked as Settings writes `/settings` even if it still carries a project id or an agent id [2].
- The tickets view with no project writes `/tickets`; with a project it writes `/<project id>/tickets` and ignores any agent id it still carries; with a ticket file it appends the file; with the plan flag and a ticket file it appends `/plan`; the plan flag without a ticket file is dropped rather than writing a dangling `/plan`.
- No project writes `/`, even when an agent id is present: there is no agent [1] without a project.
- A project with an agent id writes `/<project id>/<agent id>`; a project alone writes `/<project id>`.
- Every segment is percent-encoded, so an id containing a space or a slash survives the round trip. Reading a written path gives back the selection it was written from.

### What the path does not carry

#### Context

**User story**: on a tickets page the user narrows the list with filters, and the address reflects them so the filtered list can be shared; going back to the page restores the filters.

#### Business logic

Only the path is the selection. The tickets view's filters ride on the query string, mirrored there and read back by the rules in `components/TicketsPage.tsx`; this file neither reads nor writes a query string, so the filters never alter which page is selected.
