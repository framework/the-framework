Makes the browser's address the dashboard's selection: the URL says what the dashboard is looking at. Its path names the page — the Overview [3], a project home [4], one agent view [5], Settings [6], or a page a module [8] adds — and its `project` query parameter names the one project every page shows. This file reads an address into that selection and writes a selection back into an address. Because the selection is the address, a page is a link the user can paste, reload and open twice, and Back and Forward work without any extra bookkeeping.

## Context

**User story**: the user opens `/` and sees the Overview [3]. Clicking a project takes the address to `/<project id>`, opening one of its agents [1] takes it to `/<project id>/<agent id>`, and pasting that address into a new tab lands on the same agent. `/settings` opens Settings [6]. A page a module [8] adds has its own word, such as `/logs` or `/tickets`, and the segments after the word are that page's own: `/tickets/<project id>/<ticket file>` is one ticket's page, if the installed tickets package brings such a page, and the address reserves nothing for it.

**Problem**: a selection kept as several pieces of in-memory state drifts, and the dashboard ends up showing a project, an agent and a view that disagree with one another. With the address as the one source of the selection, nothing can disagree with it.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.
[3] the Overview: the dashboard's cross-project page at `/`.
[4] project home: a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used to say something to an agent).
[5] agent view: one agent's page.
[6] Settings: the settings page.
[7] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[8] module: a package that adds to the dashboard (pages, Overview cards, side-rail tabs, what an agent's page shows, actions on the links pages show, Settings sections): its browser part, named by the package's `exports["./dashboard"]`, reads its data through its own package's command, or through its own server part, named by `exports["./server"]`, which the daemon calls in its own process. A module comes from a project's dependencies, or is built into the dashboard and loaded for every project, as the Files module is.

## Business logic — TL;DR

- **The route patterns** - five shapes of path, each selecting exactly one thing: the Overview, Settings, a module's page, a project home, or an agent view.
- **Reserved words never collide with ids** - `settings` is the one reserved first segment, and only the exact word is reserved, because no project id can ever be that bare word; every other first segment without a dash names a module's page, since every project id has one, so the dashboard reserves nothing for any module's word, `tickets` included.
- **Reading a path is lenient** - anything unparseable is the Overview, empty and extra segments are ignored, and a segment that cannot be percent-decoded is kept as typed.
- **Writing a path** - the inverse of reading, with a view outranking stale ids, no agent without a project, and every segment percent-encoded so the path reads back to the same selection.
- **The picked project** - the query parameter `project` names the one project every page shows; on a project's own page it can only be that project.
- **What else the query string carries** - nothing of the selection; a module's page may keep its own state there under its own rules, and a change of the picked project alone leaves that state in place.

## Business logic

### The route patterns

#### Context

See `## Context`.

#### Business logic

The path is split on `/` and read segment by segment:

- `/` is the Overview [3]: no project and no agent [1] selected.
- `/settings` is Settings [6], which belongs to no project.
- `/<word>`, where the word is a lowercase letter followed by lowercase letters and digits, is the page a module [8] adds under that word, with no project and no agent selected; the segments after it are the page's own, decoded. Which module, if any, claims the word is not the address's business: the shell decides, and says "No such page" when none does.
- `/<project id>` is the project's home [4].
- `/<project id>/<agent id>` is the agent view [5] of one agent. The second segment is the agent id [2] — never the id of the agent's driver session [7], because only the agent id is The Framework's own, stable, and already the name of the agent's checkout directory.

### Reserved words never collide with ids

#### Context

**Problem**: a fixed word in the address must never be mistaken for a project or an agent, and a real project or agent must never be swallowed by a fixed word. The ids are built so that the collision is impossible, and the reservation is kept to the exact word so that ids merely resembling it still route to their project or agent.

#### Business logic

- A project id is built from the project's path as `<slugified folder name>-<hash>`, so every real project id carries a `-<hash>` suffix and is never the bare word `settings`, nor any dash-less word a module's page takes.
- A first segment with no dash is never a project id, which is what lets a module's page take any such word without reserving it here. A word that is not `settings` and has no dash is read as a module's page.
- Only the exact word is reserved: `/settings-a1b2` and `/my-settings` select projects. Under a project, every second segment is an agent id: `/my-repo/tickets` selects the agent `tickets` of project `my-repo`, since no page hangs under a project.

### Reading a path is lenient

#### Context

**Problem**: an address may be typed by hand, come from an old link, or carry a trailing slash; reading must never fail on it, and a bad address must land somewhere sensible.

#### Business logic

- The selection is read from the path only. The query string and the fragment are not part of it.
- Empty segments are dropped, so leading, trailing and doubled slashes change nothing: `/my-repo/run-1/` selects the same agent [1] as `/my-repo/run-1`.
- Segments past what a pattern uses are ignored: `/settings/anything` is Settings [6], and `/<project id>/<agent id>/whatever` is the agent view [5]; a module's page keeps every segment after its word, since those are its own.
- Every segment is percent-decoded, so `a%20b` reads as `a b` and `c%2Fd` as `c/d`. A segment whose escapes are malformed is kept exactly as typed instead of being rejected.
- An empty path is the Overview [3]. A first segment of a lowercase letter followed by lowercase letters and digits is a module's page. Any other first segment that is not a reserved word is a project id, whether or not such a project exists.

### Writing a path

#### Context

**Business logic story**: the dashboard navigates by handing this file a selection and putting the resulting path in the address bar; the rules for pushing versus replacing a history entry and for reacting to Back and Forward live in `use-route.ts`.

#### Business logic

Writing is the inverse of reading, with precedence rules for selections that carry more than they should:

- Settings [6] outranks everything: a selection marked as Settings writes `/settings` even if it still carries a project id or an agent id [2].
- A module's page writes `/<word>` followed by its own segments, and outranks any project or agent id the selection still carries.
- No project writes `/`, even when an agent id is present: there is no agent [1] without a project.
- A project with an agent id writes `/<project id>/<agent id>`; a project alone writes `/<project id>`.
- Every segment is percent-encoded, so an id containing a space or a slash survives the round trip. Reading a written path gives back the selection it was written from.

### The picked project

#### Context

**User story**: at the top of the sidebar the user picks one project, and every page shows that project alone; the address keeps the pick, so a copied link, a reload and Back all keep it too.

#### Business logic

- `?project=<project id>` after any path names the picked project: the one project every page shows. Without the parameter, or with an empty one, no project is picked and every page shows every project.
- On a project's own pages (`/<project id>` and `/<project id>/<agent id>`) the picked project is that project or none. Reading `/<a>?project=<b>` gives the picked project `<a>`, and writing a project's own page with any project picked writes its own id: a page of one project is never filtered to another.
- The id is percent-encoded when written, and a written address reads back to the same selection and the same pick.

### What else the query string carries

#### Context

**User story**: on the tickets page a module brings, the user narrows the list with filters, and the address reflects them so the filtered list can be shared; going back to the page restores the filters. Picking another project in the sidebar while on that page keeps the filters.

#### Business logic

Apart from `project`, nothing in the query string is the selection. A module's page may mirror its own state, such as a list's filters, to the other parameters under its own rules; this file reads none of them, so such state never alters which page is selected. A navigation writes an address without them. The one exception is a change of the picked project alone, which the caller asks to keep them: the new address is then the old one with only `project` replaced, or removed.
