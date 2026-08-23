What the tests cover, for the cross-project Overview:

- **Working now** — only running agents are surfaced, ordered by last activity with the most recent first; finished agents are left out. A `web`-target agent whose cloud session is still working or waiting on a bridged question is listed, marked with that state and keyed to the project's path; one whose work was adopted, one too old for its session to be alive, and one that was stopped are not; two projects sharing one archive list each such agent once.
- **Backlog and recents** — the open agent queue entries of every project are summed into one total; recently active projects come back newest first, capped at five, and a project that has never seen activity is omitted.
- **Recent agents** — every project's agents are pooled into one newest-first list, each tagged with the project it belongs to; a project whose agents cannot be read contributes nothing.
- **Ticket lanes** — a ticket being implemented by a running agent, or merely planned, is "in progress"; a ticket linked from an open agent queue entry is in the AI Queue lane; a ticket flagged high priority and nothing else is "high priority"; anything in none of the three is dropped. Precedence is in progress over AI Queue over high priority.
- **Priority scale** — priority is read on the ticket format's 0-to-10 scale, so 7 and above is high and 6 and below is not; word spellings such as "high", "urgent", "p0" and "p1" do not count as high.
- **Hot tickets** — tickets from all projects are pooled, bucketed, ordered lane first, and tickets in no lane drop off the card; the ticket a running agent is implementing carries that agent's identity so the card can link into it; a finished agent is not implementing anything, so its ticket falls back to whatever other lane applies; a ticket path is matched only within its own project, so one project's agent never lights up another project's identically named ticket; a project whose tickets cannot be read contributes nothing.
- **Cross-project ticket lists** — each project keeps its own unpooled ticket list in registry order, and a project stays present with an empty list both when it has no tickets and when its tickets cannot be read, so its import action stays reachable.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
