What the tests cover:

- **The priority facet** - opens on three named spans, each carrying the count of tickets it would show ("Critical (8–10)" reads 1 against a backlog with one priority 9 ticket); picking a span narrows to that span; the fine-grained range sits under the spans, reading "Range: any" while unset; "No priority" is offered when some ticket names none, and is absent when every ticket names one.
- **The effort and uncertainty facets** - do not exist until some plan has recorded those numbers, and appear as soon as one ticket names them.
- **The topics facet** - lists topics with counts, treating `UX` and `ux` as one topic, and picking one filters by its lowercase form.
- **The project facet** - appears only when more than one project is registered.
- **The stage facet** - counts "Claimed" by the ticket's claim rather than by its plan, so a ticket that is both planned and claimed counts in both.
- **Clearing** - a "Clear" button appears as soon as any filter is active and resets every filter to its default, leaving the sort key and direction untouched.
- **Choosing a sort key** - picking a different key switches to it at that key's natural direction ("Priority" starts highest first); picking the key that is already applied changes nothing.
- **Choosing a direction** - the two direction buttons sit in the same menu, labeled by what they mean for the current key ("Newest first", "Oldest first"), with the applied one marked as pressed.
- **Spans and the range agree** - a selection of adjacent spans is one window, so the range mirrors it ("Range: 5–10") and stays live; only a selection that skips a middle span, which no single window can express, grays the range and reads "Range: not one span".
- **The search shortcut** - pressing `/` puts the cursor in the search box, and the `/` keycap shown in the empty box steps aside once the box is focused.
- **Grouping** - unticking "Group by project" switches the page to the flat cross-project list.
