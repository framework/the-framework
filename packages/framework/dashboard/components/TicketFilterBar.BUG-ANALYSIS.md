# Bug analysis: packages/framework/dashboard/components/TicketFilterBar.tsx

## Business logic (high-level)

The /tickets toolbar (#1144): stateless over the caller's `TicketsView` (URL-mirrored by
TicketsPage); reads the unfiltered pool only for option counts (via `lib/ticket-filter.ts`'s
self-facet-excluded count helpers). Checked against `TicketFilterBar.SPEC.md`:

- **Search + `/` shortcut** — window keydown listener: `/` without modifiers, ignored when the
  event target is an input/textarea/contentEditable (so typing `/` in any field stays a character,
  including the search field itself); `preventDefault` then focus. Registered once per mount,
  removed on unmount — no leak. The keycap chip shows only while unfocused and empty. Matches spec.
  (Reliance: exactly one bar is mounted at a time — TicketsPage renders one — otherwise multiple
  listeners would fight over focus.)
- **Live counts** — every facet uses the lib's other-filters-applied/self-ignored pools
  (`rangeFacetCounts`, `topicFacetCounts`, `stageFacetCounts`, `projectFacetCounts`,
  `unlinkedCount`). Correct per spec.
- **Conditional facets** — Priority and Stage always; Effort/Uncertainty on
  `any…|| rangeClauses(f.…) > 0` (active filter keeps them reachable — spec's "never unreachable"
  rule); Project on `projects.length > 1`; Not linked on `notLinked > 0 || f.unlinked`. Topics has
  a gap — bug 1. Project: if the registry dropped to one project while `f.projects` were active the
  facet would hide with the filter live; the spec's own gate is "two or more projects are
  registered", so this follows the specific rule while brushing the blanket one — noted, not
  reported (requires deregistering a project mid-view; Clear still reachable).
- **Numeric facets** — buckets toggle via `withBucketToggled` (clears range), slider via
  `withRange` (clears buckets), `none` composes (`withNone`). Slider mirrors a contiguous union
  (`bucketUnionRange`), dims (opacity + `data-dimmed` + title) when the selection skips a span but
  stays live; explicit range shows its clear X. Uncontrolled default `[0,10]`. "No value" row
  appears on `counts.none > 0 || filter.none`. All match spec, including the dimmed-not-disabled
  rationale.
- **Clear** — shown on `hasAnyFilter`; resets to `defaultView().filters` only, sort/group kept.
  Matches spec.
- **Sort menu** — key rows (`closeOnClick={false}`, re-click of the active key guarded to a no-op),
  the asc/desc pair with `aria-pressed` and the per-key meaning labels (`DIR_LABELS` complete for
  all four keys × both dirs), the applied meaning spelled out, and Group by project toggling
  `'project' ↔ 'none'`. Matches spec.

Edge cases: `stageCounts[stage.id]` always defined (record built for all three ids). Topic keys are
lowercase-deduped by the lib, so `key={topic}` cannot collide. Slider `onValueChange` fires per drag
step — each produces a full `onChange(view)`; URL churn is the caller's concern (TicketsPage uses
replaceState). No async work, no cleanup beyond the one listener.

## Functions (low-level)

- **`OptionRow`** — checkbox row; `onCheckedChange(next === true)` coerces indeterminate to false;
  `aria-label` from the visible label (used by tests). Correct.
- **`FacetTrigger`** — forwards unknown props (PopoverTrigger's `render` cloning contract), badge
  on `active > 0`. Correct.
- **`rangeClauses`** — buckets + range + none, exactly the "active clauses" the badge and the
  keep-visible gates need. Correct.
- **`RangeFacet`** — as analyzed above; the IIFE computes `union`, `dimmed`
  (`buckets.length > 0 && union === null`), `displayed = range ?? union`. Readout: span, else
  "not one span" when dimmed, else "any" — covers all three states. Clear-X only when an explicit
  `range` exists (a bucket-mirrored union is cleared by unticking buckets — consistent). Correct.
- **`CheckFacet`** — trivial popover shell. Correct.
- **`TicketFilterBar`** — `set` patches filters immutably; per-facet wiring as above. The
  Topics gate is the one flaw (bug 1). Correct otherwise.

## Bugs found

1. `L273`: the Topics facet can disappear while its "No topics" filter is active, stranding the
   filter — contrary to the SPEC's "any facet whose filter is already active stays visible
   regardless, so an active filter can never become unreachable". The outer gate is
   `topicFacet.topics.length > 0 || topicFacet.none > 0` and ignores `f.topicsNone` (selected
   `f.topics` are covered — `topicFacetCounts` keeps them listed at count 0 — but `topicsNone` is
   not). Scenario: tick "No topics", then type a search that currently matches nothing (or stack
   any other filters that empty the topic pool): `topics` is `[]` and `none` is 0, so the whole
   facet unmounts while "No topics" keeps filtering the (empty) list; the only way out is Clear or
   editing the query. Severity: minor. Fix sketch: gate on
   `topicFacet.topics.length > 0 || topicFacet.none > 0 || f.topicsNone` (the inner
   no-topics row already handles `|| f.topicsNone`).
