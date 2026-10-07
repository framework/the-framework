What the tests cover:

- **One button per applicable action** - a mounted action whose package the project has renders as a button with its label; the same action renders nothing for a project that lacks its package.
- **A click hands the links to the action** - once per project, in the order given, with that project's links in order; the host the action receives runs only the action's own package's commands; when every project succeeded the button reads the done label with a check mark and is disabled.
- **Skipped groups** - a project the action's package is not in, and a group with no links, are never handed to the action.
- **Links resolved at click time** - the function form of the links is not called at render, only when the button is clicked, and the action receives what it answered.
- **A failure** - the reason shows as an alert line, no done label appears, and the button is enabled again.
- **Re-arming and phrasing** - a rested button arms again when the page's key for the set changes; the page's phrasing of the button (`label`) is what the button reads.
