What the agent view [1] says about a hands-off [2] agent [3] whose location [4] is `web`: a notice row telling where the work went and how to reach the cloud session [5], the question that session is parked on rendered as the same "Your call" gate [6] card a local agent gets but answered through the Claude web bridge [7], the state of that answer (queued, typed, or failed), and, at the tail of the agent's log, a "Cloud session mirror" box streaming the session's turns as the extension reads them. Renders nothing for an agent of any other location.

## Context

**User story**: the user starts an agent on "Claude web". Its page cannot show a streamed feed, because the work runs on claude.ai; instead it says "Running as a Claude Code cloud session…", offers the command to continue the session locally and a link to open it, mirrors what the session says, and, when the session asks a question, shows it as a card the user answers without leaving the dashboard.

**Problem**: there is no read-back API for a cloud session; everything the dashboard learns about it comes from the extension's Driver tab, over the bridge, so it is polled from the daemon rather than streamed, and it is best-effort: nothing arrives while the claude.ai tab is closed.

## Glossary

[1] agent view: one agent's page.
[2] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[4] location: where an agent's turns run: `local` (this machine), `actions` (a GitHub Actions runner), or `web` (a Claude Code cloud session).
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[7] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session. The Driver tab is the extension's one pinned tab that reads claude.ai's session list, visits sessions and types answers.
[8] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[9] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface is a projection of it.

## Business logic — TL;DR

- **The notice row** - "Starting a Claude Code cloud session…" until the hand-off names the session, then "Running as a Claude Code cloud session…" with the `claude --teleport <session id>` command, a copy button and "Open the session".
- **The parked question as a gate card** - the question the bridge reports is shown as the "Your call" card, with "Answer it in the session" as the manual path; the pick is queued for the extension to type.
- **Where the answer stands** - a queued answer shows "Sending “…” through your Claude web tab…" with "Cancel"; a typed one "Answered “…”"; a failed one puts the card back with "Sending “…” failed…".
- **The cloud session mirror** - a labeled best-effort box of the session's turns, the user's side reduced to one line, claude.ai's own interface text scrubbed out, "Connecting to the cloud session…" while empty.
- **Polling the bridge** - question, answer and mirror are each asked of the daemon every four seconds; a daemon with the bridge off answers nothing, and a failed poll shows no banner.

## Business logic

### The notice row

#### Context

See `## Context`.

#### Business logic

For an agent [3] whose location [4] is `web`, a row with a cloud icon sits above the feed. Until the hand-off has named the cloud session [5] it reads "Starting a Claude Code cloud session…". Once the session is known it reads "Running as a Claude Code cloud session. It opens its own pull request over there; a question it parks on shows here once the bridge sees it." followed by the command `claude --teleport <session id>`, a copy button named "Copy the command that continues this session here", and the link "Open the session", which opens claude.ai in a new tab. The session's id and URL are read off the agent's event stream [9], from the driver's action that announces the hand-off; when the agent handed off more than once, the most recent session counts (the rule is in `lib/live-state.ts`).

### The parked question as a gate card

#### Context

**User story**: the cloud session [5] stops at "Which approach?"; the user sees the same "Your call" card as for a local agent, picks an option, and the extension types the answer into the session.

#### Business logic

When the daemon reports a question the session is parked on, and no answer for it is queued or typed (or the last answer failed), the question is rendered as a gate [6] card inline under the notice row: the same card as a local agent's, with the question's labels standing in as the option ids, since claude.ai has no ids and a label is what the extension can type back (the projection is in `src/dashboard/bridge-question.ts`); no automatic countdown is offered on it. A pick [8] made on the card is queued on the daemon for the extension, one label or a multi-select's set of labels; when the daemon refuses to queue it, the card shows the daemon's reason (or "could not queue the answer"). Under the card, the link "Answer it in the session" opens the session in a new tab for whoever prefers to answer over there.

### Where the answer stands

#### Context

**Problem**: an answer is typed by the extension the next time its Driver tab checks in, not the moment it is picked; the user needs to know whether it has gone out yet, and can withdraw it only while it has not.

#### Business logic

- Queued: a spinner and "Sending “<labels>” through your Claude web tab… It goes out the next time the extension checks in.", with a "Cancel" button that withdraws the answer from the daemon's queue. The labels are the picked labels joined by commas.
- Sent (typed into the session and submitted): a check and "Answered “<labels>”. The session continues over there and its transcript above follows along.", with an "Open the session" link.
- Failed: the gate [6] card returns, headed by a red line "Sending “<labels>” failed: <the bridge's note>. Pick again, or answer in the session." (without the colon and note when the bridge gave none).
- While an answer is queued or sent, the card is not shown.

### The cloud session mirror

#### Context

**Problem**: a web agent's own log dead-ends at the hand-off; without a mirror the page shows dead air. The mirror is a scrape of the claude.ai tab through the extension, not the agent's own record, so it must be visibly one box rather than ordinary log rows.

#### Business logic

At the tail of a `web` agent's log, once the session is known, a box captioned "Cloud session mirror" with the note "a best-effort view of the Claude tab, not the run's own log" lists the session's turns in order. A turn from the user is reduced to one line, "you › " followed by the turn's first non-empty line, with the whole turn as its tooltip: the opening turn is the agent's whole prompt, and what the session did is the point. A turn from the session is shown in full. Lines that are claude.ai's own interface text rather than conversation are dropped from every turn: a line starting "Arrow keys move the tile", the line "Show message actions", and a line that is only a bare model name such as "Claude Opus 4.1"; a turn left empty by that is not shown, and runs of blank lines are collapsed. While no turn has arrived the box shows a spinner with "Connecting to the cloud session…". The box keeps the newest turn in view as it grows.

### Polling the bridge

#### Context

**Problem**: the bridge writes to the daemon from a browser extension and never touches the agent's event stream [9], so there is no event for the live channel to carry.

#### Business logic

The parked question, the answer's state and the mirrored turns are each asked of the daemon as soon as the session [5] is known and every four seconds after, for as long as the page shows the agent. A daemon whose bridge is off answers with nothing, which shows nothing. A failed poll shows no banner: the last known state stays.
