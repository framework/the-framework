An answered gate, collapsed to one expandable ✓ line (#1455 bonus 2 / item 6): what was decided stays visible without taking more of the page than a row.

## TLDR

- Collapsed: one full-width button line — ✓ (`text-success`) + the choice title + optional `meta` + Expand/Collapse, with `aria-expanded`.
- Expanded: the option list with ✓ beside the picked ids (`pickedIds` normalizes a single id or a multi subset), "Accepted none" for an empty multi pick, then the optional `footer`.
- Shared by two callers: the launcher's questions hub (`meta` = session label, `footer` = Open-session link) and the transcript's resolved `choice` rows (neither).
- Purely presentational — who remembers the answer (the hub's per-mount map, the transcript's `choice-resolved` events) is the caller's business.
