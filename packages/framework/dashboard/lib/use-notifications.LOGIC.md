Fires a browser notification when something new appears in one of the dashboard's two feeds: an intervention [1], something that needs a human, and activity [2], an agent [3] starting or finishing. Only genuinely new items are announced, and what was already there when the user started watching a project [4] never is.

## Context

**User story**: the user leaves the dashboard open in a background tab. When an agent parks on a question, when a pull request lands for review, when work is left unpushed, or when an agent starts or finishes, the operating system shows a notification; clicking it opens the pull request on GitHub, or brings the dashboard tab forward. What was already waiting when the tab was opened is not announced, so opening the dashboard never produces a burst of notifications about things the user already knows.

**Business logic story**: the daemon delivers the same two feeds to Discord on its own schedule, whether or not a dashboard is open. Both surfaces use the same rule for what counts as the same item and the same rule for what counts as already there, so a user with both enabled hears about the same things and never twice about one thing.

**Problem**: an item's identity has to survive re-reads. The feeds are re-read on a timer, and every read returns everything currently waiting, not only what changed. Without a stable identity per item, every read would announce everything again.

## Glossary

[1] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds.
[2] activity: the other notification feed: an agent started or finished.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[5] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[6] open question: a gate nobody has answered yet, as the dashboard lists them across projects.

## Business logic — TL;DR

- **Two gates before anything is shown** - the user's own preference for the feed and for browser delivery, and the browser's own permission.
- **What counts as the same item** - each item has a stable identity, so one thing is announced exactly once no matter how often the feed is re-read.
- **What counts as already there** - a project's existing items are absorbed silently the first time that project is read completely, and only then does that project start announcing.
- **Turning the notifications off does not bank a backlog** - the feeds keep being absorbed while notifications are off, so turning them back on announces nothing retroactively.
- **What an intervention notification says** - one item names the project, several are counted, and each line reads as a pull request, a question, or unpushed work.
- **What an activity notification says** - an agent started or finished, named by what it is building.
- **What a click does** - a pull request opens on GitHub in a new tab, everything else brings the dashboard tab forward.

## Business logic

### Two gates before anything is shown

#### Context

**User story**: in Settings the user chooses which feeds to be notified about and by which method. Browser notifications also require the browser's own permission, which the user grants once.

#### Business logic

A notification is shown only when both hold: the user has the feed's category and browser delivery on in their preferences, and the browser has granted the notification permission. In a browser that does not support notifications at all, nothing is shown and nothing fails.

The intervention [1] feed is polled regardless, since the same read also drives the sidebar badge and the "needs you" card. The activity [2] feed is polled only while its notifications would actually fire, since nothing else on the page reads it.

### What counts as the same item

#### Context

**Problem**: each read of a feed returns everything currently waiting. Something must decide which of those the user has already been told about, and that decision must survive the item's title changing or the list being re-ordered.

#### Business logic

Every item carries a stable identity, and an item is announced at most once:

- A pull request is identified by its URL, which survives the title being edited and the list being re-ordered.
- An open question [6] is identified by the project [4], the agent [3] parked on it and the gate [5] it is parked on. The agent is part of the identity because a gate's own id is only unique within one agent, so two agents in one project parked on their first gate would otherwise count as one item and only one of them would be announced.
- Unpushed work is identified by the project and the agent whose branch holds it.
- An activity [2] item is identified by whether the agent started or finished, plus the project and the agent, so one agent produces two announcements over its life, one when it starts and one when it lands, each fired once.

These are the same identities the daemon's Discord delivery uses.

### What counts as already there

#### Context

**Problem**: everything already waiting when the user opens the dashboard would otherwise be announced as new. Counting the first read or two as the baseline is not enough: a page opened while the daemon cannot reach GitHub sees an empty list, and the first read that does reach GitHub would then announce every already-open pull request as new.

#### Business logic

The baseline is kept per project [4], and a project only earns one when it has been read completely — that is, when every source behind the feed answered for that project, so its share of the items is all of it, not merely all that could be reached.

- Items belonging to a project that has no baseline yet are absorbed silently.
- Once a project has been read completely, its items from then on are announced when their identity has not been seen before.
- A project that cannot be read stays silent until it can be, and earns no baseline from a partial read. Other projects are unaffected: a project registered without a reachable remote is an ordinary case and must not silence everything else.
- Items seen in a partial read are still absorbed, because a partial read can under-report but never invent, so anything it did see is not news later.

### Turning the notifications off does not bank a backlog

#### Context

**Problem**: a user who turns a feed off for an hour and back on must not then be told about everything that happened during that hour, all at once.

#### Business logic

Every read of a feed is folded into the baseline whether or not notifications are enabled; only the showing of the notification is gated. Whatever happened while a feed was off counts as already there.

Flipping the preference alone does not re-examine the feed already in hand. Only a genuinely new read can produce an announcement, so toggling the setting can never replay what is on screen.

### What an intervention notification says

#### Context

**User story**: the notification must be readable at a glance from another application, and say which project [4] it is about.

#### Business logic

One new item titles the notification "Human Queue · <project name>". Several new items in one read are announced together, titled "<count> items in your Human Queue". The body has one line per item:

- A pull request reads as its number and title, as in `#42 Fix the lock race`.
- An agent [3] parked on a question reads as the question's title.
- Unpushed work reads as the agent's title, then a dash, then how many commits are not pushed — "1 commit not pushed", or "<count> commits not pushed", or just "work not pushed" when the count is unknown or zero.

### What an activity notification says

#### Context

**User story**: with the activity [2] feed on, the user hears an agent [3] kick off and hears it land, without having to keep the dashboard in view.

#### Business logic

One new item titles the notification "Agent started · <project name>" or "Agent finished · <project name>". Several are titled "<count> agent updates". The body has one line per item, reading "Started: <what the agent is building>" or "Finished: <what the agent is building>", falling back to "a session" for an agent whose task is not known.

### What a click does

#### Context

**User story**: clicking a notification takes the user to where the thing can be acted on.

#### Business logic

Clicking a notification about a pull request opens that pull request on GitHub in a new tab. Every other notification brings the dashboard's own tab forward instead, since the question, the unpushed work and the agent [3] all live in the dashboard. When several items were announced together, the click follows the first of them. The notification closes on click either way.
