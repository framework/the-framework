Keeps whether the dashboard's side panel (the right rail, `components/RightRail.tsx`) is open, in this browser.

## Context

**User story**: the user opens the side panel once and finds it open on every page and after a reload; a user who never opens it never sees it.

**Problem**: read from the daemon, the answer would come after the first frame, and the panel would show a moment late on every page load. It is how one person likes this screen in this browser, not a setting of the project.

## Business logic — TL;DR

- **Closed unless remembered open** - the browser's local storage holds `open` under the key `fw.side-panel` while the panel is open, and nothing while it is closed; the answer is read at once, from the first frame.
- **Opening and closing** - a change is written to the local storage and told to every part of the page that shows it, at once.
- **A browser that keeps nothing** - where the local storage cannot be read the panel is closed; where it cannot be written the panel still opens and closes, for as long as the page is loaded.
