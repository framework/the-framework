The tickets page's toolbar: one row carrying the page's whole viewing state — free-text search, the faceted filters, the sort order, and whether the list is grouped by project.

## User story

A user looking at a backlog of tickets pooled across every project wants to narrow it to what matters right now — the critical unplanned ones, everything tagged a topic, the ones nobody has claimed — and to order what is left, without leaving the page or losing the view when they share the address.

## Business logic — TL;DR

- **Search, with the `/` shortcut** - typing filters the list; pressing `/` anywhere on the page jumps to the search field, and the field advertises the shortcut until it is used.
- **Facets carry live counts** - every option shows how many tickets it would yield under the other filters currently applied, so no option silently collapses to zero.
- **Facets appear only when they apply** - Topics, Effort, Uncertainty, Project and "Not linked" are shown only when the pool has something for them (or that filter is already on).
- **Numeric facets offer buckets or a range** - named spans for a quick pick, a min–max slider for a precise one, plus a "names no value" row that composes with either.
- **Clear** - appears as soon as any filter is on, and drops all of them at once while leaving sort and grouping alone.
- **Sort says what it means** - the direction is spelled out per key ("Newest first", "Highest first", "A to Z", "Easiest first"), not as "ascending".
- **Group by project** - the list is either per-project sections or one flat cross-project list.

## Business logic

### Search, with the `/` shortcut

#### User story

See `## User story`.

#### Business logic

A search field filters the list as the user types. Pressing `/` anywhere on the page moves focus into it — unless the user is already typing into a field, where `/` stays an ordinary character. While the field is empty and unfocused it shows a `/` keycap advertising the shortcut; the keycap steps aside once the field is focused or holds text.

### Facets carry live counts

#### User story

The user picks one filter and wants to keep narrowing, but only along paths that still have tickets on them.

#### Business logic

Each facet is a menu of options with a count beside each one. A facet's counts are computed with every other filter applied but with that facet's own selection ignored, so an option always answers "how many tickets would this show, given the rest of what is filtered". Each facet's button shows how many of its own clauses are active.

### Facets appear only when they apply

#### User story

See `## User story`.

#### Business logic

Priority and Stage (Unplanned / Planned / Claimed) are always offered. Topics appears only when some ticket in the pool names a topic, or some ticket names none. Effort and Uncertainty appear only when some ticket carries that estimate. Project appears only when two or more projects are registered. "Not linked" — the tickets with no GitHub item behind them — is a single toggle, offered only when the pool holds such tickets. Any facet whose filter is already active stays visible regardless, so an active filter can never become unreachable.

### Numeric facets offer buckets or a range

#### User story

Priority, effort and uncertainty are numbers on a 0–10 scale. Sometimes the user wants "critical", sometimes exactly 6 to 8, and sometimes the tickets that carry no such number at all.

#### Business logic

A numeric facet shows its named buckets with their spans, a min–max slider, and — when the pool has any — a row for the tickets naming no value ("No priority", "No effort", "No uncertainty"). Buckets and the slider are two ways of saying the same thing, so engaging one drops the other; the "no value" row composes with either, making "critical or unprioritized" expressible.

The slider mirrors the bucket selection whenever it can: one bucket, or adjacent ones, form a single span, so the slider's thumbs sit on it and dragging refines from there. A selection that skips a middle bucket cannot be written as one span; the slider then dims and reads "not one span", while staying usable and explaining that dragging it replaces the buckets. When the slider carries an explicit range, a clear control beside it drops that range.

#### Rationale

The dimmed slider stays live rather than being disabled so the gray reads as "not currently applied" rather than as a dead end.

### Clear

#### User story

See `## User story`.

#### Business logic

As soon as any filter is on, a Clear control appears and resets every filter at once. Sort and grouping are untouched: they reorder the list, they never hide anything, so they are a view preference rather than a filter.

### Sort and grouping

#### User story

The user wants the highest-priority ticket, or the newest, or the easiest — and wants to know which end of the list that is.

#### Business logic

One menu holds the ordering. The list can be sorted by Date, Priority, Title or Effort; picking a key starts it at that key's own natural direction. Direction is an explicit pair of buttons, never a second click on the key, and the meaning of the currently applied direction is written out beside them in the key's own words: newest or oldest first for Date, highest or lowest for Priority, A to Z or Z to A for Title, easiest or hardest for Effort. The same menu carries "Group by project", which switches between per-project sections and one flat cross-project list.

#### Rationale

"Descending" says nothing until the reader knows the key, so each direction is labelled by what it does to that key rather than by its mathematical name.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
