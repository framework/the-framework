Keeps the changed file a click in an agent's chat asked to see, for the page the click was made on, and opens that page's side panel (the right rail, `components/RightRail.tsx`).

## Context

**User story**: at the end of a turn, the agent's chat lists the files the turn's edits changed, a row each (`components/ChangedFiles.tsx`). The user clicks a row: the side panel opens on the tab that lists what the agent changed, with that file picked.

**Problem**: the chat and the side panel are two parts of the page that share no parent's state, and the tab that shows the file is a module's, drawn only once the panel is open. The ask [1] must wait somewhere until that tab is drawn and reads it.

**Problem**: the user clicks the same file's row a second time, after looking at another file in the tab. Kept as the file's path alone, the second ask would change nothing and nothing would happen.

## Glossary

[1] ask: one click on a changed file's row in an agent's chat: the file's path in the agent's checkout, and a number that is higher than every earlier ask's, which tells one ask from the next for the same file.

## Business logic — TL;DR

- **One ask per page** - the last ask [1] is kept per page, under the name the side panel keeps that page's answer under (`lib/side-panel.ts`: an agent's page is named by its project and agent); an ask made on another agent's page is not this page's.
- **An ask opens the side panel** - making an ask opens that page's side panel, as its button does, and that is remembered as an opening by hand is.
- **Every ask is a new one** - each ask gets the next number, also for the file already asked for, and every part of the page that reads the page's ask is told at once.
- **Kept while the dashboard is loaded** - the asks are kept in memory, not in the browser's storage: a page with no ask says none, and a reload forgets them all.
