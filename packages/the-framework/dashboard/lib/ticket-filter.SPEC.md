The viewing model behind the dashboard's `/tickets` page: which tickets the toolbar shows, in what order, grouped how — and how that whole selection is carried in the URL. Every project's tickets are pooled into one cross-project list, and all filtering, sorting and counting happens in the browser on tickets already loaded, so the toolbar reacts instantly and the daemon is never asked to re-query.

## User story

- The user opens `/tickets` to see the roadmap across all their projects at once, and narrows it down to what matters right now: the critical tickets, the ones nobody planned yet, the ones about a given topic, the ones written locally rather than imported from GitHub.
- The user wants to answer "what is the single highest-priority ticket anywhere" without going project by project.
- The user wants to send a colleague — or their future self — the exact view they are looking at, and to still be looking at it after opening a ticket and coming back.

## Glossary

- **facet** - one filter dimension in the toolbar: the search box, priority, effort, uncertainty, topics, stage, project, or the GitHub-link toggle.
- **stage** - where a ticket stands in the pipeline: *unplanned* (it has no plan yet), *planned* (it has one), *claimed* (an agent currently holds its `.lock.md`, either planning it or implementing it).

## Business logic — TL;DR

- **One pooled list of tickets** - every project's tickets become one flat cross-project list, and every filter, count and sort works on that list.
- **OR within a facet, AND across facets** - picking two topics widens the result, picking a topic *and* a stage narrows it.
- **Numeric facets offer buckets, a fine range, and "unset"** - priority, effort and uncertainty can each be filtered by named bands, by an exact minimum-maximum span, or by "names no value at all" — and the last one composes with the other two, so "critical or unprioritized" is expressible.
- **Buckets and the fine range never disagree** - engaging one clears the other, so two half-active inputs can never claim different spans.
- **Missing values sort last in both directions** - ranking by priority never buries the list under the tickets that have no priority.
- **Facet counts ignore the facet's own selection** - each option answers "how many tickets would this show", instead of every unpicked option collapsing to zero as soon as one is picked.
- **The URL is the view** - filters, sort and grouping all live in the query string; defaults are omitted, and anything unrecognizable in a hand-typed URL is ignored rather than treated as an error.

## Business logic

### What the facets match

#### User story

See `## User story`.

#### Business logic

The search box is case-insensitive and word-wise: every whitespace-separated word must appear somewhere in the ticket's title, summary, filename, or topics — so "lock ui" finds only tickets matching both words.

Priority, effort and uncertainty are each scored 0 to 10, and each is filtered the same three ways: by named bands, by an exact minimum-maximum span, or by "unset" for tickets that name no value. Priority's bands are Critical (8-10), Medium (5-7) and Low (0-4) — deliberately the same thresholds that colour the ticket rows, so the filter's idea of "critical" and the list's idea of it are one. Effort's bands are Trivial (0-2), Moderate (3-5) and Large (6-10); uncertainty's are Low (0-2), Medium (3-5) and High (6-10). A facet nobody touched passes every ticket, including the ones with no value; once the facet is engaged, a ticket without a value passes only through the explicit "unset" option.

Topics are matched case-insensitively, so `UX` and `ux` are one topic; "no topics" is available as its own option. Stage filters by unplanned, planned or claimed, and claimed composes with planned rather than replacing it — a planned ticket an agent is currently working shows under both. The project facet limits the pool to chosen projects, empty meaning all of them. The GitHub toggle keeps only tickets with no GitHub link, i.e. the ones written locally.

Options picked inside one facet are unioned; facets are then combined by intersection.

### Buckets and the fine range are one selection

#### User story

The toolbar offers a numeric facet twice over: quick named bands, and a slider for an exact span. The user must never end up with the two disagreeing.

#### Business logic

Picking a band clears any fine range, and setting a fine range clears the picked bands; the "unset" option survives both, since it says something neither of them can. When the picked bands happen to form one contiguous span, the slider shows that span, so the two inputs read as the same selection; when the picked bands skip a middle band — Critical and Low but not Medium — no single span can express it and the slider stands down.

### Sorting and grouping

#### User story

The user reorders the roadmap by what they are deciding: newest first when catching up, highest priority first when picking the next task, easiest first when looking for a quick win.

#### Business logic

Tickets sort by date, priority, title or effort. A ticket missing the sorted value always lands at the end, whichever direction is chosen, so ranking by priority is not swamped by the unprioritized. Ties break by newest first — the one tiebreak that means the same thing for every ticket. Picking a sort key starts it in its own natural direction: newest first for date, highest first for priority, A-Z for title, easiest first for effort; the direction is then changed only by explicitly choosing it.

Tickets are shown grouped per project by default, or as one flat cross-project list — the only view that can answer which single ticket anywhere ranks highest.

Sorting and grouping are view preferences rather than filters: they reorder, they never hide, and the "clear all filters" affordance therefore ignores them.

### Facet counts that stay useful

#### User story

Next to each filter option the user sees how many tickets it would bring in, so they can narrow down without trial and error.

#### Business logic

Each option's count is computed with every *other* facet applied but the option's own facet ignored. So after picking "Critical", the Medium option still reports how many medium-priority tickets exist under the current other constraints, instead of dropping to zero. Topic options are listed most common first, ties alphabetically, so the busy tags lead; a topic the user has selected stays in the list even when the other filters leave it at zero, or it could never be unpicked.

### The URL is the view

#### User story

The user shares or bookmarks a link like `/tickets?q=lock&priority=critical,none&stage=unplanned&sort=priority` and gets exactly the view they were looking at, including after a reload or after navigating into a ticket and back.

#### Business logic

The whole viewing state — every filter, the sort key and direction, the grouping — is expressed in the query string. Values at their default are left out, so the untouched page stays a bare `/tickets`. Reading a URL is deliberately tolerant: unknown parameters, unknown band names, malformed spans and out-of-scale numbers are silently ignored and simply read as the default, so a hand-edited link never produces an error page. Within the numeric facets and the topics facet, `none` is a reserved token meaning "names no value" rather than a band or a topic name.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
