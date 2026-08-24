# Bug analysis: packages/framework/dashboard/lib/ticket-filter.ts

## Business logic (high-level)

The `/tickets` viewing model (#1144): pooling, the facet predicates (OR within, AND across), sorting with missing-last, facet counts with the self-facet excluded, bucket/range mutual exclusion, and the URL codec. Checked clause by clause against `ticket-filter.SPEC.md`:

- **Search** — word-wise AND over title+summary+file+topics, case-insensitive; blank query passes all. `haystack` join tolerates an undefined summary (renders as empty). Holds.
- **Numeric facets** — inactive passes everything including valueless tickets; engaged, a valueless ticket passes only via `none`; buckets OR range OR none, all inclusive bounds. Bucket thresholds mirror `priorityTone` (8/5) as the SPEC demands. Holds.
- **Buckets vs range exclusivity** — enforced by the *update helpers* (`withBucketToggled` clears range, `withRange` clears buckets, `none` survives both). A hand-typed URL can still carry both (`priority=critical,0-3`); the parser keeps both and matching unions them — consistent with "tolerant parsing", and `bucketUnionRange` simply reflects whatever buckets are set. Holds as specified.
- **Topics** — lowercase matching both sides (`normalTopics`, and parse lowercases URL topics); `topicsNone` selects the topicless and ORs with picked topics. Holds.
- **Stage** — unplanned/planned split on `planned`; claimed = `locked === true`, composing with planned (a claimed unplanned ticket also shows under unplanned — the SPEC's "composes with planned rather than excluding it" says nothing forbidding that, and the test pins it). Holds.
- **Projects / unlinked** — membership; `github === undefined`. Holds.
- **Sorting** — missing value last in *both* directions (checked before the direction multiplier); ties → newest-first (`b.date.localeCompare(a.date)`); comparator is antisymmetric (the undefined branches mirror; the tie branch is its own reverse); strings via `localeCompare`, numbers via subtraction; `va !== vb` with `diff === 0` (locale-equal strings) falls through to the date tiebreak — consistent. `sortByKey` starts each key at its natural direction per the DEFAULT_DIR table. Holds.
- **Facet counts** — `rowsForFacet` re-filters with the facet's own selection reset; bucket counts use the same inclusive bounds as matching; selected topics with zero count stay listed (or they could not be unpicked); topic ordering most-common-then-alpha. Holds.
- **URL codec** — defaults omitted (bare `/tickets`); junk tokens/params ignored (`banana`, `99-1` — rejected because min>max —, out-of-scale ranges via `max <= 10`, unknown stages/sort/group); `none` reserved in numeric and topics facets; `dir` defaulted *per key* on both sides so `sort=priority` round-trips to `desc`. Round-trip verified by the tests for a fully loaded view. Holds.

Remaining edges considered: duplicate tokens in a URL (`stage=planned,planned`) survive parse and re-format — harmless to matching; a topic containing a comma cannot round-trip through the comma-joined param — topics are single-word tags in practice; `RANGE_TOKEN` accepts leading zeros (`05-07` → 5..7) — fine; `parseRangeFilter` keeps only the last range token — fine (one slider).

## Functions (low-level)

- `flattenTickets` — flatMap with project identity attached. Correct.
- Bucket tables — contiguous, exhaustive over 0-10, matching the SPEC's bands. Correct.
- `defaultView` — fresh objects per call (spread of `INACTIVE_RANGE`), so callers can mutate their copy safely; `INACTIVE_RANGE` itself is only ever spread. Correct.
- `hasAnyFilter` / `rangeActive` — every facet, sort/group excluded per SPEC. Correct.
- `normalTopics` — `?? []` + lowercase. Correct.
- `matchesRange` / `inBucket` — as analysed; unknown bucket id in a filter (impossible after parse, which validates ids) would just never match. Correct.
- `matchesStage` / `matchesQuery` / `matchesFilters` / `filterRows` — as analysed. Correct.
- `sortValue` / `sortRows` — as analysed; returns a copy, input untouched. Correct.
- `sortByKey` / `DEFAULT_DIR` — table-driven. Correct.
- `bucketUnionRange` — sorted-by-min contiguity check with the `+1` adjacency (integer scale). Correct.
- `withBucketToggled` / `withRange` / `withNone` / `toggled` — immutable updates, exclusivity as specified. Correct.
- `rowsForFacet` + the four count functions — self-facet reset via patch; note `{[facet]: {...INACTIVE_RANGE}}` resets only the named facet. Correct.
- `parseRangeFilter` / `formatRangeFilter` — as analysed. Correct.
- `parseTicketsView` / `formatTicketsView` — as analysed; `URLSearchParams` handles decoding/encoding of the `q` value and any exotic characters in project ids. Correct.

## Bugs found

None found.
