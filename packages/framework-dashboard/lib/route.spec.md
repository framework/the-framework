The dashboard's URL scheme (#784): pure `parseRoute`/`formatRoute` between a pathname and the `Route` object (`view?`, `projectId`, `runId`, `ticketSlug?`).

## TLDR

- Paths: `/` Overview, `/{projectId}` project home/launcher, `/{projectId}/{runId}` one session, `/settings` (#958), `/tickets` cross-project list, `/{projectId}/tickets[/{slug}]` a project's tickets / one ticket (#1144).
- `parseRoute`: anything unparseable is the Overview; extra segments and trailing slashes are ignored; segments are percent-decoded, a malformed one kept as typed (hand-typed URLs are input).
- `formatRoute` is the exact inverse; `view` outranks stale project/run ids.

## Decisions

- The URL is the selection — replacing three pieces of React state guessing at each other, the source of the #761/#766/#768/#774 bugs.
- `runId` is the framework's run id (`RunMeta.id`), not the agent's conversation id: only the run id is ours, stable, and already the worktree directory name. URL-facing word is "session" because that's the user-facing term (#771).
- `SETTINGS_SEGMENT`/`TICKETS_SEGMENT` are safe to reserve: a project id is always `<slugified basename>-<base36 hash>`, a run id comes from `runIdFromStartedAt` — neither is ever the bare word.

## Facts

- `ticketSlug` equals `WorkspaceTicket.file` (the ticket's filename); only meaningful with `view:'tickets'` + a `projectId` — the cross-project list never carries one.
