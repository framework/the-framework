The /tickets filter model (#1144): the page's whole viewing state — search, faceted filters, sort, grouping — as one plain `TicketsView` value, with pure functions to apply it and a URL codec to carry it. The backlog is already client-side on one poll, so everything here runs in memory; the server knows nothing about filters.

## TLDR

- `TicketRow` = `{projectId, projectName, ticket}` — `flattenTickets(groups)` pools every project so one row type feeds filtering, counts, and the flat list alike.
- `TicketFilters`: `q` (case-insensitive; every word must match somewhere in title/summary/filename/topics), three numeric facets (`priority`/`effort`/`uncertainty`, each a `RangeFilter`), `topics` + `topicsNone`, `stage` (`unplanned`/`planned`/`claimed`), `projects`, `unlinked`. **OR within a facet, AND across facets.**
- `RangeFilter` = named buckets ∪ a fine-grained `[min,max]` range ∪ `none` (tickets naming no value). Buckets and range are two ways to drive the same selection, so `withBucketToggled`/`withRange` keep them mutually exclusive; `none` composes with either — "critical OR unprioritized" is a real triage lens.
- Buckets: `PRIORITY_BUCKETS` follow `priorityTone`'s thresholds (Critical 8-10 / Medium 5-7 / Low 0-4) so the filter's "critical" is the colour the rows already show; `EFFORT_BUCKETS` (Trivial/Moderate/Large) and `UNCERTAINTY_BUCKETS` (Low/Medium/High) split the plan preamble's 0-10 keys at 0-2/3-5/6-10.
- `sortRows(rows, {key, dir})`: date/priority/title/effort with direction; **a missing value sorts last in both directions** (Priority ↑ must not bury the list under unprioritized tickets); ties fall back to newest-first. `toggleSort` flips the active key, starts a new one at its natural direction (`DEFAULT_DIR`).
- Facet counts (`rangeFacetCounts`/`topicFacetCounts`/`stageFacetCounts`/`projectFacetCounts`/`unlinkedCount`): each option counted with every OTHER filter applied but its own facet's selection ignored — so options answer "what would picking this show", instead of collapsing to 0 the moment a sibling is picked. Selected topics stay listed at 0 so they can be unpicked.
- URL codec (`parseTicketsView`/`formatTicketsView`): `?q=&priority=critical,2-6,none&topics=&stage=&project=&github=unlinked&sort=&dir=&group=none`. Defaults are omitted (`/tickets` stays bare); junk tokens in a hand-typed URL are dropped, never thrown at. Route.ts's own doctrine extended: the URL is the selection, filters included.

## Decisions

- Topic matching and the facet list are lowercase (`normalTopics`): `UX` and `ux` on disk are one topic, same normalization `describe()` applies to priority.
- `none` is a reserved token in the `topics` param, the same word the numeric facets use — a topic literally named "none" cannot be filtered by URL, accepted.
- `hasAnyFilter` ignores sort/group: they reorder, never hide, so Clear-all leaves them alone.
- Stage's `claimed` is the `.lock.md` claim and composes with `planned` (the lock covers the ticket's whole life — the agent may be planning or implementing); `unplanned` is `!planned`, deliberately overlapping claimed.
