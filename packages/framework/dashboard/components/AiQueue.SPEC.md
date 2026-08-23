The Overview's AI Queue card: every project's open agent queue entries — the work The Framework will pick up on its own — grouped by project, with a way to read an entry and a way to start it now.

## User story

- The user wants to see, in one place, what the framework is going to work on next across all their projects.
- The user does not want to wait for the drain routine and starts one queued entry right now.
- The user wants to read the ticket behind a queued entry before deciding anything.

## Business logic — TL;DR

- **The whole plan, never truncated** - every open entry of every project is listed in full; there is no "+N more".
- **Reading an entry and starting it are different acts** - the entry's title opens what the entry names; a separate play button starts an agent on it.
- **Starting one entry runs it exactly as the drain routine would** - one agent, on that entry alone, unattended, so it finishes and hands off instead of parking on the user.
- **The click follows the agent it started** - the user is taken to the agent, and to the project while its id is not known yet.

## Business logic

### The whole plan, never truncated

#### User story

The user wants to see what the framework will work on next.

#### Business logic

The card lists, per project, that project's open agent queue entries, with a count of open entries beside the project's name. Projects with nothing open are left out entirely; when no project has anything open the card says nothing is queued, and while the queue is still being fetched it says it is loading. Every open entry is shown — a collapsed plan is one the user cannot read. Checked-off entries are not listed.

Each entry's line is markdown, so the card prints its title rather than its source, with the whole raw line available on hover.

### Reading an entry and starting it are different acts

#### User story

The user wants to read the ticket behind a queued entry, and separately to kick that entry off.

#### Business logic

An entry's title opens what the entry names. A queued ticket is written into the queue as a link back to its ticket, so its title opens that ticket's own page inside the dashboard; an entry pointing at something outside the dashboard opens in a new tab; an entry naming nothing is plain text.

Beside each entry sits a play button, labelled "Spin up an agent working on this entry", which starts the work rather than reading it. Only the clicked entry's button shows itself as busy, tracked by the entry's own content because the list is polled and can shift under a click. While any start is in flight, every play button is disabled. A failed start is reported as an error under the list.

The project's name is a header and nothing more — clicking a project name does not navigate anywhere.

### Starting one entry runs it exactly as the drain routine would

#### User story

The user starts a queued entry themselves and expects the same outcome the framework's own drain routine would have produced.

#### Business logic

The play button starts a single agent whose prompt narrows the drain preset's instruction to this one entry: open `TODO_AGENTS.md`, work on this one open entry only, then check it off, and start no other entry. The prompt quotes the entry's raw queue line rather than the tidied title, because the agent has to find exactly that line to check it off, and because the line's own link is how the agent opens the ticket.

The agent is started unattended, with the user's own agent preferences: its gates auto-answer, it ends when it settles, and its armed handoff fires — instead of parking in the stay-open chat loop with its PR never opened.

#### Rationale

Started this way, the entry is the same work the drain routine would eventually get to, only on the user's click; running it any other way would leave finished work unpublished.

### The click follows the agent it started

#### User story

The user starts one named entry and wants to watch that agent.

#### Business logic

Once the agent starts, the dashboard goes to that agent — one agent on one named entry is worth watching, unlike the drain routine's fan-out. When the agent's id is not known yet, the dashboard goes to its project and adopts the agent once the poll surfaces it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
