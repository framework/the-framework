The Overview's [1] "AI Queue" card: every project's open queue entries [2], grouped by project and shown in full, with two ways to act on them: a play button per entry that starts one agent [3] on that entry alone, and a fan-out [4] button per project that starts one agent per top entry, as many as the count typed beside it. Both are split buttons whose chevron hands the same prompt to the project's launcher [5] instead of starting anything.

## Context

**User story**: the user opens the Overview, reads under "AI Queue" what the agents will pick up next in each project, clicks a ticket's title to read it, presses play on one entry to have it worked now, or sets "3" and presses the fan-out button to start three agents on a project's top three entries.

**Business logic story**: this card starts an agent on one named entry on the user's click, through the project's start hook, like the launcher does.

## Glossary

[1] the Overview: the dashboard's cross-project page at `/`.
[2] the agent queue: `TODO_AGENTS.md` on the `agent-data` branch: every task agents will work next, in priority sections, worked top-down. An item on it is a queue entry.
[3] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[4] fan-out: starting several agents at once, one per queue entry.
[5] launcher: project home is a project's own page with the launcher (the Start form) and its composer (the prompt editor, also used for live chat).
[8] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs`.
[9] preferences: the user's dashboard settings, kept in the registry (`~/.the-framework.json`, which also lists the projects).

## Business logic — TL;DR

- **What the card shows** - "AI Queue", "Tasks AI will work on next", then every project with at least one entry: its name, its count, and all of its entries; "Loading…" or "Nothing queued." otherwise.
- **An entry's title opens what it names** - a queued ticket's title opens that ticket's page, a web link opens in a new tab, anything else is plain text; the raw queue line is the tooltip.
- **The play button starts one agent on one entry** - an agent told to work that entry only and take it off the queue when published, with the coding agent and model the user picked; the dashboard then goes to that agent.
- **The fan-out button and its count** - a number box (3 by default, never below 1) and a button that promises exactly what a click starts, capped at the open entries: one agent per top entry, started one after another, stopping at the first refusal, with no navigation.
- **"Configure first, then run"** - each button's chevron hands its prompt to the project's launcher as a draft instead of starting; for the fan-out, the top entry's prompt alone.
- **One start at a time** - while any start or fan-out is in flight every start on the card is out, only the clicked button spins, and a refusal is shown under the list.

## Business logic

### What the card shows

#### Context

See `## Context`.

#### Business logic

The card is titled "AI Queue" with the subtitle "Tasks AI will work on next". While the queues are still loading it says "Loading…". A project is listed only when it has at least one entry; when no project does, the card says "Nothing queued.". Each listed project shows its name, a pill with its number of entries, the fan-out [4] count box and button, and then every entry as a bulleted row, all of them: there is no "+N more", since a collapsed plan is one the user cannot read. The entries are the open ones, in order of work, as the project's queue provider answers them (`src/dashboard/queue.ts`); a project without a queue is not in the list at all.

### An entry's title opens what it names

#### Context

**Problem**: an entry is a line of `TODO_AGENTS.md`, and a ticket queued from the dashboard is written as a link back to its ticket, often followed by an agent's own note; printed raw, the line reads as markdown source and its title is pushed out of a truncated row.

#### Business logic

Each row prints the entry's title rather than its source: the text of a link at the start of the line, else the line itself, with the whole raw line in the row's tooltip. A title that links into the project's tickets is a button that opens that ticket's own page in the dashboard; one that links to a web address is a link opened in a new tab; any other title is plain text and opens nothing. How a line splits into title and target is in `lib/queue-entry.ts`.

### The play button starts one agent on one entry

#### Context

**User story**: the user presses play on "Improve tooltip…" and watches one agent [3] implement that entry, now.

#### Business logic

The play button, named "Spin up an agent working on this entry", starts a agent whose prompt is: "Use the `queue` skill: work on this one open queue entry only, and when the work is done and published run `queue done "<the entry>"`. Do not start any other entry. The entry:" followed by the entry's raw line. The raw line, not the pretty title, so the agent names exactly this entry when it takes it off the queue through the `queue` skill [8]. The start carries the coding agent and the model the user picked in their preferences [9], when they picked them. Once the daemon accepts the start, the dashboard goes to that agent; when the daemon has not yet named it, the dashboard lands on the project and picks up the running agent as soon as it appears.

### The fan-out button and its count

#### Context

**Problem**: several agents told "work the first open entry" would all implement the same one; a batch must pin each agent to its own entry.

#### Business logic

- Beside each project's name is a number box named "How many agents to spin up" (tooltip "How many agents to spin up — one per entry, from the top of the queue."). It starts at 3 and is kept per project for the life of the page; a typed value is rounded to an integer and floored to 1, and a cleared or non-numeric box changes nothing, since an emptied field is mid-edit rather than a count.
- The fan-out [4] button's name and tooltip promise exactly what a click would start, sized to the smaller of the count and the project's open entries: "Spin up an agent working on the top entry" for one, else "Spin up N agents working on the top N entries".
- A click starts one agent per entry from the top of the queue, as many as that count, one after another, each with the same single-entry prompt as the play button, with the user's picks from their preferences [9]. The batch stops at the first refusal: whatever refused that start would refuse the next one a moment later, and the refusal stays on screen under the list. A fan-out never navigates: the started agents appear in the Overview's agents card.

### "Configure first, then run"

#### Context

**Problem**: a start button spends an agent [3] on settings that are nowhere near it, the driver, the model and where it runs; those live on the launcher [5].

#### Business logic

Both the play button and the fan-out [4] button are split buttons: beside each is a chevron (named "Other ways to run <title>" for an entry, "Other ways to spin up agents on <project>'s queue" for a project) opening one item, "Configure first, then run". Choosing it starts nothing: it stashes the button's prompt as a carried draft and opens the project's launcher, where the draft fills the composer and the driver, model and location can be set before sending. The entry's chevron carries that entry's prompt ("Opens the launcher with this entry's prompt, so you can set the model and where it runs."); the project's chevron carries the top entry's prompt alone, since a launcher can only ever send one agent ("Opens the launcher with the top entry's prompt — one agent, not the batch."). The chevron stays usable while a start is in flight. The split button's own rules are in `StartAgentButton.tsx`.

### One start at a time

#### Context

**Problem**: the list is polled and can shift under a click; a second click during a batch could slip into the gap between two of its starts.

#### Business logic

While any start on the card is in flight, whether a single play or a project's fan-out [4], every play and fan-out button on the card is disabled; only the button that was clicked shows a spinner, identified by its project and entry text rather than its position. A refused or failed start shows its message under the list, in red: the daemon's refusal of a second agent on a busy project reads "An agent is already active for this project.", any other failure "Failed to start the agent." (the wording is decided in `lib/use-start-agent.ts`).
