The screen page [1] a person watches and uses the browser through, and the rules behind it: which of the person's inputs reach the page and as what, how history steps work, and how the live picture is streamed as a sequence of JPEG frames.

## Context

**User story**: a person watching the agent in the dashboard sees the browser live, clicks a button in it, scrolls, types into a field, types an address into its address bar, or goes back; the agent's next read shows what the person did.

**Problem**: the screen page takes requests from whoever holds its address, and the address is written into the agent's diary; nothing malformed may reach Chrome.

## Glossary

[1] screen page: the page the browser's process serves at its root: the browser's address bar (back, forward, reload, the address) over a live picture of the page, which takes clicks, scrolling and typing. Its address carries the token.
[2] token: 32 random hexadecimal characters the browser's process draws when it starts; every request to it must carry it, in the address's `t` parameter or the `x-browser-token` header.

## Business logic — TL;DR

- **What a person's input becomes** - a click is a left-button press and release at a point; a scroll a mouse wheel at a point; typing inserts text; a key is one of the nine keys the agent's `press` knows; an address opens only when it is `http` or `https`; reload reloads; anything else, or anything with a missing or malformed value, becomes nothing.
- **Back and forward** - one step in the page's history, nothing when there is no such step.
- **The live picture** - each frame is one part of a `multipart/x-mixed-replace` stream: its JPEG with its type and length.
- **The screen page itself** - an address bar over the live picture; the page reads its token [2] from its own address and sends it with every request, so it needs nothing from whoever frames it.

## Business logic

### What a person's input becomes

#### Context

See `## Context`.

#### Business logic

- `click` at x, y: the left button pressed and released there, once; both coordinates must be finite numbers.
- `scroll` at x, y by a vertical amount: a mouse wheel there, scrolling only vertically; all three must be finite numbers.
- `text`: the text inserted where the focus is; an empty text or one that is not a string is nothing.
- `key`: one of Enter, Tab, Escape, Backspace, Space, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, sent as the key going down then up, the same key events the agent's `press` sends; any other key is nothing.
- `navigate`: the address is opened only when it starts with `http://` or `https://`; any other is nothing.
- `reload`: the page reloads.

An input of any other type becomes nothing, and the browser's process answers it as a bad request.

### Back and forward

#### Context

See `## Context`.

#### Business logic

Back and forward read the page's history and open the entry one step before or after the current one; when there is none, nothing happens.

### The live picture

#### Context

See `## Context`.

#### Business logic

Each frame is sent as one part of a stream a browser shows as a moving image: a boundary line, the part's type (`image/jpeg`) and its length, a blank line, the JPEG, and a line break.

### The screen page itself

#### Context

**User story**: the dashboard frames the screen page by its address alone.

#### Business logic

The page is an address bar (back, forward, reload buttons and the address field) above the live picture, in light or dark following the viewer's system. It reads the token [2] from its own address and sends it with every request. A click on the picture focuses it and sends a click at the matching point of the browser's page, scaled from the picture's shown size to its real size; the mouse wheel over the picture sends a scroll there instead of scrolling the screen page. While the picture has the focus, Enter, Tab, Escape, Backspace and the four arrows are sent as keys and any other single character as text; a key held with Command, Control or Alt is left alone. The back, forward and reload buttons send their input. Submitting the address field sends it as an address to open, `http://` added when it has no `http://` or `https://`. Every second the page asks the browser's process for the current address and title: the address field shows the address unless the person is typing in it, and the tab's title becomes the page's title, or "browser". When the picture's stream fails, the picture is replaced by "The browser is closed."
