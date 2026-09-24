Renders an agent's [1] transcript: every event [2] the agent emitted, one row each, in the order it happened — for a running agent, whose rows arrive live, and for a finished agent replayed from the archive [3] alike. Most rows read as the one-line text the terminal prints; the user's prompts and the agent's replies, gates [4] and live screens [15] get their own row treatment, so the transcript reads like a conversation whose interactions can be acted on where they happened.

## Context

**User story**: the user opens an agent's [1] page and reads what happened: what they asked, what the coding agent [5] read and edited, what it answered, the questions it stopped at, what it cost and how it ended. While the agent runs, the transcript follows the newest row; afterwards the same transcript is replayed from the archive [3].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[4] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[6] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[7] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[8] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[9] live chat: the user's own messages to a running agent, each continuing the same driver session.
[10] pick: the answer to a gate: the option or options the user chose.
[11] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[12] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[13] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[14] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[15] screen: a live page on this machine that something the agent ran is showing, such as its browser, announced by a `screen` line the command appended to the agent's diary: the page's address, a label naming what it showed then, and, on the line that says it has gone, `ended`.

## Business logic — TL;DR

- **One row per event, as the terminal's line** - every event [2] is one row: a kind badge, the terminal's one-line text for that event, and, on a row that opens a group, the time its diary line was written.
- **The conversation reads as messages** - the user's prompt and the agent's reply render as Markdown, clamped to one line beyond 100 characters and expanding in place on click.
- **The first prompt opens the transcript** - the first prompt is hoisted above the rows emitted before it, so the transcript starts with what the user asked.
- **A gate is answered where it happened** - when the transcript knows its project, an open gate [4] renders as the interactive gate panel inline, an answered one as a collapsed card that replaces its "✓ chose" line, and a gate whose agent ended unanswered stays text.
- **A screen is live where the agent used it** - the newest `screen` line at an address, on this machine's loopback and with neither an `ended` line for that address nor the agent's end after it (an end waiting on an answer does not count), is the live page itself, framed in the transcript; an earlier or ended one stays its one line, and every `ended` line is hidden.
- **Badges once per group, colored as a scanning aid** - the kind badge shows on the first of consecutive rows of one group, "YOU" for the user's prompt; only failures, the user's turn, gates, milestones and pushed surfaces get a color.
- **Failures read red, the user's turn blue** - a failed row is red on a red wash, the user's prompt blue on a blue wash, a clean finish and the ready-for-merge [6] signal on a green wash; a stopped agent stays neutral.
- **The time each line was written** - a row that opens a group shows the time its diary line was written, the same live, after a reload and once the agent has ended; a line with no time shows none.
- **Following the newest row** - a live transcript keeps the newest row in view until the reader scrolls up and offers "Jump to latest"; a replay opens at its end or its start as the caller decides.

## Business logic

### One row per event, as the terminal's line

#### Context

See `## Context`.

#### Business logic

Each event [2] is one row with three columns: a fixed-width badge column, the row's body, and, on rows that open a group (see "Badges once per group, colored as a scanning aid"), the time the event's diary line was written. Unless a rule below gives the event a special body, the body is the one-line text the terminal prints for the same event (the wording rules live in `src/terminal.ts`), with its leading indentation trimmed. For example: the coding agent's [5] actions read as "· <action>" lines, a finished turn [7] as "‹ turn complete", the agent's end as "✓ finished", "■ stopped" or "✗ failed: <detail>", the spend as "spend: $<cost> over N turns", and the agent settling [8] as "◆ done for now — waiting for your next message". An error the agent reported itself keeps its headline and its detail lines. The transcript is monospaced, except for the interactive rows described below, which use the dashboard's regular typeface because they are controls rather than text.

### The conversation reads as messages

#### Context

**User story**: the user reads the transcript as a conversation: their own prompt, the agent's reply, their next message. Both sides write Markdown, and both are often long.

#### Business logic

Two events carry conversation text: the prompt that opens a turn [7] (the user's prompt, or a live chat [9] message) and the agent's reply. Both render as compact Markdown (the rendering rules in `Markdown.tsx`) instead of the terminal's truncated line. A message whose text, with runs of whitespace collapsed to one space, is at most 100 characters renders whole. A longer message is clamped to its first line with a chevron ("›") in front of it; clicking either the chevron or the clamped text expands the same rendered Markdown in place, so the opening is never shown twice, and the chevron turns to point down and folds it back on click. The chevron's accessible name is "Expand message" while folded and "Collapse message" while expanded.

### The first prompt opens the transcript

#### Context

**Problem**: the agent emits its session line before the first prompt, so the one line the user wrote would open under a row they did not write.

#### Business logic

The first prompt row is moved to the top of the transcript, above the rows emitted before it; those rows keep their order after it. Only the first prompt moves: a later prompt is part of the conversation and stays where it happened. When the first prompt is already the first row, or there is no prompt, nothing moves.

### A gate is answered where it happened

#### Context

**User story**: the agent's turn ends on a gate [4] and the agent ends waiting on it; the user reads the question in the flow of the transcript, answers it there, and later sees what was chosen in place of the question.

**Problem**: a pick [10] can only be resolved when the transcript knows which project and agent the gate belongs to; a transcript rendered without that knowledge must not show a control that answers nothing.

#### Business logic

Gate rows get special treatment only when the transcript knows its project. For every gate id, only its last firing is special: an earlier firing of the same id is history and keeps its text (the terminal's "? <title>" line followed by the options), and the "✓ chose …" line that answered it stays, as the only record of a superseded decision. The last firing renders as follows:

- The gate is open (the rule in `lib/live-state.ts`): the agent has not gone on since it asked, and it has not ended for good — an agent that ended WAITING on the gate keeps it open, since the answer resumes it: the row is the same interactive gate panel the right rail shows (`ChoicePanel.tsx`), inline, and the newest open gate is the active one.
- A pick answered the gate after this firing: the row collapses to the answered card (`AnsweredChoice.tsx`) showing the pick, and the "✓ chose …" line that reported the pick is hidden because the card says it.
- The agent ended for good (done, stopped, failed) without the gate being answered, or went on past it with no recorded pick: the row stays plain text, so nobody sees an answerable control whose agent is gone. A pick recorded before this firing belongs to an earlier firing and does not count as this one's answer.

Without a project, every gate row keeps its text.

### A screen is live where the agent used it

#### Context

**User story**: the agent opens its browser on the app it changed; the person watching the agent sees that browser live in the transcript, at the row where the agent opened it, and can click and type in it too. Once the agent closes it, or the agent ends, the row goes back to a line saying what it showed.

**Problem**: a `screen` line is written by whatever command the agent ran, not by the tool that runs the agent, so its address cannot be trusted to be a harmless page.

#### Business logic

Every `screen` line of the transcript is sorted, in order, by address. A line with `ended` is hidden and makes every earlier line at its address not live; a line without it becomes its address's newest line. A newest line is live when it comes after the agent's last end (any `end` event in the transcript but one waiting on an answer: the page stays live for the question it is about) and its address is `http` on `127.0.0.1`, `localhost` or `[::1]`. A live row's body is the page at that address, framed in the transcript (`InlineScreen.tsx`); every other `screen` row reads as the terminal's line, "◆ <label>". So a browser the agent opened three times keeps one live frame, at its latest opening, and its two earlier openings read as their lines; closing it hides the `ended` line and turns the last opening back into its line; an address anywhere else is never framed. This applies whether or not the transcript knows its project.

### Badges once per group, colored as a scanning aid

#### Context

**Problem**: one turn of the coding agent [5] can be 200 rows of the same kind; repeating the badge on every row makes the transcript unreadable, and coloring every badge makes none stand out.

#### Business logic

Consecutive rows of the same group share one badge, shown on the group's first row. The group is the event's kind, except that the user's prompt forms its own group apart from the rest of the coding agent's events, so each of the user's turns opens a new group. The badge word is "you" for the prompt, and otherwise the kind's plain-language label (the label rules in `lib/event-labels.ts`: "agent" for the coding agent's own events, "waiting" for the agent settling [8], "cost" for a usage report, "resume" for a session id update, and every other kind's name with hyphens turned to spaces, such as "ready for merge"); the badge is shown uppercased. The badge column is wide enough for "ready for merge" on one line, and the body column aligns whether or not the row shows a badge.

The badge's color is a navigation aid: a failing row's badge is red and the user's prompt's badge is blue (those two win over everything below); a gate [4] and its resolution are amber, the rows the reader most wants to find; a clean end and the ready-for-merge [6] signal are green, as milestones; a pushed surface (a view [11] or a screen [15]) takes the dashboard's primary accent, as the agent showing the user something; every other badge is muted. A stopped or failed end is not a milestone and stays out of green, and the handoff [12] report stays muted because its body may report mixed outcomes.

### Failures read red, the user's turn blue

#### Context

See `## Context`.

#### Business logic

A row reports a failure when it is the coding agent [5] (or its transport) erroring mid-run, an error the agent reported itself, or an end that is neither successful nor a stop. A failing row's text is red and its whole line is washed with a faint red tint, findable from the scrollbar's distance. The user's prompt is blue on a faint blue wash. A clean end and the ready-for-merge [6] signal keep their text tone on a faint green wash. A stopped agent's end is neither a failure nor a milestone: it keeps the neutral tone, since the user asked for the stop. Every other row keeps the muted transcript tone with no wash.

### The time each line was written

#### Context

**User story**: the user reads when each thing happened, and reads the same times while the agent runs, after reloading the page, and once the agent has ended or is waiting on an answer.

#### Business logic

An event [2] read from a diary line that says when it was written carries that time (`src/store/run-record.ts`). A row that opens a group and whose event carries a time shows it, as hours, minutes and seconds in the reader's locale, at the right edge, with the full date and time in a tooltip. A row whose event carries no time, such as one read from a line written before the diary kept times, shows no time.

### Following the newest row

#### Context

See `## Context`.

#### Business logic

By default the transcript follows its newest row: as rows arrive the view stays at the bottom, until the reader scrolls up, at which point following yields to the reader. A "Jump to latest" button returns to the newest row; it is inert when there is nothing to scroll. A transcript told not to follow opens at its start, or at its end when the caller asks for the outcome first, which is how a replay opens. Each prompt row is the anchor the scroller keeps in view, so the current turn [7] stays put while its rows arrive. An optional trailing block supplied by the caller (the agent's page pins the row mirroring a hands-off [13] agent's cloud session [14] there) renders after the last row inside the scroller, so it scrolls and sticks with the transcript rather than floating over it.
