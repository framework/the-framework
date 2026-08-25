Builds the dashboard's cross-project Overview: what agents are working on right now, how big the backlog is, which projects were active recently, the recent agents pooled across every project, every project's tickets, and the shortlist of hot tickets.

## User story

The user has several projects registered and opens the dashboard without picking one. The Overview answers, at a glance: what is being worked on this moment, how much confirmed work is still queued, which projects have seen recent activity, and which tickets deserve attention next.

## Business logic — TL;DR

- **Working now** - every project's running agents, plus every `web`-target agent whose cloud session is still working or parked on a question, most recently active first, each labelled with its task, its session name, whether it has signalled ready for merge, and — when another machine's daemon started it — that machine's name.
- **Backlog size** - the number of still-open agent queue entries summed across every project.
- **Recently active projects** - the five projects that saw activity most recently.
- **Recent agents, pooled** - the newest agents across all projects in one list, each tagged with the project it belongs to, and listed once even when two registered checkouts share the archive that holds it.
- **Every project's tickets** - one ticket list per registered project, in registry order, projects kept even when they have no tickets.
- **Hot tickets** - a shortlist of tickets across all projects, sorted into three lanes: being worked on now, waiting in the agent queue, or merely flagged high priority.
- **A broken project is silently absent** - anything unreadable contributes nothing rather than failing the whole Overview.

## Business logic

### Working now

#### User story

The user wants to know, without opening any project, which agents are running and what each is doing.

#### Business logic

Every project's live agents are read and only those still running are listed, one entry per agent — a single project can have several in flight, each in its own worktree. Every project's archived agents are read too, for the `web`-target agents whose cloud side is still at work per the cloud state rule (`cloud-run-state`): in cloud, or waiting on a human per the browser bridge — a question it holds, or claude.ai's session list showing the session awaiting input. Those are listed as well, marked with that state, keyed to the project's own path since their checkout may be gone, and once each even when two registered checkouts of one repository share the archive that holds them; a cloud session at work is an agent at work, and "no agents working" over a session waiting on the user was a lie. Each entry carries the project it belongs to, the agent's own checkout so its git and file status is read from the worktree it actually edits, what the user asked for, when the agent last spoke, the session name the agent chose if it has picked one, whether it has signalled ready for merge (which drives the building-versus-ready indicator), and the name of the machine whose daemon started it when that is not this machine — the data branch is shared, so another machine's agents appear here too. The list is ordered by last activity, most recent first.

### Backlog size

#### User story

The user wants one number for how much confirmed work is still waiting, across everything.

#### Business logic

The still-open entries of every project's agent queue are counted and summed into a single total.

### Recently active projects

#### User story

Returning after a while, the user wants to jump back into whatever they were last working on.

#### Business logic

Projects that have ever seen activity are ordered by their last activity, most recent first, and the top five are shown.

### Recent agents, pooled

#### User story

On the Overview no single project is selected, yet the sidebar should still list recent agents so the user can jump straight back into one.

#### Business logic

Every project's agents are pooled into one list, each row tagged with the project it belongs to so selecting it jumps into that project's agent. The list is ordered by start time, newest first, and capped at thirty rows. An agent is listed once: two registered checkouts of one repository share the archive that holds it, and the first project to list it keeps it. A project whose agents cannot be read contributes nothing.

### Every project's tickets

#### User story

The user opens the cross-project Tickets page to browse each project's roadmap and to reach that project's own ticket import and update actions.

#### Business logic

Each registered project's tickets are read into its own list, kept in registry order. Unlike the hot tickets shortlist, nothing is pooled or bucketed: a ticket belongs to one project and the page's purpose is per-project browsing. A project is always present, even when it has no tickets or its tickets cannot be read, so its import action stays reachable.

### Hot tickets

#### User story

The user wants a shortlist of what matters across every project's roadmap, without reading each full backlog: what is being coded right now, what The Framework will pick up on its own, and what a human would likely queue next.

#### Business logic

Every project's tickets are pooled and each is sorted into one of three lanes, in this order of precedence:

- **In progress** — a running agent recorded that it is implementing this ticket, or failing that the ticket has been planned, meaning work is under way in the older, inferred sense. When a running agent is actually implementing it, the ticket carries that agent's identity so the card can link straight into it; without it, the lane was only inferred from the ticket having a plan.
- **AI Queue** — an open agent queue entry links to the ticket, so The Framework will pick it up unattended. A queue entry counts as pointing at a ticket only when a markdown link sits at the very start of the entry and its target is inside the tickets directory, matching how the dashboard labels a queue entry; a completed queue entry never counts.
- **High priority** — none of the above, but the ticket's priority reads as "do this soon".

A ticket in none of the three lanes is dropped: the card is a shortlist, not the whole backlog. Results are ordered lane first (in progress, then AI Queue, then high priority), keeping each project's file order within a lane, and capped at sixty tickets before the card trims each lane further. A project whose tickets or agents cannot be read contributes nothing.

Which tickets are being implemented is matched per project, because a ticket's path is only unique within its own repo.

#### Rationale

Priority is read on the ticket format's own 0-to-10 scale, where 10 means act immediately, so 7 and up counts as high. This is deliberately not the P0/P1 convention, whose low-numbers-first reading is the opposite: reading it backwards is what once kept a backlog full of priority-8 tickets off the card entirely. Word spellings such as "high" or "urgent" are not read at all, because the format specifies numbers.

The "implementing" evidence is hard but only exists for agents draining the agent queue, so the planned-ticket proxy is kept as well to still surface tickets someone is working by hand.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
