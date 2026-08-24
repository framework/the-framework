# Bug analysis: packages/framework/dashboard/lib/ticket-filter.test.ts

## Business logic (high-level)

Broad, behaviour-first coverage of the ticket viewing model: pooling, word-wise AND search, numeric facets (bucket, none-composition, inclusive range, valueless exclusion), the update helpers' bucket/range exclusivity with `none` surviving, stage semantics (claimed composing with planned — including the subtle `claimed.md` appearing under `unplanned`), topics case-insensitivity and `none`, project/unlinked facets, sorting (missing-last both directions, newest-first tiebreak, per-key natural direction), `bucketUnionRange` contiguity incl. the skipped-middle null, facet counts with self-facet exclusion (both the numeric and topic sides, and the stage/unlinked pair), the none-count, and the URL codec (empty default, full round-trip, junk tolerance, per-key dir defaults, `hasAnyFilter` ignoring sort/group).

Assertions are exact (file lists, full objects, exact query strings), so they can fail. The junk-URL test is well chosen: `banana` (unknown bucket), `99-1` (inverted range — rejected by `min <= max`), `none` (kept), unknown stage/sort/group all at once. The round-trip test drives every facet plus a non-default sort and group through format→parse equality.

Gaps (noted, not bugs): no test for an out-of-scale-but-ordered range token (`5-99` — rejected by `max <= 10`); none for a URL carrying both a bucket and a range in one facet (parser keeps both — tolerated input); none for `formatRangeFilter` emitting bucket+range together (unreachable through the helpers); `projectFacetCounts` is untested (trivially similar to the others).

## Functions (low-level)

- `ticket`/`row`/`filtersWith` fixtures — minimal `WorkspaceTicket` with overridable fields; `filtersWith` clones off `defaultView()` so tests never share mutable filter state. Correct.
- Search suite — hit across fields, AND across words, whitespace-only query passes all. Correct.
- Priority facet suite — bucket, bucket+none OR, inclusive range excluding the valueless. Correct.
- Update-helpers test — sequence bucket→none→range→bucket asserting exclusivity transitions and `none` persistence. Correct.
- Stage suite — the four-row truth table incl. the OR case (`planned`+`claimed` → 3 rows: planned, claimed, both). Correct.
- Topics suite — UX/ux unification; none → topicless only. Correct.
- Project/unlinked suite — membership and github-absence. Correct.
- Sort suite — desc/asc with `bare.md` last both times; tie by date; `sortByKey` table. Correct.
- `bucketUnionRange` suite — single, adjacent pair, full span, skipped middle → null, empty → null. Correct.
- Facet-count suites — numeric counts under a topic constraint (critical 1, low 0), topic counts ignoring the topic selection (`ux` stays pickable), `none` counts, stage/unlinked counts under a stage constraint, effort none-count. All match the self-facet-exclusion rule. Correct.
- URL codec suite — as summarised above. Correct.

## Bugs found

None found.
