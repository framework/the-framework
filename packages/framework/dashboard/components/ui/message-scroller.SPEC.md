The scrolling transcript the dashboard shows a growing stream of messages in — an agent's event log, its live chat. It keeps the newest content in view as the stream grows, but hands control to the user the moment they scroll back.

## Business logic — TL;DR

- **Follows the live edge** - while the user is at the bottom, newly arriving messages keep the view pinned there, so a running agent reads like a live feed without any clicking.
- **Scrolling back holds still** - once the user has scrolled up, what they are reading stays put as messages continue to arrive underneath, anchored on message boundaries rather than jumping by pixels.
- **"Jump to latest"** - a floating pill appears over the transcript whenever the user is away from the live edge and takes them back to it in one click; when there is nothing to scroll it fades out and stops accepting clicks entirely, rather than sitting there as a dead control.
- **The scrollbar stays out of the way** - the transcript uses the dashboard's own thin, themed scrollbar instead of the one the operating system paints, it reserves its lane so content does not shift when it appears, it dims while the view is auto-scrolling, and the bottom edge of the transcript fades out to signal there is more below.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
