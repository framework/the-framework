Decides which tickets [1] the tickets page shows, in what order and under which headings: the text search, the priority, effort and uncertainty facets, the topics, the planning stage, the project, the "Not linked" switch, the sort, the grouping, the per-option counts beside each facet option, and the query string that carries the whole thing in the address so a filtered list is a link.

## Context

**User story**: the user opens the cross-project tickets page, types a word in "Search tickets…", ticks "Critical" under "Priority" and "Unplanned" under "Stage", and sees only the tickets that match, with a count beside every other option saying how many that option would add. The address updates as the filters change, so the narrowed list can be pasted to someone else, reloaded, and returned to after opening a ticket and coming back. "Clear" puts everything back to the unfiltered list.

**Business logic story**: the whole set of tickets across every project is already in the browser after one read from the daemon, so filtering, counting and sorting happen on what is on screen and the daemon is never asked to filter. The tickets themselves come off each project's `agent-data` branch [2].

**Problem**: the tickets page is the one place where hundreds of tickets across every project meet, and the question the user brings to it is never "list them all" but "what is worth doing next", "what is unplanned and important", "what has nobody claimed". Each of those is one combination of facets, and each combination has to be shareable.

## Glossary

[1] ticket: a markdown file under `tickets/` on the `agent-data` branch (`<date>_<slug>.md`), with an optional plan (`.plan.md`) and claim (`.lock.md`).
[2] the `agent-data` branch: the branch of a project's repository used as a file store for everything agents share: tickets, the agent queue, the runs, routine locks.
[3] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[4] facet: one of the filter toolbar's dimensions — the text search, priority, effort, uncertainty, topics, stage, project, and the "Not linked" switch.
[5] plan: a ticket's `.plan.md`: effort and uncertainty ratings and how to implement it.
[6] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[7] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.

## Business logic — TL;DR

- **What a row is** - every project's tickets become one flat pool, each row carrying the ticket and the project it belongs to.
- **How the facets combine** - a ticket must satisfy every facet that is active, and satisfies one facet by matching any of the options selected within it.
- **The text search** - every word typed must appear somewhere in the ticket's title, summary, filename or topics, ignoring case.
- **The three numeric facets** - priority, effort and uncertainty each filter by named buckets on a 0 to 10 scale, or by a hand-set range, plus an option for the tickets that name no value.
- **Buckets and the range never both apply** - picking a bucket clears the range and setting a range clears the buckets; the "no value" option survives both.
- **Topics** - a ticket matches if it carries any selected topic, matched without regard to case, and "No topics" matches the tickets that carry none.
- **Planning stage** - "Unplanned", "Planned" and "Claimed", where claimed is independent of planned rather than exclusive with it.
- **Project and "Not linked"** - a selection of projects, and a switch that keeps only tickets carrying no GitHub link.
- **Sorting** - by date, priority, title or effort, each with its own natural direction, a ticket that names no value always last, and newest-first as the tiebreak.
- **Grouping** - one section per project by default, or one flat cross-project list.
- **The counts beside each option** - every option's count is computed with all the other facets applied but its own facet ignored, so options never collapse to zero as soon as one is picked.
- **The filter view in the address** - the whole view is written into the query string, defaults omitted, and read back leniently.

## Business logic

### What a row is

#### Context

See `## Context`.

#### Business logic

Every project's [3] tickets [1] are flattened into one pool of rows. A row is one ticket plus the id and the display name of the project it belongs to. Everything below — filtering, counting, sorting, grouping — works on this pool, so the cross-project page and a single project's page differ only in which rows are in it.

### How the facets combine

#### Context

**User story**: the user narrows by ticking several options: two priority buckets and one stage. Ticking a second bucket widens the list, ticking a second facet narrows it. That is the behavior every faceted list has, and the page keeps it.

#### Business logic

A ticket passes when it satisfies every active facet [4]. A facet with nothing selected is inactive and passes everything. Within one facet the selected options are alternatives: a ticket satisfies the facet by matching any one of them. So "Critical" plus "Medium" under "Priority" widens, while adding "Unplanned" under "Stage" narrows.

The "Clear" button appears exactly when at least one facet is active. The sort and the grouping never count as filters: they reorder and regroup, they never hide a ticket.

### The text search

#### Context

**User story**: the user types "lock detail" into "Search tickets…" and gets the tickets that mention both words, wherever they appear on the ticket.

#### Business logic

The search text is split on whitespace into words, and every word must appear somewhere in the ticket's [1] title, its summary, its filename, or any of its topics. Matching ignores case, and a word matches inside a longer word. Word order does not matter. Text that is only whitespace is not a filter.

### The three numeric facets

#### Context

**User story**: "Priority", "Effort" and "Uncertainty" each open as a short list of named spans with a count each, plus a slider for a precise range, plus an option for the tickets that name nothing — "No priority", "No effort", "No uncertainty".

**Business logic story**: a ticket's priority is the `Priority:` key it names, and its effort and uncertainty are the ratings its plan [5] records. All three run from 0 to 10.

#### Business logic

Each of the three facets [4] holds three things at once: a set of named buckets, an optional hand-set range, and whether tickets [1] naming no value are included.

The buckets are fixed spans of the 0 to 10 scale:

- Priority: "Critical" is 8 to 10, "Medium" is 5 to 7, "Low" is 0 to 4. These are the same thresholds the ticket rows already color by, so the filter's idea of critical is the one the list shows.
- Effort: "Trivial" is 0 to 2, "Moderate" is 3 to 5, "Large" is 6 to 10.
- Uncertainty: "Low" is 0 to 2, "Medium" is 3 to 5, "High" is 6 to 10.

Matching a ticket against one of these facets:

- The facet inactive — no bucket, no range, no "no value" — passes every ticket.
- A ticket naming no value for the field passes only when the facet's "no value" option is on. A priority that is not a number counts as naming no value.
- A ticket naming a value passes when the value falls inside any selected bucket, or inside the hand-set range. Both ends of a bucket and both ends of a range are included.

The "no value" option composes with the rest of the facet: "Critical" together with "No priority" is one selection meaning critical or unprioritized, which is what a triage pass looks for.

When the selected buckets form one unbroken span, the slider mirrors that span, so ticking "Medium" and "Critical" under "Priority" shows the slider sitting at 5 to 10. A selection that skips a bucket in the middle cannot be drawn as one span, and the slider shows nothing instead of a wrong span.

### Buckets and the range never both apply

#### Context

**Problem**: the buckets and the slider are two ways of saying the same thing. Leaving both engaged would put two controls on screen disagreeing about which values are wanted, and the list would answer to only one of them.

#### Business logic

Toggling a bucket clears any hand-set range. Setting a range clears every selected bucket. The "no value" option is set independently and survives both.

### Topics

#### Context

**User story**: the "Topics" facet lists the tags the tickets [1] carry, the most used first, with a count each, plus "No topics" for the tickets that carry none.

#### Business logic

A ticket's topics are matched without regard to case, so `UX` and `ux` are one topic and appear as one option. With topics selected, a ticket passes when it carries at least one of them. "No topics" passes the tickets carrying no topic at all, and composes with selected topics as an alternative.

The options are ordered by count, most used first, and alphabetically among equal counts. A topic the user has selected stays in the list even when the other facets [4] leave it at zero, because an option that disappeared could never be unticked.

### Planning stage

#### Context

**User story**: the "Stage" facet answers "what still needs a plan [5]", "what is planned and ready to work", and "what does an agent [6] already hold".

**Business logic story**: a ticket [1] is planned when a plan file sits beside it, and claimed when a claim [7] file names a holder. A claim covers the ticket's whole life, planning it as well as implementing it, so a claimed ticket may also be planned.

#### Business logic

Three stages, selectable together:

- "Unplanned": the ticket has no plan.
- "Planned": the ticket has a plan.
- "Claimed": a claim exists on the ticket.

Claimed is not exclusive with the other two: a claimed ticket is also either planned or unplanned, and selecting "Planned" and "Claimed" together shows every ticket that is either.

### Project and "Not linked"

#### Context

**User story**: on the cross-project page the user narrows to one or two projects [3]; and "Not linked" answers "which tickets exist only here", the ones nobody has mirrored to GitHub.

#### Business logic

With projects selected, only tickets [1] belonging to one of them pass; with none selected every project passes. The "Not linked" switch keeps only the tickets that carry no GitHub link. The switch and its count are only offered when there is at least one such ticket, or the switch is already on.

### Sorting

#### Context

**User story**: the "Sort" menu offers "Date", "Priority", "Title" and "Effort", and spells out what each direction means for the chosen key: "Newest first" and "Oldest first", "Highest first" and "Lowest first", "A to Z" and "Z to A", "Easiest first" and "Hardest first".

**Problem**: sorting by priority to find what to do next must not bury the list under the tickets [1] that name no priority, in either direction.

#### Business logic

The list is ordered by the chosen key:

- "Date" is the ticket's date, which comes from its filename.
- "Priority" is the priority as a number.
- "Title" is the title, compared as text and ignoring case.
- "Effort" is the effort its plan [5] records.

A ticket that names no value for the chosen key sorts after every ticket that names one, in both directions. Tickets that compare equal fall back to newest first, which is the one tiebreak that means the same thing for every key.

Picking a key from the menu starts it at its own natural direction: newest first for date, highest first for priority, A to Z for title, and easiest first for effort. Changing direction is the menu's explicit pair of buttons; picking the key that is already chosen does not flip it.

### Grouping

#### Context

**User story**: by default the cross-project page shows one section per project [3], which is how the user reads their projects. Turning "Group by project" off produces one flat list across every project, which is the only view that can answer "what is the single highest-priority ticket [1] anywhere".

#### Business logic

Grouping is either one section per project, the default, or no grouping at all. It changes nothing about which tickets are shown.

### The counts beside each option

#### Context

**Problem**: a count computed with the whole filter applied would show zero beside every unticked option the moment one option in that facet [4] is picked, since those tickets [1] are exactly the ones the current selection hides. The count would then never say what ticking the option would give.

#### Business logic

Every option's count is computed over the tickets that pass all the other facets, with the option's own facet ignored entirely. So each count answers "how many tickets would this option show, under everything else currently selected". This holds for the bucket and "no value" counts of the three numeric facets, the topic counts and "No topics", the three stage counts, the per-project counts, and the "Not linked" count.

### The filter view in the address

#### Context

**User story**: the address carries the filters, so `/tickets?q=lock&priority=critical,none&stage=unplanned&sort=priority` is a link the user can share, reload, and come back to after opening a ticket [1]. The unfiltered page stays plain `/tickets`.

**Problem**: an address may be hand-typed or come from an older link. Reading it must never fail, and a token that means nothing must not throw the page away.

#### Business logic

The whole viewing state — every facet [4], the sort and the grouping — is written into the query string, and only what differs from the default is written, so the unfiltered, date-sorted, project-grouped page carries no query string at all.

What is written:

- `q`: the search text, trimmed.
- `priority`, `effort`, `uncertainty`: a comma-separated list of the selected bucket names, then the hand-set range as `<min>-<max>`, then `none` when tickets naming no value are included.
- `topics`: the selected topics, with `none` appended when "No topics" is on. `none` is reserved and is never read back as a topic name.
- `stage`: the selected stages, comma-separated.
- `project`: the selected project [3] ids, comma-separated.
- `github`: the single value `unlinked` when the "Not linked" switch is on.
- `sort`: the sort key, omitted when it is the default date.
- `dir`: the direction, omitted when it is the chosen key's natural direction.
- `group`: the single value `none` when grouping is off.

Reading is deliberately tolerant. Unknown parameters are ignored. Within a numeric facet, an unknown token is ignored rather than rejected, a range token must be two numbers of at most two digits each with the first not above the second and the second not above 10, and a later valid range replaces an earlier one. A stage that is not one of the three is dropped. A sort key that is not one of the four leaves the sort at date. A direction that is neither `asc` nor `desc` falls back to the natural direction of whichever key was read. Grouping is only turned off by the exact value `none`. Anything absent is the default, so a truncated address still opens a usable page.
