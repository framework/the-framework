The browser preview: the agent's own Chrome, streamed live into the dashboard, with the user's clicks, scrolls and keystrokes sent back into it.

## User story

- An agent hits a login wall or a captcha and parks asking a human to get past it; the user needs a way to reach that page.
- The user wants to watch what the agent's browser is doing while it works.

## Business logic — TL;DR

- **Watch and drive** - the agent's browser is shown live, and clicking, scrolling and typing on it act on the real page.
- **A click lands where the user aimed** - screen coordinates are translated to the page's own coordinates, so a preview that is not life-size still clicks the right thing.
- **Only real characters are typed** - modifier and navigation keys are not sent as literal text.
- **An unreachable preview explains itself and offers Retry** - and a failure is never latched: a different agent, or a retry, starts clean.
- **Two shapes, one behaviour** - a full pane in the right rail with help text, and a letterboxed inline version in the agent's event log.
- **Stills for after the agent ends** - the newest frame is handed to the caller every couple of seconds so a pane whose agent has ended can show a still instead of a dead stream; the frame stays in this viewer's memory only.

## Business logic

### Watch and drive

#### User story

An agent parks at a login wall and the user takes over the browser to sign in.

#### Business logic

The agent serves its headless Chrome as a live image stream and accepts input back; the daemon proxies both, so everything stays on the dashboard's own origin. The frame is focusable, so keystrokes have somewhere to land, and shows a focus ring so the user can see where they will land. Clicking sends a click, using the scroll wheel sends a scroll, and typing sends the character.

This is the half that makes an agent's parked browser request actionable: before it, the agent asked a human to get past a wall and that human had no way to reach the page.

### A click lands where the user aimed

#### User story

The user clicks a button in a preview that is smaller than the real page.

#### Business logic

The captured frame is capped in size and then scaled again to fit whatever box it is shown in, so a pixel on screen is not a pixel on the page. Every click and scroll is converted from its position within the displayed frame to the corresponding position on the real page before being sent.

### Only real characters are typed

#### User story

The user types into the agent's browser, using shift and arrow keys as they normally would.

#### Business logic

Keystrokes are delivered to the page as typed text, so only single-character keys are sent, and only when no command or control modifier is held. Otherwise a bare modifier or an arrow key would insert the literal words "Shift" or "ArrowLeft" into the page.

### An unreachable preview explains itself and offers Retry

#### User story

The user opens the browser preview for an agent that was not started with the browser enabled, or one that has only just started.

#### Business logic

When the stream cannot be loaded, the panel says the preview is not reachable, explains that it ends with the agent and that an agent only has one if it was started with Browser on, and notes that a just-started agent's stream may not be up yet. A Retry control attempts the stream again.

A failure is tied to the exact stream attempt it happened on. Switching to a different agent, or hitting Retry, starts from a clean state, so one early failure — the tab was opened before the agent's stream was up — is never terminal, and coming back to an agent whose earlier stream failed tries again rather than replaying the stale failure.

### Two shapes, one behaviour

#### User story

The user watches the browser in the right rail, or inline where the agent asked for it in its event log.

#### Business logic

The panel has two presentations of the same live browser: a full pane that scrolls in the right rail and carries footer help — click the frame then type, and the frame stays blank until the agent opens something, because Chrome only sends a frame when the page changes — and an inline version that fills and letterboxes into the row that hosts it and drops the help text.

### Stills for after the agent ends

#### User story

An agent finishes while the user is watching its browser, and the user wants to still see the last thing it was looking at.

#### Business logic

While the stream runs, a still of the newest frame is handed to whoever hosts the panel every couple of seconds, so a pane whose agent has ended can degrade to that still instead of a dead stream. Frames that are only half decoded are skipped and the next one is taken. The still lives only in this viewer's memory — never in the event log and never on disk, the same rule the stream itself follows.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
