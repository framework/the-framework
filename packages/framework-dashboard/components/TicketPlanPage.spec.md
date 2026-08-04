One ticket's plan (#685): its `<stem>.plan.md` rendered as markdown on its own page, the destination of the tickets list's plan-column link.

## TLDR

- `planPath(slug)` maps a ticket's filename to its plan's repo-relative path: `tickets/<stem>.plan.md` (the `.md` stem plus `.plan.md`). Exported so its caller and the test agree on the spelling.
- Reads the plan through the shared confined `onFileContent(projectId, path)` (#828), not a bespoke endpoint — a plan is a plain repo file, and that read already guards traversal and caps the length. Polled every 10s like the detail page.
- No `.plan.md` (or a binary hit) → "This ticket has no plan yet." rather than a blank page — the plan may have been removed since the list read, or the file may not be there at all.
- `truncated` from the confined read → a "Plan truncated" note under the markdown, so a long plan's missing tail reads as cut, not empty.
- Chrome mirrors `TicketDetailPage`: a Back button (`onBack`, → the tickets list) with the plan's path beside it, then the `Markdown` render inside a `ScrollArea`.

## Decisions

- `TICKETS_DIR` is a local `'tickets'` literal, not the package's Node-bound export: importing that const as a runtime value would drag the server module graph into the browser bundle (the client takes only types from `@gemstack/the-framework`, runtime values from `/client`).
- Addressed by the *ticket's* slug, not the plan's own filename: the plan belongs to a ticket, the list row and the plan route both carry the ticket's `file`, and deriving the plan name here keeps one identity travelling.
- Reuses `onFileContent` rather than adding an `onTicketPlan` telefunc: no new server surface, and the plan is already reachable as a confined file. The 500-line preview cap is acceptable and surfaced via `truncated`.
