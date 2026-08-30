The Overview's AI Queue card: every project's open agent queue entries — the work The Framework will pick up on its own — grouped by project, with a way to read an entry, a way to start it now, and a way to start a project's top entries as one batch. Both starts also offer "Configure first, then run", which opens the project's launcher with the same prompt instead.

## User story

- The user wants to see, in one place, what the framework is going to work on next across all their projects.
- The user does not want to wait for the drain routine and starts one queued entry right now.
- The user wants several queued entries worked on at once — one agent each — without clicking every entry's play button one by one.
- The user wants to read the ticket behind a queued entry before deciding anything.
- The user wants to start a queued entry on a different model, or somewhere other than this machine — neither of which this card shows.

## Business logic — TL;DR

- **The whole plan, never truncated** - every open entry of every project is listed in full; there is no "+N more".
- **Reading an entry and starting it are different acts** - the entry's title opens what the entry names; a separate play button starts an agent on it.
- **Starting one entry runs it exactly as the drain routine would** - one agent, on that entry alone, unattended, so it finishes and hands off instead of parking on the user.
- **The click follows the agent it started** - the user is taken to the agent, and to the project while its id is not known yet.
- **Fanning out over the top of the queue** - a button on each project's header starts one agent per top open entry, as many as the count beside it says (three unless changed), and stays on the Overview.
- **Configure first, then run** - the chevron beside either start hands its prompt to that entry's own project's launcher instead of starting anything.

## Business logic

### The whole plan, never truncated

#### User story

The user wants to see what the framework will work on next.

#### Business logic

The card lists, per project, that project's open agent queue entries, with a count of open entries beside the project's name. Projects with nothing open are left out entirely; when no project has anything open the card says nothing is queued, and while the queue is still being fetched it says it is loading. Every open entry is shown — a collapsed plan is one the user cannot read. Every entry on the queue is an open one: an entry whose work is done is taken off the queue rather than marked.

Each entry's line is markdown, so the card prints its title rather than its source, with the whole raw line available on hover.

### Reading an entry and starting it are different acts

#### User story

The user wants to read the ticket behind a queued entry, and separately to kick that entry off.

#### Business logic

An entry's title opens what the entry names. A queued ticket is written into the queue as a link back to its ticket, so its title opens that ticket's own page inside the dashboard; an entry pointing at something outside the dashboard opens in a new tab; an entry naming nothing is plain text.

Beside each entry sits a play button, labelled "Spin up an agent working on this entry", which starts the work rather than reading it. Only the clicked entry's button shows itself as busy, tracked by the entry's own content because the list is polled and can shift under a click. While any start is in flight, every start on the card is disabled — the chevrons beside them excepted, since those start nothing. A failed start is reported as an error under the list.

The project's name is a header and nothing more — clicking a project name does not navigate anywhere.

### Starting one entry runs it exactly as the drain routine would

#### User story

The user starts a queued entry themselves and expects the same outcome the framework's own drain routine would have produced.

#### Business logic

The play button starts a single agent whose prompt narrows the drain preset's instruction to this one entry: work on this one open entry of the agent queue only, take it off the queue when the work is done, and start no other entry. The prompt quotes the entry's raw queue line rather than the tidied title, because the agent has to name exactly that line to take it off the queue, and because the line's own link is how the agent opens the ticket.

The agent is started unattended, with the user's own agent preferences: its gates auto-answer, it ends when it settles, and its armed handoff fires — instead of parking in the stay-open chat loop with its PR never opened.

#### Rationale

Started this way, the entry is the same work the drain routine would eventually get to, only on the user's click; running it any other way would leave finished work unpublished.

### The click follows the agent it started

#### User story

The user starts one named entry and wants to watch that agent.

#### Business logic

Once the agent starts, the dashboard goes to that agent — one agent on one named entry is worth watching, unlike the drain routine's fan-out. When the agent's id is not known yet, the dashboard goes to its project and adopts the agent once the poll surfaces it.

### Fanning out over the top of the queue

#### User story

The user wants several queued entries worked on at once — the drain routine's fan-out, but on their own click — without starting each entry by hand.

#### Business logic

Each project's header carries a fan-out button beside a count. Clicking the button starts one agent per open entry, taken from the top of that project's queue, as many as the count says. The count is edited right beside the button, defaults to three, and is floored at one with no maximum, like the routine panel's concurrent-agents setting. With fewer open entries than the count, the batch is just the open entries — the button's label always names the number of agents a click would actually start.

Each agent of the batch is started exactly as the single play button starts one: pinned to its own entry's raw queue line, unattended. The agents are started one after another, and the first failed start ends the batch — the remaining entries are not started, and the failure is reported under the list the same way a single start's is.

While the batch is starting — including between two of its starts — every start on the card is disabled, again excepting the chevrons, and the clicked project's fan-out button shows itself as busy.

Unlike starting a single entry, the dashboard stays on the Overview: the started agents surface in the working-now card beside this one.

#### Rationale

- One agent pinned per named entry, rather than several agents each told to work the queue: agents started together all read the same queue, so each would pick the same first entry and implement it as many times over — the same reason the drain routine pins the entries of its own batch.
- Starting one after another, ending at the first refusal: whatever refused a start would refuse the next one a moment later.
- Staying on the Overview: a batch has no single agent to follow.

### Configure first, then run

#### User story

The user wants a queued entry worked on a different model, or somewhere other than this machine — settings that live in the launcher and the global options, not on this card.

#### Business logic

Both starts on the card are split buttons: beside each sits a chevron whose menu holds "Configure first, then run". Taking it opens the launcher of the project the pressed control belongs to — the entry's own project, never the first project listed — carrying the prompt that press would have sent, and starts nothing.

For an entry's play button that is the entry's own prompt. For a project's fan-out button it is the top entry's prompt alone, and the entry says so: a launcher can only ever send one agent, so that half really is a different act from the batch beside it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
