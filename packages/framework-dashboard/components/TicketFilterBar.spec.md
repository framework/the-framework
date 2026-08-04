The /tickets toolbar (#1144): search, faceted filter popovers, sort menu, grouping — every control edits the caller's `TicketsView` and hands it back; state (and its URL mirroring) belongs to the page.

## TLDR

- Search `Input` with a global `/` shortcut (skipped while an input/textarea/contenteditable has focus); placeholder advertises the key.
- `RangeFacet` (Priority always; Effort/Uncertainty only once some plan recorded the numbers): bucket checkbox rows with counts, a two-thumb `RangeSlider` for fine-grained ranges, and a "No priority/effort/uncertainty" row shown only when genuinely non-empty. Bucket clicks and slider drags go through `withBucketToggled`/`withRange`, which keep the two mutually exclusive.
- `CheckFacet`s: Topics (case-deduped, busiest first, + "No topics"), Stage (Unplanned/Planned/Claimed), Project (only with ≥2 registered projects). "Not linked" is a plain toggle chip, shown only while some ticket lacks a GitHub link.
- Every option carries its count, computed by the lib with the other facets applied but its own ignored (see `ticket-filter.spec.md`).
- Facet triggers show an active-clause count and a primary-tinted border; `✕ Clear` appears once `hasAnyFilter` and resets filters only (sort/group survive); a `N of M` tally sits right while filtered.
- Sort menu: one trigger (`Sort: Priority ↓`); picking the active key again flips its direction (`toggleSort`), so the menu never grows per-direction entries; "Group by project" is a checkbox item in the same menu — unticked is the flat cross-project list.

## Decisions

- `FacetTrigger` forwards unknown props into its `Button` — `PopoverTrigger render={...}` clones the element with Base UI's own handlers, and a component that swallows them renders a popover no click can open.
- Facets are data-driven: a facet (or a "No X" row) with nothing to offer is not rendered, rather than sitting permanently empty — the toolbar's width is spent on what the data actually has.
