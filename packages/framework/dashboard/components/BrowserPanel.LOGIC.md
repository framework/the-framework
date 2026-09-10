The live view of an agent's [1] browser, in the agent view's [2] right rail and inline in the transcript: the agent's headless Chrome streamed as a motion-JPEG image the browser plays natively, on which the user clicks, scrolls and types, with each input translated to the real page's coordinates and posted back to the agent's browser through the daemon. It is what makes the gate [3] at which an agent hands its browser to a human actionable: the agent parks asking for help past a login wall, and this is how the user reaches the page. When the stream cannot be reached the panel says so and offers "Retry"; while it streams, it hands a still of the newest frame to the surface showing it every two seconds, so a pane whose agent has ended can degrade to that still instead of a dead stream.

## Context

**User story**: an agent started with "Browser" on opens a page; the user sees it live in the rail, clicks into a login form, types the password, and the agent continues. Later, on a finished agent's page, the last thing the browser showed is still there as a picture.

**Problem**: frames never enter the agent's log or touch the disk; the stream and the stills exist only in the viewer's memory, and a still is the only thing left once the agent, and its browser with it, has ended.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] agent view: one agent's page.
[3] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.

## Business logic — TL;DR

- **The live frame** - the agent's browser as one streamed image, named "The agent's browser", with the rail's help line "Click the frame, then type. Chrome only sends a frame when the page changes, so this stays blank until the agent opens something."
- **Driving the page** - a click, a scroll and a typed character are sent to the agent's browser at the page's own coordinates; modifier and navigation keys are not sent.
- **When the stream is not reachable** - "The preview is not reachable. It ends with the session, and a session only has one when it was started with Browser on. If it just started, the stream may not be up yet." with "Retry"; the failure is tied to that one attempt, so a retry or another agent starts clean.
- **Stills for after the end** - every two seconds while streaming, a JPEG still of the newest frame is handed to the surface showing the panel, and lives only in that viewer's memory.

## Business logic

### The live frame

#### Context

See `## Context`.

#### Business logic

The panel shows one image, named "The agent's browser", fed by the daemon's same-origin proxy of the agent's [1] screencast, which the browser renders as it arrives: there is no player, the browser is the player. The frame can take keyboard focus, and a focus ring shows where keystrokes will land. In the rail, a help line under the frame reads "Click the frame, then type. Chrome only sends a frame when the page changes, so this stays blank until the agent opens something."; inline in the transcript the frame fills and letterboxes into the row's box and the help line is dropped. The rail and the inline variant differ only in their container.

### Driving the page

#### Context

**Problem**: the screencast caps the frame at 1280×720 and the rail scales it again, so a pixel on screen is not a pixel on the page; an input sent at screen coordinates clicks the wrong thing on any pane that is not life-size.

#### Business logic

A click on the frame is sent as a click at the page position it corresponds to, scaling the position within the shown image up to the frame's real size. A wheel movement is sent as a scroll at that position with its vertical amount. A key press is sent as typed text only when it is a single character pressed without Ctrl or Cmd; a bare modifier, an arrow key or a shortcut is not sent, since it would otherwise be typed as the literal word "Shift" or "ArrowLeft". A send that fails is dropped silently.

### When the stream is not reachable

#### Context

**Problem**: the stream ends with the agent [1], only exists for an agent started with "Browser" on, and may not be up yet in the first moments of an agent; one early failure, from a tab opened before the stream endpoint was up, must not be terminal.

#### Business logic

When the image fails to load, the panel replaces it with "The preview is not reachable. It ends with the session, and a session only has one when it was started with Browser on. If it just started, the stream may not be up yet." and a "Retry" button. The failure is remembered for that exact stream attempt only: "Retry" opens a fresh attempt, and switching the panel to another agent starts clean rather than inheriting the earlier failure. Coming back to an agent whose stream failed earlier tries again, since the stream may have come up since.

### Stills for after the end

#### Context

**User story**: a finished agent's page keeps showing the last page its browser was on, as a still picture in place of the live stream.

#### Business logic

When the surface showing the panel asks for stills, the panel takes a JPEG copy of the newest frame every two seconds while a frame has arrived, and hands it over; a frame caught half-decoded is skipped for the next one. The surface keeps the latest still so that once the agent [1] ends it can show the still in place of the dead stream. Stills are never written to the log or the disk: they live only in this viewer's memory, the same rule the stream follows.
