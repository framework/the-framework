Speaking to the page Chrome shows, through Chrome's DevTools protocol over a WebSocket, with no dependency beyond Node: listing the pages, choosing the one the agent is on, and one connection to it that sends requests and hears events. Only the browser's process connects; the debugging address is never handed to a page or to a person watching.

## Business logic — TL;DR

- **The page the agent is on** - the first page in Chrome's list of pages that can be connected to; Chrome lists the most recently used page first, so a link that opens a new tab moves the agent there, and the live picture follows.
- **One connection to the page** - requests are answered in any order and matched to their request; an error Chrome returns fails that request with Chrome's message; events are handed to whoever listens for their name; once the page closes, every request still waiting and every new one fails with "the page closed".

## Business logic

### The page the agent is on

#### Context

**User story**: the agent clicks a link that opens in a new tab; its next read is of that new tab, and the person watching sees the new tab too.

#### Business logic

The list of pages comes from Chrome's `/json/list` endpoint; an error answer, or anything other than a list, counts as no pages. The page the agent is on is the first entry of type `page` that offers a connection address.

### One connection to the page

#### Context

See `## Context`.

#### Business logic

Connecting opens a WebSocket to the page's connection address; a failure to connect is "could not reach the page at <address>". Each request gets the next number and is answered by Chrome's message carrying that number: its result, or its error message as a failure ("DevTools error" when Chrome gives none). A message that is not JSON, or that answers no waiting request, is ignored. A message without a number is an event, handed to every listener registered for its method name. When the socket closes, the connection reads as closed, every waiting request fails with "the page closed", and so does every request sent afterwards.
