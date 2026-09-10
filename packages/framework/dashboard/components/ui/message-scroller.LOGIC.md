Provides the scrolling list behind the dashboard's message feeds, in particular an agent [1]'s event stream [2] in `EventList.tsx`: a view that keeps following the newest message while the host asks it to, stops following the moment the user scrolls, offers a "Jump to latest" button only when there is something newer below, pulls the view to a message the host marks as an anchor (the event stream marks turn [3] boundaries), and keeps the rows the user is reading steady when older rows are added above. The behavior lives in the `@shadcn/react` message-scroller primitive; this file styles its parts and fixes the button's label.

## Context

**User story**: the user watches an agent [1] work. New events arrive at the bottom and the view keeps them in sight; when the user scrolls up to read something earlier, the view stays put and a "Jump to latest" pill offers the way back; when the agent starts a new turn [3], the view brings that turn's start to the top so the user reads it from its beginning.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[3] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.

## Business logic — TL;DR

- **Following the live edge** - while the host turns following on, every new or growing message scrolls the view to the bottom; a scroll gesture by the user stops that, and bringing the view back to the bottom resumes it.
- **"Jump to latest" only when there is something below** - the button shows only when the view is not following and content lies below it; otherwise it is invisible and cannot be clicked or reached by Tab; a click scrolls smoothly to the end.
- **Anchoring on a marked message** - a newly appeared message the host marks as an anchor pulls the view to it, with a small peek of the message before it, even when the user is not following; several anchors arriving at once while following go to the end instead.
- **Older rows added above do not move the reader** - when rows are inserted before the first one, the view shifts so the rows in sight stay where they are.
- **Where the view opens** - on its first content the view opens at the end, at the start, or at the last anchor, as the host chooses, and applies that once.
- **Readable by assistive technology** - the view is a focusable "Messages" region and the list is a live log whose additions are announced.

## Business logic

### Following the live edge

#### Context

See `## Context`.

#### Business logic

The host says whether the view follows; the event stream [2] follows while the agent [1] is live and shows a replay as a static list. While following, every appended message and every message that grows taller scrolls the view to the bottom, and the scrollbar stays quiet during these automatic scrolls. Following stops the moment the user scrolls by any means: the wheel, a touch drag, or the scrolling keys (the up and down arrows, Home, End, Page Up, Page Down and the space bar). It resumes when the user brings the view back to within a few pixels of the bottom, or presses "Jump to latest". A host that turns following on while the view is already following jumps to the end at once.

### "Jump to latest" only when there is something below

#### Context

**Problem**: a button that is always present would cover the last lines of the feed and invite clicks that do nothing; one that only looks hidden would still catch clicks and keyboard focus.

#### Business logic

The button floats over the bottom of the view and reads "Jump to latest" with a down arrow unless the host gives it another label. It is active only when the view is not following and content lies below the visible part; while following, it never shows, even in the instant a new message pushes the bottom away. When inactive it is faded out, slid below the edge, inert to clicks and skipped by Tab. Pressing it scrolls smoothly to the end and drops the keyboard focus. A host may turn the button toward the start instead, in which case it sits at the top and offers to scroll up while content lies above.

### Anchoring on a marked message

#### Context

**User story**: the agent [1] begins a new turn [3]; the user wants to read that turn from its first line, not from wherever the bottom happens to be.

#### Business logic

The host marks some messages as anchors; the event stream [2] marks each turn boundary. When a marked message appears among newly appended messages, the view scrolls so that message sits at the top, with 64 pixels of the previous message peeking above it, and a spacer is added below the content so this works even when little follows the anchor. The same happens when an existing message becomes an anchor. If the view is following and more than one anchor arrives in one batch, the view goes to the end instead. While anchored, a change of size keeps the anchor in place. Any scroll gesture by the user releases the anchor, and each anchor pulls the view only once.

### Older rows added above do not move the reader

#### Context

**Problem**: a feed that loads earlier history above the first row would otherwise push the rows the user is reading out of sight.

#### Business logic

When rows are inserted before the first row, the view shifts by exactly the height added, so the rows that were in sight remain in sight. The host can switch this off.

### Where the view opens

#### Context

See `## Context`.

#### Business logic

When the first messages appear, the view opens as the host chooses: at the end (the default; the event stream [2] uses it while following), at the start (the event stream uses it for a replay), or at the last anchor, which is placed at the top unless everything from it to the end fits in the view, in which case the view opens at the end. The choice is applied once; if the host changes it later, the new choice is applied once again. A host can also ask the view to scroll to the end, to the start, or to a message by its id, and a message not yet present is scrolled to as soon as it appears. Hosts can read whether content lies above or below the view, which messages are visible, and which anchor is current.

### Readable by assistive technology

#### Context

See `## Context`.

#### Business logic

The scrolling view is a region labeled "Messages" that keyboard focus can reach, so the scrolling keys work on it. The list of messages is a live log whose additions are announced. Visually the view fades out at its bottom edge and shows a thin scrollbar toned like the rest of the dashboard, with a stable gutter so content does not shift when the bar appears.
