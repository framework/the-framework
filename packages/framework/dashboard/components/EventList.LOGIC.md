Renders an agent's [1] transcript: every event [2] the agent emitted, one row each, in the order it happened — for a running agent, whose rows arrive live, and for a finished agent replayed from the archive [3] alike. Most rows read as the one-line text the terminal prints; the user's prompts, the agent's replies and open gates [4] get their own row treatment, so the transcript reads like a conversation whose interactions can be acted on where they happened.

## Context

**User story**: the user opens an agent's [1] page and reads what happened: what they asked, what the coding agent [5] read and edited, what it answered, the questions it stopped at, what it cost and how it ended. While the agent runs, the transcript follows the newest row; afterwards the same transcript is replayed from the archive [3].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] archive: an agent's events as read back once it is not running: its diary in its checkout while the checkout exists, else the copy the tool that runs it records on the data branch when the agent ends.
[4] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[7] live chat: the user's own messages to a running agent, each continuing the same driver session.
[8] pick: the answer to a gate: the option or options the user chose.
[9] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[10] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **One row per event, as the terminal's line** - every event [2] is one row: a kind badge, the terminal's one-line text for that event, and on live rows the arrival time.
- **The conversation reads as messages** - the user's prompt and the agent's reply render as Markdown, clamped to one line beyond 100 characters and expanding in place on click.
- **The first prompt opens the transcript** - the first prompt is hoisted above the rows emitted before it, so the transcript starts with what the user asked.
- **A gate is answered where it happened** - when the transcript knows its project, an open gate [4] renders as the interactive gate panel inline; a gate the agent went on past, or whose agent ended unanswered, stays text.
- **Badges once per group, colored as a scanning aid** - the kind badge shows on the first of consecutive rows of one group, "YOU" for the user's prompt; only failures, the user's turn, gates and a clean end get a color.
- **Failures read red, the user's turn blue** - a failed row is red on a red wash, the user's prompt blue on a blue wash, a clean finish on a green wash; a stopped agent, and one waiting on the question it ended on, stay neutral.
- **Arrival times only when live** - a row that arrived live shows its arrival time at each group boundary; replayed rows show none.
- **Following the newest row** - a live transcript keeps the newest row in view until the reader scrolls up and offers "Jump to latest"; a replay opens at its end or its start as the caller decides.

## Business logic

### One row per event, as the terminal's line

#### Context

See `## Context`.

#### Business logic

Each event [2] is one row with three columns: a fixed-width badge column, the row's body, and, on live rows that open a group (see "Badges once per group, colored as a scanning aid"), the arrival time. Unless a rule below gives the event a special body, the body is the one-line text the terminal prints for the same event (the wording rules live in `src/terminal.ts`), with its leading indentation trimmed. For example: the coding agent's [5] actions read as "· <action>" lines, a finished turn [6] as "‹ turn complete", the agent's end as "✓ finished", "■ stopped", "? waiting for an answer" or "✗ failed: <detail>", and the spend as "spend: $<cost> over N turns". The transcript is monospaced, except for the interactive rows described below, which use the dashboard's regular typeface because they are controls rather than text.

### The conversation reads as messages

#### Context

**User story**: the user reads the transcript as a conversation: their own prompt, the agent's reply, their next message. Both sides write Markdown, and both are often long.

#### Business logic

Two events carry conversation text: the prompt that opens a turn [6] (the user's prompt, or a live chat [7] message) and the agent's reply. Both render as compact Markdown (the rendering rules in `Markdown.tsx`) instead of the terminal's truncated line. A message whose text, with runs of whitespace collapsed to one space, is at most 100 characters renders whole. A longer message is clamped to its first line with a chevron ("›") in front of it; clicking either the chevron or the clamped text expands the same rendered Markdown in place, so the opening is never shown twice, and the chevron turns to point down and folds it back on click. The chevron's accessible name is "Expand message" while folded and "Collapse message" while expanded.

### The first prompt opens the transcript

#### Context

**Problem**: rows can be emitted before the first prompt (the session line), so the one line the user wrote would not open the transcript.

#### Business logic

The first prompt row is moved to the top of the transcript, above the rows emitted before it; those rows keep their order after it. Only the first prompt moves: a later prompt is part of the conversation and stays where it happened. When the first prompt is already the first row, or there is no prompt, nothing moves.

### A gate is answered where it happened

#### Context

**User story**: the agent's turn ends on a gate [4] and the agent ends waiting on it; the user reads the question in the flow of the transcript and answers it there.

**Problem**: a pick [8] can only be resolved when the transcript knows which project and agent the gate belongs to; a transcript rendered without that knowledge must not show a control that answers nothing.

#### Business logic

Gate rows get special treatment only when the transcript knows its project. For every gate id, only its last firing is special: an earlier firing of the same id is history and keeps its text (the terminal's "? <title>" line followed by the options). The last firing renders as follows:

- The gate is open (the rule in `lib/live-state.ts`): the agent has not gone on since it asked, and it has not ended for good — an agent that ended WAITING on the gate keeps it open, since the answer resumes it: the row is the same interactive gate panel the right rail shows (`ChoicePanel.tsx`), inline, and the newest open gate is the active one.
- The agent went on past the gate, or ended for good (done, stopped, failed) without it being answered: the row stays plain text, so nobody sees an answerable control whose question is over.

Without a project, every gate row keeps its text.

### Badges once per group, colored as a scanning aid

#### Context

**Problem**: one turn of the coding agent [5] can be 200 rows of the same kind; repeating the badge on every row makes the transcript unreadable, and coloring every badge makes none stand out.

#### Business logic

Consecutive rows of the same group share one badge, shown on the group's first row. The group is the event's kind, except that the user's prompt forms its own group apart from the rest of the coding agent's events, so each of the user's turns opens a new group. The badge word is "you" for the prompt, and otherwise the kind's plain-language label (the label rules in `lib/event-labels.ts`: "agent" for the coding agent's own events, "cost" for a usage report, "resume" for a session id update, and every other kind's own name); the badge is shown uppercased. The badge column has a fixed width, so the body column aligns whether or not the row shows a badge.

The badge's color is a navigation aid: a failing row's badge is red and the user's prompt's badge is blue (those two win over everything below); a gate [4] is amber, the row the reader most wants to find; a clean end is green, as the milestone; every other badge is muted. A stopped or failed end is not a milestone and stays out of green.

### Failures read red, the user's turn blue

#### Context

See `## Context`.

#### Business logic

A row reports a failure when it is the coding agent [5] (or its transport) erroring mid-run, or an end that is neither successful nor a stop. A failing row's text is red and its whole line is washed with a faint red tint, findable from the scrollbar's distance. The user's prompt is blue on a faint blue wash. A clean end keeps its text tone on a faint green wash. A stopped agent's end is neither a failure nor a milestone: it keeps the neutral tone, since the user asked for the stop. Every other row keeps the muted transcript tone with no wash.

### Arrival times only when live

#### Context

**Problem**: an event [2] carries no timestamp; the dashboard stamps each one as it arrives (the rule in `lib/event-times.ts`), and a replayed event was never live, so it must show no time rather than a wrong one.

#### Business logic

A row that opens a group and arrived live shows its arrival time, as hours, minutes and seconds in the reader's locale, at the right edge, with the full date and time in a tooltip. Rows replayed from the archive [3] show no time.

### Following the newest row

#### Context

See `## Context`.

#### Business logic

By default the transcript follows its newest row: as rows arrive the view stays at the bottom, until the reader scrolls up, at which point following yields to the reader. A "Jump to latest" button returns to the newest row; it is inert when there is nothing to scroll. A transcript told not to follow opens at its start, or at its end when the caller asks for the outcome first, which is how a replay opens. Each prompt row is the anchor the scroller keeps in view, so the current turn [6] stays put while its rows arrive. An optional trailing block supplied by the caller (the agent's page pins the row mirroring a hands-off [9] agent's cloud session [10] there) renders after the last row inside the scroller, so it scrolls and sticks with the transcript rather than floating over it.
