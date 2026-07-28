One ticket's own page (#1144): the full markdown body plus all meta, and the home of the Queue button now that the list rows are one-liners.

## TLDR

- Polls `onTicket(projectId, slug)` every 10s — a direct read by identity (`slug` is the filename inside `tickets/`, same as `WorkspaceTicket.file` and the route param), not a search through a list the caller may not have.
- Queue button: `sendQueueTicket(projectId, title, {file, priority?})`, flipping to a checked "Queued" state; errors surface inline.
- Meta rendered below title/summary in fixed order (#1144/#1265): age (tooltip full datetime), priority badge (`priorityTone`), GitHub link, status badge (open = success tone, closed fades — #1230), topics, spiked/planned flags, effort, filename.
- Loading, missing ("This ticket does not exist." — deleted between reads or a stale/hand-typed link) and loaded states are distinct; back button returns to the tickets list via `onBack`.
