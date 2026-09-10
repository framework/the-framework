The browser preview inline in the transcript: the body of the transcript's latest browser row, a fixed 16:10 box across the column holding the same proxied screencast of the agent's [1] browser that the right rail's Browser tab shows, so the two surfaces can never disagree about what the browser is doing. When the agent ends, the box degrades in place to the last frame with a "preview ended" overlay, and when it has no frame to keep it falls back to the one-line "browser · <url>" — never a dead stream, never a spinner.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **Live: the interactive pane** - while the agent is live, the box hosts the rail's browser panel, letterboxed in a 16:10 box capped at 24 rem tall, which hands back a still of its newest frame every couple of seconds.
- **Ended under the reader: the last still** - when the agent ends while the box is on screen, the box keeps the last still, captioned "preview ended — session finished".
- **Ended with nothing captured: the one-liner** - with no still to keep, because the reader arrived after the end or no frame ever painted, the row is just "browser · <url>".
- **Frames never enter the log** - the still lives only in this viewer's memory; the transcript never carries a frame.

## Business logic

### Live: the interactive pane

#### Context

**User story**: the agent [1] opens a page in its browser and the user watches it live, right where the transcript says the agent went there.

#### Business logic

While the agent is live, the box hosts the same interactive browser panel the right rail's Browser tab shows (its rules in `BrowserPanel.tsx`), inline: a 16:10 box across the full column width, capped at 24 rem tall, the screencast letterboxed inside. The panel hands back a still image of its newest frame every couple of seconds, which the box keeps as its fallback.

### Ended under the reader: the last still

#### Context

**Problem**: a control whose agent [1] is gone must not look alive; a frozen stream or a spinner would be a dead control.

#### Business logic

When the agent ends while the box is on screen, the box drops the live panel and shows the last still it was handed, fitted inside the same box, with the caption "preview ended — session finished" overlaid along the bottom edge.

### Ended with nothing captured: the one-liner

#### Context

See "Ended under the reader: the last still".

#### Business logic

When the agent is not live and the box holds no still — the reader arrived after the agent ended, or no frame ever painted — the row is just the text "browser · <url>", naming the page the row announced.

### Frames never enter the log

#### Context

**Problem**: someone will type a password into that browser; a frame kept anywhere but the viewer's own memory would put it in the transcript.

#### Business logic

The still is held only in this viewer's memory for as long as the box is on screen. Nothing of it is written to the event stream or anywhere else.
