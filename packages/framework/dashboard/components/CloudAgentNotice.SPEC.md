What the dashboard shows for an agent handed to a Claude Code cloud session: where the work went, the question it is parked on, and a mirror of the cloud session's conversation.

## User story

- The user starts an agent on the `web` run target and wants to know where the work actually is, rather than staring at an empty event log.
- The cloud session parks on a question; the user answers it from the dashboard, in the same way they answer any other agent's question, instead of switching to claude.ai.
- The user wants to keep an eye on what the cloud session is saying, even though this machine cannot stream it.

## Business logic — TL;DR

- **A hand-off is shown as a hand-off** - a `web` agent's page says the work runs in a cloud session and opens its own PR over there, while a question that session parks on shows here.
- **Two ways to reach the session** - a link that opens it on claude.ai, and a copyable command that continues it in the local terminal.
- **The parked question is answered like a local gate** - the same "Your call" panel a local agent's question gets, answered in one click, with the pick queued for the browser extension instead of written to a control channel no cloud session reads.
- **A queued answer can be withdrawn** - until the extension collects it; once typed and submitted, the panel says so.
- **A failed delivery hands the question back** - naming what failed and offering to pick again or answer in the session.
- **The mirror is one clearly-labelled box** - a best-effort view of the Claude tab, turn by turn, kept visibly separate from the agent's own event log, with claude.ai's interface text stripped out; the user's turns are one line each, the session's are shown whole, and the newest turn is kept in view.
- **Nothing at all for other run targets** - so an agent's page can carry these unconditionally.

## Glossary

- **mirror** - the text of the cloud session's conversation as scraped from the Claude tab by the browser extension. Best-effort: no tool calls, no timings, and nothing at all when the tab is closed.

## Business logic

### A hand-off is shown as a hand-off

#### User story

The user opens a `web` agent and sees no streamed output.

#### Business logic

The `web` run target is a hand-off, not a streamed agent: the work runs on Anthropic's infrastructure, makes its own worktree and opens its own pull request, and there is no way for this machine to follow it. So instead of an empty event log that looks stalled, the agent's page states that it runs as a Claude Code cloud session, that the session opens its pull request over there, and that a question it parks on shows up here once the bridge sees it. Before the cloud session exists, it says one is starting.

For every other run target, none of this is shown at all.

### Two ways to reach the session

#### User story

The user wants to look at the cloud session, or take it over locally.

#### Business logic

Once the cloud session is known, the notice offers a link that opens the session on claude.ai in a new tab, and a copyable command that continues that same session in the user's own terminal.

### The parked question is answered like a local gate

#### User story

The cloud session parks asking a question and the user answers it without leaving the dashboard — and without having to learn a second way of answering.

#### Business logic

When the Claude web bridge reports that the session is parked on a question, the notice renders it in the very same gate panel a local agent's question gets: the "Your call" heading, the question, its options with their detail text, the recommended one marked, and — when the session asked for several answers at once — tick boxes with an Accept button. Answering it takes the single click a local gate takes.

What differs is only where the answer goes. A local agent's pick is written to its control channel; this one is queued for the browser extension, which types it into the user's own claude.ai tab. A link to answer it in the session stays available for whoever prefers to do it over there. The automatic-acceptance countdown does not run here: the question is answered by the user or not at all.

The daemon is polled for the parked question rather than the question arriving on the agent's live stream: the bridge writes over HTTP from a browser extension and never touches the agent's event log, so there is no event to carry. A daemon with the bridge switched off simply reports no question, and a transport failure is not worth a banner.

### A queued answer can be withdrawn, and a failure hands the question back

#### User story

The user picks an answer and changes their mind before the extension has delivered it, or the delivery fails.

#### Business logic

An answer that has been accepted but not yet collected by the extension is reported as being sent through the user's Claude tab on the extension's next check-in, and can be cancelled — that window is the only time withdrawing it means anything. The question itself gives way to that report, so a second answer cannot race the first. Once the extension has typed and submitted it, the panel says which answer was given, notes that the session continues over there with the mirror following along, and links to the session.

A delivery that fails brings the question back, naming the answer that failed and any reason for it, and inviting the user to pick again or answer in the session. An answer the daemon refuses to queue at all — because that session is no longer parked on the question, say — is reported on the gate panel itself, in the daemon's own words, with the options left usable so the user can try again.

### The mirror is one clearly-labelled box

#### User story

The user wants to see what the cloud session is saying after the hand-off.

#### Business logic

A `web` agent's own event log dead-ends at the hand-off, so what happens afterwards is shown as one boxed row at the tail of the log, labelled "Cloud session mirror" and described as a best-effort view of the Claude tab rather than the agent's own log. Until the mirror has anything, it says it is connecting, so a `web` agent never shows dead air. The mirror is polled from the daemon on the same cadence as the parked question.

Each turn is its own block, in transcript order. The user's turns show as a single line — "you ›" followed by the turn's first line, the whole turn available on hover — because the opening turn is the run's entire prompt and what the session did is the point of the mirror, not what it was told. The session's turns are shown whole. The box keeps its newest turn in view, scrolling to the end whenever the last turn changes or grows, so a reply being written is watched rather than scrolled to.

Claude's own interface text that the scrape drags in — tile-navigation hints, per-message action labels, and a bare model name on its own line — is removed from every turn, and the gaps that leaves are collapsed. The removal is matched line by line and anchored, so a message that merely mentions a model is left untouched.

#### Rationale

The boundary is deliberate and visible: the agent's event log is durable, provenance-clean data, while the mirror is a best-effort tab scrape read through a browser extension. One clear box keeps the two from being confused.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
