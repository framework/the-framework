Keeps, in this browser, on which pages the dashboard's side panel (the right rail, `components/RightRail.tsx`) is open.

## Context

**User story**: the user opens the side panel on one agent's page to read its changes. On another agent's page the panel is closed, as that page was left. Back on the first agent's page, and after a reload, the panel is open again. A user who never opens it never sees it.

**Problem**: one open-or-closed answer for the whole dashboard opened the panel on every agent's page once it was opened on one, taking half the page from conversations where the user did not ask for it.

**Problem**: read from the daemon, the answer would come after the first frame, and the panel would show a moment late on every page load. It is how one person left this screen in this browser, not a setting of the project.

## Business logic — TL;DR

- **One answer per page** - each agent's page has its own answer, named by its project and agent; the "New agent" page has one answer of its own, the same for every project.
- **Closed unless remembered open** - the browser's local storage holds, under the key `oa.side-panel`, the list of the pages whose panel is open, and nothing when none is; a page not in the list is closed. The answer is read at once, from the first frame. Something else found under the key reads as no page open.
- **Opening and closing** - a change is written to the local storage and told to every part of the page that shows it, at once; it changes the answer of that one page only.
- **At most 200 pages remembered** - opening a panel when 200 pages are already remembered open forgets the one opened longest ago, which is then closed.
- **A browser that keeps nothing** - where the local storage cannot be read every panel is closed; where it cannot be written a panel still opens and closes, for as long as the page is loaded.
