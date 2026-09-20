Fixes how a ticket's priority is read and how urgent it looks, so the ticket rows, a ticket's own page, the filter buckets and the sort all agree on one scale.

A ticket names its priority as the `Priority:` key it carries, on a scale from 0 to 10: 10 means act on it immediately, 0 means only if there is capacity. The value is read as a whole number; a ticket that names no priority, or names something that is not a number, counts as having no priority at all rather than as a zero, which is what keeps it out of every priority bucket except "No priority" and sorts it after every rated ticket (the rules are in `ticket-filter.ts`).

How a priority reads on screen, shown as "Priority: <value>": a priority of 8 or more is shown in the danger color, 5 to 7 in the warning color, and anything below 5 in the muted color. A ticket with no priority is shown muted too, and its priority is not written out at all.
