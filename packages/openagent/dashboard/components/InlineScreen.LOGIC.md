A live screen [1] in an agent's transcript: the page a `screen` line names, framed at the row where the line is, and the rule for which addresses may be framed at all. The page is the command's own (for the browser skill: its address bar over the live picture of the browser, taking clicks and typing); the dashboard knows nothing of what it shows.

## Glossary

[1] screen: a live page on this machine that something the agent ran is showing, such as its browser, announced by a `screen` line the command appended to the agent's diary: the page's address, a label naming what it showed then, and, on the line that says it has gone, `ended`.

## Business logic — TL;DR

- **The frame** - the page at the line's address, the full width of the transcript at a 16:11 shape and at most 32rem high, named by the line's label for assistive technology, sandboxed to run its own scripts and forms only.
- **Only this machine's pages** - an address is framed only when it is `http` on `127.0.0.1`, `localhost` or `[::1]`; any other address, or text that is not an address, is not.

## Business logic

### The frame

#### Context

**User story**: the person watching an agent sees its browser where the agent opened it, and clicks and types in it.

#### Business logic

The row's body is an embedded frame loading the line's address, titled with the line's label. The frame's sandbox lets the page run its scripts, keep its own origin and submit forms, and nothing else; the page is served from its own port, a different origin from the dashboard, so it cannot reach the dashboard's page. The frame fills the transcript's width at a 16:11 shape, capped at 32rem high, with a rounded border on a muted background while it loads.

### Only this machine's pages

#### Context

**Problem**: the `screen` line was written by whatever command the agent ran, so its address is not the dashboard's to trust; a page on the open web must never be embedded in the dashboard because a line said so.

#### Business logic

An address is framed only when it parses as a URL whose scheme is `http` and whose host is `127.0.0.1`, `localhost` or `[::1]`. An `https` address, any other host, and text that does not parse are not framed; which rows are framed is decided in `EventList.tsx`, by this rule.
