The /tickets toolbar (#1144): search, faceted filter popovers, sort menu, grouping — every control edits the caller's `TicketsView` and hands it back; state (and its URL mirroring) belongs to the page.

## TLDR

- Search `Input` with a global `/` shortcut (skipped while an input/textarea/contenteditable has focus); a `<kbd>/</kbd>` keycap chip pinned to the field's right edge advertises it, stepping aside once the field is focused or filled.
- `RangeFacet` (Priority always; Effort/Uncertainty only once some plan recorded the numbers): bucket checkbox rows with counts, a two-thumb `RangeSlider` for fine-grained ranges, and a "No priority/effort/uncertainty" row shown only when genuinely non-empty. Bucket clicks and slider drags go through `withBucketToggled`/`withRange`, which keep the two mutually exclusive — and the slider **dims while buckets are selected** (`data-dimmed`, opacity), since one range cannot show a non-adjacent bucket union. Dimmed is not disabled: dragging it takes over and clears the buckets, so the gray reads as "not currently applied" rather than a dead end.
- `CheckFacet`s: Topics (case-deduped, busiest first, + "No topics"), Stage (Unplanned/Planned/Claimed), Project (only with ≥2 registered projects). "Not linked" is a plain toggle chip, shown only while some ticket lacks a GitHub link.
- Every option carries its count, computed by the lib with the other facets applied but its own ignored (see `ticket-filter.spec.md`).
- Facet triggers show an active-clause count and a primary-tinted border; `✕ Clear` appears once `hasAnyFilter` and resets filters only (sort/group survive); an `x/n` tally (shown of total) sits right **always** — unfiltered it doubles as the backlog's total, which the page otherwise says nowhere.
- Sort is a split control: the `Sort: Priority` menu picks the key (re-clicking the active key still flips direction as a bonus shortcut), and a standalone `↓`/`↑` icon button beside it flips direction in one click. The button and its tooltip speak per-key meaning — "Newest first", "Highest first", "A to Z", "Easiest first" — because asc/desc says nothing until you know the key. "Group by project" is a checkbox item in the sort menu — unticked is the flat cross-project list.

## Decisions

- `FacetTrigger` forwards unknown props into its `Button` — `PopoverTrigger render={...}` clones the element with Base UI's own handlers, and a component that swallows them renders a popover no click can open.
- Facets are data-driven: a facet (or a "No X" row) with nothing to offer is not rendered, rather than sitting permanently empty — the toolbar's width is spent on what the data actually has.
