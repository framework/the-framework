Reads a ticket's `Priority:` key — a 0–10 scale (#1144/#1265; 10 acts immediately, 0 only if there is capacity) — as a number (`parsePriority`) and a display tone (`priorityTone`: `text-danger` ≥8, `text-warning` ≥5, muted otherwise or when absent/unparseable).

## Decisions

- Shared so the list row, the detail page, and the sort dropdown read the scale identically instead of three ad hoc parses drifting; unparseable is `undefined`, never `NaN`.
