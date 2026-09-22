Topics: [tickets]

# Give every ticket that has no Topics line one, from its title and TLDR

## TLDR

8 of the 17 open tickets have no `Topics:` line, so the Tickets page's Topics filter cannot find them and its search matches them only by words. Give each of them a `Topics:` line chosen from its title and TLDR, reusing the words the other tickets already use where they fit. Only the ticket files change: no code, no plan, no other line.

## Why it matters

A filter that silently leaves out half the backlog reads as "nothing here". With every ticket carrying topics, narrowing the list by topic shows the whole backlog on that topic.
