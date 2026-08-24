# Bug analysis: packages/framework/dashboard/components/ContextMenu.tsx

## Business logic (high-level)

The launcher's Context picker (#439/#314/#1046) as a dropdown: a trigger showing "Context · {summary}",
a Projects group of checkbox items (checked = `context.has(path)`, toggle reports the path),
and a Files group rendering the shared `ContextFiles` list (remove = the same `onToggle`,
i.e. set-toggle semantics — removal is a toggle-off in the caller's Set). Empty states: "No other
repos to add." and "None yet — add with # or the Files tab.". All interactivity disabled while
`busy`.

Purely presentational — state (the context Set, the summary string) lives in the launcher.
Invariants: repo rows keyed by project id (unique); the current project is excluded upstream
(`otherProjects`); the trigger's tooltip and the Projects-label tooltip explain the
narrow-not-restrict semantics. `summary && <span>…` renders nothing for the empty string
(falsy `''` in JSX renders nothing). No effects, no cleanup concerns; menu positioning/roles come
from the ui/dropdown-menu primitives.

## Functions (low-level)

### `ContextMenu({ otherProjects, context, contextFiles, summary, busy, onToggle })`

- Trigger: `DropdownMenuTrigger` disabled on busy, dressed as a ghost button; accessible name
  includes "Context" (tests query by it). Correct.
- Projects group: `DropdownMenuCheckboxItem` per project — `checked` from the Set by *path* (the
  same key `onToggle` reports; consistent with the launcher storing paths). Tooltip shows the full
  path. Empty branch renders the hint. Correct.
- Files group: delegates to `ContextFiles` with `onRemove={onToggle}` — one handler both adds and
  removes because the caller's toggle is symmetric; removal passes the file path, which is
  guaranteed to be in the Set. Correct.

Edge cases considered: duplicate project paths (two registered repos at the same path) would make
`checked` move in tandem — not producible (registry keys projects by path); empty `summary` (no
separator dot rendered); very long names truncate. No bugs.

## Bugs found

None found.
