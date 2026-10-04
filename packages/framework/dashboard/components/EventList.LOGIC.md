Renders an agent's [1] transcript: the events [2] the agent emitted, one row each, in the order they happened, except those the page already says elsewhere or that no longer hold (a turn's end, the spend so far, an end the agent went on after) — for a running agent, whose rows arrive live, and for a finished agent replayed from the archive [3] alike. Most rows read as the one-line text the terminal prints; the user's prompts and the agent's replies, gates [4], live screens [15] and the agent's subagents [16] get their own row treatment, so the transcript reads like a conversation whose interactions can be acted on where they happened.

## Context

**User story**: the user opens an agent's [1] page and reads what happened: what they asked, what the coding agent [5] read and edited, what it answered, the questions it stopped at and how it ended. While the agent runs, the transcript follows the newest row; afterwards the same transcript is replayed from the archive [3].

## Glossary

[1] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps.
[2] event / event stream: everything an agent does, in order, read off the agent's diary: the file its tool writes one line at a time, in the agent's checkout while it has one and on the data branch once it is recorded; every surface is a projection of it.
[3] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[4] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[5] coding agent: the CLI doing the actual work: Claude Code or Codex.
[7] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[8] settled: said of an agent whose work has stopped and which is waiting for the user: it is alive, takes messages, and does nothing until told.
[9] live chat: the user's own messages to a running agent, each continuing the same driver session.
[10] pick: the answer to a gate: the option or options the user chose.
[11] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[12] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[13] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[14] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[15] screen: a live page on this machine that something the agent ran is showing, such as its browser, announced by a `screen` line the command appended to the agent's diary: the page's address, a label naming what it showed then, and, on the line that says it has gone, `ended`.
[16] subagent: an agent [1] started for another agent, its main agent, which split its task across subagents (the `orchestration` skill). The subagent's card names the main agent's id as its parent.

## Business logic — TL;DR

- **One row per event, as the terminal's line** - every event [2] is one row in one centered column: the terminal's one-line text for that event, with no label saying its kind.
- **The conversation reads as messages** - the user's prompt and the agent's reply render as Markdown in the page's own font; the reply whole; the user's prompt as a grey box on the right with no label, cut short behind "Show more" when long, its time shown under it while the pointer is on it.
- **The message just sent** - a message sent to an ended agent is one more grey box after the last row, a prompt like any other, so the scroller brings it into view; the prompt line of the continuation takes the same row when it arrives.
- **A moving line while the agent works** - while the agent works and writes nothing, the last row is a moving line: the tool call going on now ("Running pnpm test 9s"), else "Starting…" when nothing has come since the prompt and "Working…" otherwise, with the seconds since the last event; it gives way to the message being written, and goes when the agent ends.
- **The message being written grows in place** - while the agent writes a message, it is one more agent row after the last, drawn as a finished reply is; when the whole message arrives, its own row replaces it and nothing moves.
- **A turn's end and the spend are not rows** - the end of each turn [7] and the spend so far are left out: the agent's details strip counts the turns and totals the spend.
- **An end the agent went on after is not a row** - a clean end, or an end waiting on an answer, that a later prompt follows is left out, and so is the last clean end while the caller says the agent's job is still going; a failed or stopped end stays where it happened.
- **The question's block is not shown** - the JSON block an agent writes to ask is left out of the reply a gate [4] follows, and out of the message being written: the gate's card is the question.
- **The session id is not a row** - the coding agent's session id update is plumbing, not conversation: it is left out of the list, and the run's menu reads it from the events.
- **The quota only when it matters** - the coding agent reports the account's quota after every turn; a reading that is `allowed` is left out of the list, and one running low or used up is a row.
- **The agent's steps are one folded line** - a run of tool calls and thoughts with no other row between them is one row, a folded line counting the calls; a thought is no row, and thoughts with no call among them show nowhere.
- **The session line under the first prompt** - when the caller says what was set up for the agent, a folded "Session set up" line sits right under the first prompt, or first when the transcript has no prompt.
- **The first prompt opens the transcript** - the first prompt is hoisted above the rows emitted before it, so the transcript starts with what the user asked.
- **A gate is answered where it happened** - when the transcript knows its project, an open gate [4] renders as the interactive gate panel inline, an answered one as a collapsed card that replaces its "✓ chose" line, and a gate whose agent ended unanswered stays text.
- **A screen is live where the agent used it** - the newest `screen` line at an address, on this machine's loopback and with neither an `ended` line for that address nor the agent's end after it (an end waiting on an answer does not count), is the live page itself, framed in the transcript; an earlier or ended one stays its one line, and every `ended` line is hidden.
- **A subagent has a row where it was started** - when the transcript is given the agent's subagents [16], each has a row before the first row written after it started: its task, then what it is doing now or how it ended, read off the subagent's card so the row changes in place.
- **A subagent's end is not the user's prompt** - the prompt that told the agent one of its subagents ended is a row about the subagent saying `ended <status>`, with the rest of the message folded under it, not a grey box of the user's.
- **No labels, a few colors** - no row wears a label saying its kind; a failed row is red on a red wash and a clean finish sits on a green wash.
- **The time each line was written** - the first of a run of same-kind rows holds the time its diary line was written, shown while the pointer is on the row, the same live, after a reload and once the agent has ended; a line with no time holds none.
- **Following the newest row** - a live transcript keeps the newest row in view until the reader scrolls up and offers "Jump to latest"; a replay opens at its end or its start as the caller decides.
- **The view never jumps back when the agent goes on** - only the newest prompt is the scroller's anchor, a row keeps its identity when another row stops being shown, and an end that is no longer a row keeps an empty place where it was.

## Business logic

### One row per event, as the terminal's line

#### Context

See `## Context`.

#### Business logic

Each event [2] but the user's own prompt (see "The conversation reads as messages") is one row: its body and, at the right edge of the first of a run of same-kind rows, the time the event's diary line was written (see "The time each line was written"). No row has a label saying its kind: the user's message is a box on the right, and every other row's text says what it is. The rows sit one under the other in a single column, at most 48rem wide, centered in the transcript's pane, as a chat's do; the message box under the transcript (`AgentComposer.tsx`) and the subagents line above it (`SubagentLine.tsx`) are centered at the same width, so the three share their left and right edges. Unless a rule below gives the event a special body, the body is the one-line text the terminal prints for the same event (the wording rules live in `src/terminal.ts`), with its leading indentation trimmed. For example: the agent's end reads as "✓ finished", "■ stopped", "? waiting for an answer" or "✗ failed: <detail>", and the agent settling [8] as "◆ done for now — waiting for your next message". An error the agent reported itself keeps its headline and its detail lines. The transcript is monospaced, except for the interactive rows described below, which use the dashboard's regular typeface because they are controls rather than text.

### The conversation reads as messages

#### Context

**User story**: the user reads the transcript as a conversation: their own prompt, the agent's reply, their next message. Both sides write Markdown, and both are often long.

#### Business logic

Two events carry conversation text: the prompt that opens a turn [7] (the user's prompt, or a live chat [9] message) and the agent's reply. Both render as Markdown (the rendering rules in `Markdown.tsx`) instead of the terminal's truncated line.

The agent's reply renders whole, however long, at the page's reading size and in the page's own font rather than the transcript's monospace: it is what the user came to read. The message being written is drawn exactly the same way, so when the finished reply takes its place nothing moves; a reply used to grow tall while written and fold to one line the moment it was done, and everything under it jumped up.

The user's own prompt is drawn as a chat message: a grey box with round corners at the right edge of the transcript, at most 85% of its width, holding the prompt as Markdown at the page's reading size and in the page's own font. The row has no label, no color and no time at its edge: the box and its place say whose message it is. Its accessible name is "Your message".

- **A long prompt is cut short.** A prompt of more than 600 characters, or of more than 8 lines, shows only its beginning (the box is cut at a fixed height), with a "Show more" button inside the box under the text. The button opens the whole prompt and then reads "Show less", which cuts it short again. A shorter prompt renders whole with no button.
- **The time shows on hover.** Under the box, at its right, one small line holds the time the prompt's diary line was written (hours, minutes and seconds in the reader's locale; the full date and time as its tooltip). The line is invisible until the pointer is on the message, and it is always there, also for a prompt that has no time: nothing moves when the time shows or arrives.

A prompt that is the end of a subagent [16] is not the user's and is not drawn this way (see "A subagent's end is not the user's prompt").

### A turn's end and the spend are not rows

#### Context

**Problem**: every turn [7] closed with a "‹ turn complete" row and a "COST" row reading "spend: $…". The agent's details strip (`AgentDetails.tsx`) already counts the turns and totals the spend, so the transcript said it again after every turn.

#### Business logic

The event that ends a turn (the turn's final answer) and the event that reports the spend are never rows, for any agent. The other left-out events are described in "The session id is not a row", "The quota only when it matters" and the next section.

### An end the agent went on after is not a row

#### Context

**Problem**: an agent that is continued (by the user's next message, by an answer, or, for a main agent, by the message saying one of its subagents [16] ended) has one end event per leg. The transcript read "✓ finished" between two turns, and "? waiting for an answer" above the answer. And a main agent ends its turn clean while its subagents still work: "✓ finished" stood over work still going.

#### Business logic

Reading the events in order, an end is not a row when:

- it is clean, or it is waiting on an answer, and a prompt comes after it before any other end: the agent went on. An end waiting on an answer that no prompt follows is a row, whatever the caller says about the agent's job;
- it is the last end, it is clean or waiting on an answer, and the user has just sent a message that the transcript shows ahead of its own prompt line: that message is the prompt on its way, so the end above it goes at once rather than a few seconds later;
- it is the last end, it is clean, no prompt follows it, and the caller says the agent's job is still going (the agent view says so while a subagent holds the job, `AgentView.tsx`).

A failed or stopped end is always a row, where it happened: it says why the next prompt was needed. What is written after the last end without a new prompt (a line recorded after the agent ended) leaves that end the agent's end, and a row. So an agent's transcript says "✓ finished" at most once per stretch of clean legs, at the end, and only once nothing more is coming.

### The question's block is not shown

#### Context

**User story**: the agent asks "What color do you prefer?" with four options. The user reads the question once, as a card with four buttons.

**Problem**: an agent asks by ending its reply with a fenced block tagged `await-choices` that holds the question as JSON. The transcript shows replies as written, so the user saw the raw JSON and then the card saying the same thing.

#### Business logic

- The reply a gate [4] follows is shown without its `await-choices` blocks. In each turn [7], that is the agent's last reply before the gate: a gate in a later turn is not about a reply of the turn before, and a reply earlier in the same turn than the last one is not it either. What the agent wrote around the block stays.
- When nothing is left, the reply was only the block, and it is no row at all: the gate's card stands alone.
- A reply no gate follows keeps its block as written. A block that did not parse makes no gate, and the raw block is how the user sees that the agent tried to ask.
- The message being written is shown without the block too, from the block's opening fence on while its closing fence has not arrived. While nothing else is written, the "working" line shows instead.

### The agent's steps are one folded line

#### Context

**User story**: between the user's question and the agent's answer, the user reads one short grey line saying what the coding agent [5] did, as Claude Code on the web draws it, and opens it for the details. The user sees no thinking row, as on Claude Code on the web.

**Problem**: every tool call was a row ("· Bash  pnpm test") and every thought a "💭 Thinking" row, so a turn [7] of fifty calls was fifty rows.

#### Business logic

A step is an event that is a tool call of the coding agent, or a thought of it. Among the events that are rows, each run of steps with no other row between them is one row, drawn by `ToolCalls.tsx`: one folded line counting the calls ("Ran 2 commands"), or the call itself when the run is one call ("Read AGENTS.md"); opened, one line per step. A message of the agent, a prompt, a gate [4] or any other row ends the run, so an agent that writes between its calls has a line of calls, its message, then another line of calls.

- **The row is the run's first step.** Its identity is that of the run's first event, so the row stays the same row while the agent adds calls to it, and its text changes in place ("Ran 1 command" becomes "Ran 2 commands").
- **A thought is no row.** Inside a run that holds a call, the thought is reachable in the opened line, at its place. A run with no call in it (the coding agent thought, then wrote) is no row at all.
- **The call going on now is not in its run yet.** While the agent works and writes no message, a tool call that is the last event of the transcript is the call going on now: the coding agent reports a call when it begins, and nothing has come since. It is left out of its run and is the transcript's last line instead, drawn moving (`ToolCalls.tsx`, "The line going on now"), counting the seconds since its event was written. When the next event arrives, the call joins its run ("Ran 1 command" becomes "Ran 2 commands", or a run line appears for a first call). When the agent is not working, or is writing its message, the last call is in its run like any other.
- **Between calls the last line is a word.** While the agent works and writes no message, and the last event is not a tool call, the last line is "Starting…" when the last event is a prompt and "Working…" otherwise (a thought that is no row counts: the line then reads "Working…"), drawn moving the same way, counting the seconds since the last event was written.
- **A subagent's row comes after the run.** A subagent [16] started by a call in the middle of a run has its row under the run's line, not inside it (the place rule of "A subagent has a row where it was started", read off the run's first step).

### The session line under the first prompt

#### Context

**User story**: under their first message, the user reads one grey line saying the session was set up, and opens it to see the agent's checkout, its branch and the coding agent [5] that was started (`SessionLine.tsx`).

#### Business logic

The caller may hand the transcript what was set up for the agent (the agent view reads it off the agent's card, `AgentView.tsx`). With it, the transcript has one more row that is not an event [2], drawn by `SessionLine.tsx`: right under the first row when that row is a prompt (the first prompt opens the transcript, next section), and above every row otherwise. It has its own identity, so no other row's identity changes when it comes. It has no time. Without it, or while what was set up says nothing yet, there is no such row.

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

### A subagent has a row where it was started

#### Context

**User story**: the user asked one agent for work it split across subagents [16] (the `orchestration` skill). Reading that agent's transcript, the user sees each subagent at the place the agent started it, with what the subagent is doing at this moment, and later how it ended and how long it took, and opens the subagent's own page from there.

**Problem**: the main agent ends its turn after starting its subagents, and its diary holds only the commands that started them; the transcript said nothing about them while they worked.

#### Business logic

The caller may hand the transcript the agent's subagents, what each working one is doing now, and how to open another agent's page. Without subagents, nothing below applies.

Each subagent has one row that is not an event [2]. Its place is before the first shown row whose event was written after the subagent started, and after the last row when none was (the rule in `lib/subagents.ts`, which takes the moment the subagent's id was made from, so the row never moves); subagents with the same place follow each other, oldest first. The row holds:

- the subagent's line (`SubagentLine.tsx`), read off the subagent's card as the caller last read it: its task, which opens the subagent's page on a click; then, while it works, "running" and what it is doing now; once it has ended, its status and how long it took. The row is the same row for the subagent's whole life and changes in place;
- at the right edge, the moment the subagent started, in the same format as a row's time, shown while the pointer is on the row, with the full date and time in a tooltip.

The row after a subagent's row opens a new run of rows: it holds its own time again, even when the row before the subagent's was of its kind. The one exception is a subagent's end right under a subagent's row, which goes on that run and holds no time of its own.

### A subagent's end is not the user's prompt

#### Context

**Problem**: when a subagent [16] ends, the tool that runs agents tells its main agent with a message, which reaches the transcript as a prompt, the same kind of event as the user's own messages. It read as the user's own message, as if the user had typed "The run 2026-10-01T10-01-00-000Z, started for this run, ended done.".

#### Business logic

A prompt that is the end of one of the agent's subagents (the rule in `lib/subagents.ts`: its first line is the line the tool sends, and the agent it names is one of the subagents the transcript was given) is a row about the subagent:

- it forms a run of rows apart from the user's prompts: a subagent's end right after a prompt of the user's holds its own time, and consecutive ends, or an end right under the row of a subagent just started, share one;
- it is not a grey box on the right: it is a row like the agent's;
- its body is the subagent's line for an end (`SubagentLine.tsx`): the subagent's task, which opens the subagent's page on a click, then `ended <status>` and the reason when the message gives one. It says how the subagent ended at that moment and never changes, whatever the subagent does afterwards;
- under it, the rest of the message (where the subagent's work is, its last words) renders as compact Markdown in the transcript's font. A rest whose text, with runs of whitespace collapsed to one space, is at most 100 characters renders whole. A longer one is clamped to its first line with a chevron ("›") in front of it; clicking either the chevron or the clamped text expands the same rendered Markdown in place, and the chevron turns to point down and folds it back on click. The chevron's accessible name is "Expand message" while folded and "Collapse message" while expanded. The line the tool sent is not shown as text.

The same words in a prompt about an agent that is not one of these subagents, or with other words before them, stay the user's own message. The row is still a prompt for everything else: while it is the newest prompt it is the anchor the scroller brings into view, and a spinner under it reads "Starting…".

### No labels, a few colors

#### Context

**User story**: the transcript reads as a chat, as Claude Code on the web draws one: no column of labels ("AGENT", "END", "CHOICE") beside the rows. The user still finds a failure and the agent's clean finish at a glance.

#### Business logic

No row wears a label saying its kind. A row reports a failure when it is the coding agent [5] (or its transport) erroring mid-run, an error the agent reported itself, or an end that is neither successful, nor a stop, nor waiting on an answer. A failing row's text is red and its whole line is washed with a faint red tint, findable from the scrollbar's distance. A clean end keeps its text tone on a faint green wash. A stopped agent's end is neither a failure nor a milestone: it keeps the neutral tone, since the user asked for the stop. Every other row keeps the transcript's tone with no wash.

### The time each line was written

#### Context

**User story**: the user reads when each thing happened, and reads the same times while the agent runs, after reloading the page, and once the agent has ended or is waiting on an answer.

#### Business logic

An event [2] read from a diary line that says when it was written carries that time (`src/store/run-record.ts`). Consecutive rows of the same kind form a run. The kind is the event's kind, except that the user's prompt is a kind apart from the rest of the coding agent's events, and that a prompt that is a subagent's [16] end is a third (see "A subagent's end is not the user's prompt"). The first row of a run whose event carries a time holds it (the user's own prompt holds its time under its box instead, see "The conversation reads as messages"), as hours, minutes and seconds in the reader's locale, at the right edge, with the full date and time in a tooltip. The time is invisible until the pointer is on the row, and its place is always kept, so nothing moves when it shows. A row whose event carries no time, such as one read from a line written before the diary kept times, holds no time.

### Following the newest row

#### Context

See `## Context`.

#### Business logic

By default the transcript follows its newest row: as rows arrive the view stays at the bottom, until the reader scrolls up, at which point following yields to the reader. A "Jump to latest" button returns to the newest row; it is inert when there is nothing to scroll. A transcript told not to follow opens at its start, or at its end when the caller asks for the outcome first, which is how a replay opens. The newest prompt row is the anchor the scroller brings into view, so the current turn [7] stays put while its rows arrive (see "The view never jumps back when the agent goes on"). An optional trailing block supplied by the caller (the agent's page pins the row mirroring a hands-off [13] agent's cloud session [14] there) renders after the last row inside the scroller, so it scrolls and sticks with the transcript rather than floating over it.

### The view never jumps back when the agent goes on

#### Context

**User story**: the user reads a main agent's transcript, several turns long, while one of its subagents [16] ends and the main agent is continued. The view stays where the user is reading, and the new turn's prompt is brought into view.

**Problem**: the view jumped to the very top of the transcript at that moment. The scroller (`ui/message-scroller.tsx`) brings a row marked as an anchor to the top once, and looks for anchors it has not brought into view yet whenever one row takes another's place, starting with the oldest. Three things in the transcript set that off: every prompt was an anchor, so a transcript opened with several turns in it held anchors never brought into view, and went to its first prompt as soon as any row was replaced (the message being written giving way to the whole message, an end giving way to the next prompt); a row was known by its position among the rows shown, so a row that stopped being shown renamed every row after it; and an end that stopped being a row left its position to the prompt that followed it, which the scroller then did not see as new.

#### Business logic

- **One anchor.** Only the newest prompt among the rows shown is marked as the scroller's anchor: a message just sent while it is shown, else the last prompt of the transcript (a subagent's end counts, being a prompt). No earlier prompt is one.
- **A row's identity is its event's place in the whole stream**, counted over every event [2], shown or not. A row that stops being shown, or one that is never shown, therefore changes no other row's identity. The message just sent, which is no event yet, has an identity of its own.
- **An end that is no longer a row keeps its place.** Each end left out by "An end the agent went on after is not a row" stays in the list as an empty, hidden entry with its own identity, where it was: before the row that follows it, before a message just sent, or at the end of the list when nothing follows. The prompt after it is then past every entry the scroller already had, and is brought into view.
