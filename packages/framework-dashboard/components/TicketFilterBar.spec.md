The /tickets toolbar (#1144): search, faceted filter popovers, sort menu, grouping — every control edits the caller's `TicketsView` and hands it back; state (and its URL mirroring) belongs to the page.

## TLDR

- Search `Input` with a global `/` shortcut (skipped while an input/textarea/contenteditable has focus); a `<kbd>/</kbd>` keycap chip pinned to the field's right edge advertises it, stepping aside once the field is focused or filled.
- `RangeFacet` (Priority always; Effort/Uncertainty only once some plan recorded the numbers): bucket checkbox rows with counts, a two-thumb `RangeSlider` for fine-grained ranges, and a "No priority/effort/uncertainty" row shown only when genuinely non-empty. **The slider mirrors the bucket selection whenever it can** (`bucketUnionRange`): a contiguous union — one bucket, or adjacent ones — is a range, so the thumbs and the readout sit on it and dragging refines from there (`withRange` takes over and clears the buckets). Only a selection that skips a middle bucket, which no `[min,max]` pair can express, **dims the slider** (`data-dimmed`, opacity, readout "not one span") — still live, not disabled, so the gray reads as "not currently applied" rather than a dead end.
- `CheckFacet`s: Topics (case-deduped, busiest first, + "No topics"), Stage (Unplanned/Planned/Claimed), Project (only with ≥2 registered projects). "Not linked" is a plain toggle chip, shown only while some ticket lacks a GitHub link.
- Every option carries its count, computed by the lib with the other facets applied but its own ignored (see `ticket-filter.spec.md`).
- Facet triggers show an active-clause count and a primary-tinted border; `✕ Clear` appears once `hasAnyFilter` and resets filters only (sort/group survive). (The `x/n` tally lives beside the page title, not here — it describes the page's content, not the toolbar's controls.)
- Sort: the `Sort: Priority ↓` trigger opens one menu — key items on top (picking a new key starts at its natural direction via `sortByKey`; the active key is a no-op), then the **asc/desc icon pair** (`ArrowUpNarrowWide`/`ArrowDownWideNarrow`), the applied one carrying the menu's own accent highlight, with the current meaning spelled out beside it — "Newest first", "Highest first", "A to Z", "Easiest first" — because asc/desc says nothing until you know the key. "Group by project" closes the menu — unticked is the flat cross-project list.

## Decisions

- `FacetTrigger` forwards unknown props into its `Button` — `PopoverTrigger render={...}` clones the element with Base UI's own handlers, and a component that swallows them renders a popover no click can open.
- Facets are data-driven: a facet (or a "No X" row) with nothing to offer is not rendered, rather than sitting permanently empty — the toolbar's width is spent on what the data actually has.
