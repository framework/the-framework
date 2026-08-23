The browser preview shown inline in an agent's transcript: when an agent announces that it opened a page, that row's body becomes a live view of the agent's own Chrome, in a fixed 16:10 box spanning the column. It streams the very same view as the right rail's Browser tab, so the two surfaces can never disagree about what the agent's browser is doing.

## Business logic — TL;DR

- **Live while the agent runs** - the box holds the interactive browser preview: the user can watch the page and click and type into it, exactly as in the rail's Browser tab.
- **It degrades in place, never dies** - when the agent finishes while the user is watching, the box freezes on the last frame it saw and overlays the line "preview ended — session finished": never a dead stream, never a spinner.
- **Nothing to show, one line instead** - a reader who arrives after the agent ended, or for whom no frame ever painted, gets just the row's one-line note naming the page that was opened.
- **Frames stay in the viewer's browser** - the last frame is held only in the memory of the tab looking at it; browser frames are never written to the agent's event log.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
