---
'@gemstack/framework-dashboard': patch
---

The Overview's AI Queue card now lets you act on an entry, two ways. An entry that links somewhere is a link: a queued ticket (the `[Title](tickets/x.md)` style) opens that ticket's own page, and an absolute http(s) target opens in a new tab — an entry pointing anywhere else keeps its title and stays plain text rather than pretending to have a page. And every open entry carries a play button that spins up an agent working on that one entry immediately — the same unattended work the drain sweep would get to, but on your click, with the drain's own vocabulary narrowed to the entry so the agent checks off exactly the line you started. The card previously was read-only: titles you could not open, and no way to start a queued task short of draining the whole queue.
