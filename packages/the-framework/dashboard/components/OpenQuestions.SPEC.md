The open questions hub: every live agent's pending gate, pooled across all projects, answerable in one place. It is the launcher's main event — the user arrives, clears everything that is waiting on them, and only then starts something new.

## User story

The user comes back to the dashboard after being away. Several agents across several projects have parked on a choice. They want to answer all of them in one pass, without opening each agent in turn.

## Business logic — TL;DR

- **Everything at once, longest-waiting first** - all pending gates are shown together in one scrolling view, in the order the daemon returns them (longest-waiting first), never paginated.
- **Answer without leaving** - each card carries the gate's own choice controls, so the pick is made here; each card also links into the agent that asked, which may belong to another project.
- **An answered question stays put** - answering collapses the card to a single line naming what was picked, and it stays there even after the daemon stops reporting the gate. Clicking the line re-expands the answer.
- **Autopilot is off here** - a gate's automatic-acceptance countdown does not run in this hub.
- **Nothing waiting, nothing shown** - the section disappears entirely rather than showing an empty "Waiting on you".
- **A jump list once there is more than one** - a sticky list of the questions sits beside the scrolling cards, with answered ones ticked and dimmed.

## Business logic

### Every gate, in one view

#### User story

See `## User story`.

#### Business logic

The hub polls the daemon every five seconds for all live agents' pending gates and renders one card per gate. The heading reads "Waiting on you" followed by the count of still-unanswered questions. Each open card is topped by the agent's identity — its session name, or failing that the first line of what it was asked to do, or failing that its agent id — together with the project it belongs to, and a link into that agent.

The cards scroll within their own area rather than growing the page, and there is no pagination: the point of the hub is that a full sweep of what is waiting is visible in one place.

### An answered question does not vanish

#### User story

The user answers one question and immediately reaches for the next. If the card disappeared under the cursor the moment the daemon dropped the resolved gate, the list would jump and the next click would land on the wrong question.

#### Business logic

Answering a gate collapses that card in place to a single line stating what was picked, alongside which agent had asked and a way into it. The line stays for as long as the hub is open, whether or not the daemon still reports that gate — while the daemon is catching up the collapsed card holds its position, and once the gate is gone from the poll the collapsed line remains at the end of the list. Clicking it re-expands the answer.

This memory lasts only as long as the page is open: reloading the dashboard starts clean. A gate that fires again is a fresh card, since it is a different question being asked.

### Autopilot does not fire here

#### User story

The user opens the launcher with eight questions waiting and steps away to make coffee.

#### Business logic

The countdown that auto-accepts a gate's recommended option is disabled for every card in this hub. A view that renders every pending gate at once must not answer all of them on the user's behalf seconds after it opened.

### The jump list

#### Business logic

Once there is more than one question, a list of them sits beside the scrolling cards and stays put while the cards scroll; selecting an entry scrolls its card into view. Answered entries are ticked and dimmed. With a single question there is nothing to navigate, so no list is shown.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
