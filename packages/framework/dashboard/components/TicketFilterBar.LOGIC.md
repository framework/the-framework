The toolbar above the dashboard's Tickets list at `/tickets`: a search box, one button per facet the backlog can be narrowed by (priority, topics, planning stage, effort, uncertainty, project, and tickets with no GitHub link), a way to clear every filter, and a menu that sets the sort order and whether the list is grouped by project. Every control hands the page a whole new viewing state, which the page writes into its address; what each filter actually hides, and how the address spells it, is decided by the rules in `lib/ticket-filter.ts`.

## Context

**User story**: the backlog is one long cross-project list, and the user narrows it to the question at hand — "the critical ones nobody planned yet", "everything tagged `dx`", "the tickets an agent [1] already holds", "the ones I wrote myself rather than imported from GitHub" — then reads the narrowed list, shares it as a link, or hands it to the agents in bulk from the page's heading.

**Problem**: a facet whose options carry no counts forces the user to try each one to find out whether it shows anything. Every option here states how many tickets it would show, so the user picks once instead of probing.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] claim: a ticket's lock file naming the holder working it, so two agents never work the same ticket.

## Business logic — TL;DR

- **Search** - one box matching every word against a ticket's title, summary, file name and topics, focusable from anywhere on the page with the `/` key.
- **What every option counts** - an option's count is how many tickets it would show under the other filters, ignoring its own facet's current selection.
- **The numeric facets** - priority, effort and uncertainty each offer three named spans, a fine-grained range, and "names no value", the spans and the range being two ways to say one thing.
- **Topics, stage and project** - three plain option lists, each shown only when it has something to say.
- **Tickets nobody linked to GitHub** - one toggle for the tickets written here rather than imported.
- **Clearing the filters** - one button, shown only while something is filtered, resetting the filters and leaving the sort and the grouping alone.
- **Sort and grouping** - one menu: the sort key, the direction spelled out in the key's own words, and whether the list is grouped by project.

## Business logic

### Search

#### Context

See `## Context`.

#### Business logic

The box carries the placeholder "Search tickets…" and is labeled "Search tickets". Typing narrows the list as the user types; every whitespace-separated word must appear somewhere in a ticket's title, summary, file name or topics, ignoring case (the matching rule is in `lib/ticket-filter.ts`).

Pressing `/` anywhere on the page moves the cursor into the box, unless the user is already typing into a text field, and the key itself is not typed into whatever had focus. A `/` keycap sits at the right of the empty, unfocused box to advertise the shortcut, and steps aside as soon as the box is focused or holds text. A modified `/` (with the Command, Control or Alt key held) is left to the browser.

### What every option counts

#### Context

**Problem**: if every option counted only the tickets that pass the filters as they stand, then picking one option would collapse every other option in the same facet to zero, and the user could no longer see what adding a second option would bring in.

#### Business logic

Every option in every facet carries a number to its right: how many tickets it would show with all the other facets applied but its own facet's current selection ignored. So "Critical" and "Medium" both keep meaningful counts while "Critical" is picked, and the counts still shrink when the search box or another facet narrows the pool.

A facet's button carries the facet's name and, when the facet is filtering, a small badge with the number of its own clauses that are active — a picked span, a set range and "names no value" each count as one clause.

### The numeric facets

#### Context

**User story**: the user triages by size: the critical tickets first, the trivial ones when there is a spare moment, the highly uncertain ones only with a human at hand. Priority is the ticket's own `Priority:`; effort and uncertainty come from the ticket's plan, so a ticket with no plan names neither.

**Problem**: named spans are how the user thinks ("critical", "trivial"), but a triage sometimes needs an exact window ("priority 6 to 8"). Offering both invites a contradiction — spans saying one thing and a slider another — so they are one selection with two faces.

#### Business logic

Priority, effort and uncertainty each open a panel with three named spans over the 0-10 scale, then a range control, then, last, a row for the tickets that name no value at all:
- Priority: "Critical (8–10)", "Medium (5–7)", "Low (0–4)", and "No priority". The three spans are the same thresholds the rows color a priority by.
- Effort: "Trivial (0–2)", "Moderate (3–5)", "Large (6–10)", and "No effort".
- Uncertainty: "Low (0–2)", "Medium (3–5)", "High (6–10)", and "No uncertainty".

Picking spans and setting a range are two ways to express the same window, so engaging one clears the other: picking a span drops the range, dragging the range drops the spans. "Names no value" survives both, because "critical or unprioritized" is a real triage lens.

The range control reads "Range: 3–7" when a range is set, "Range: any" when none is, and carries a cross labeled "Clear the priority range" (or the effort or uncertainty one) that drops the range only. When spans are picked and they cover one uninterrupted window, the range mirrors that window, so dragging refines from where the spans left off. When the picked spans skip a middle one, no single window can express them: the range reads "Range: not one span" and is grayed, with the explanation "The selected buckets skip a middle span — dragging the range replaces them". It stays usable — dragging it replaces the spans, as the explanation says.

The "names no value" row appears only when at least one ticket names no value, or when the clause is already on, so a backlog where every ticket is rated does not offer an empty option.

The priority facet is always offered. The effort and uncertainty facets are offered only when at least one ticket anywhere names that value, or when the facet is already filtering: before any ticket has a plan, there is nothing to filter by.

### Topics, stage and project

#### Context

**User story**: the user narrows to an area of the product by topic, to a step of the pipeline by stage — what still has no plan, what is planned, what an agent [1] is already holding — or, with several projects registered, to one project's tickets.

#### Business logic

Three facets that are plain lists of options with counts:
- "Topics": one option per topic in the backlog, lowercased, most common first and alphabetically within an equal count, so the busy tags lead. A picked topic stays listed even when the other filters leave it at zero, or the user could not unpick it. A "No topics" option, last, covers the tickets that name none. The whole facet is offered only when the backlog has at least one topic, or the "No topics" clause is already on.
- "Stage": exactly three options, "Unplanned", "Planned" and "Claimed". Claimed means an agent [1] holds the ticket's claim [2], whether to plan it or to implement it, which is why it composes with the other two rather than excluding them.
- "Project": one option per registered project, by name. It is offered only when two or more projects are registered, since with one project every ticket is that project's.

Picking several options within one facet widens the list; the facets narrow each other.

### Tickets nobody linked to GitHub

#### Context

**User story**: some tickets are imported from GitHub issues and carry a link back to the issue; the rest were written here. The user reviewing what the framework itself produced wants only the latter.

#### Business logic

A "Not linked" toggle, carrying the count of tickets with no GitHub link, narrows the list to exactly those. It appears only when at least one such ticket is in the pool, or the toggle is already on, and it shows whether it is pressed.

### Clearing the filters

#### Context

**Problem**: a narrowed list with several facets engaged is tedious to undo option by option, and a user who has lost track of what is filtering needs one way back to the whole backlog.

#### Business logic

A "Clear" button appears as soon as any filter is active — a non-blank search, any numeric clause, any topic, any stage, any project, or the "Not linked" toggle — and resets every one of them at once. The sort order and the grouping are a viewing preference rather than a filter: they reorder, never hide, so "Clear" leaves them as they are.

### Sort and grouping

#### Context

**Problem**: "descending" says nothing until the reader knows which column is sorted. The direction is therefore never named as a direction, always as what it means for the current key.

#### Business logic

At the right of the bar, one menu button reads "Sort: " and the current key — "Date", "Priority", "Title" or "Effort" — with an arrow showing the direction. The menu holds three parts:
- The four keys, with a check mark on the current one. Picking a different key switches to it at that key's own natural direction: "Date" newest first, "Priority" highest first, "Title" A to Z, "Effort" easiest first. Picking the key that is already current does nothing, so the direction is never flipped by an accidental second click, and the menu stays open while the list re-orders behind it.
- The direction, as two buttons: one ascending, one descending, the applied one highlighted, with the meaning for the current key spelled out beside them — "Newest first" or "Oldest first" for date, "Highest first" or "Lowest first" for priority, "A to Z" or "Z to A" for title, "Easiest first" or "Hardest first" for effort. Those same words label the two buttons.
- "Group by project", a checkbox item: ticked, the list is one section per project; unticked, it is one flat list across every project.

The count of shown over total tickets is not part of this bar; it sits beside the page's heading.
