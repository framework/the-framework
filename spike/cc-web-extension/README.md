# Claude web bridge, spike

Answers one question: can an extension running in the user's own Claude session reliably find
the question a cloud run is parked on, and the box an answer would go into?

It **sends nothing anywhere**. There are no `host_permissions` in the manifest, so it cannot
reach the daemon or any other host even if the code tried to. Transport is a separate problem
(see the issue), and it is deliberately not part of this spike.

## Load it

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked**, and pick this directory
4. Open a parked cloud session, for example the one from #1234

A small panel appears bottom right, reporting what it could read.

## What to look for

| row | what it means |
|---|---|
| `question found` | whether the await-choices JSON was located, and by which strategy |
| `title` / `options` | the parsed question. If these are right, extraction works |
| `composer` | which element an answer would be typed into |

**Copy report** puts the whole survey on the clipboard, to paste into the issue.

**Fill composer (does not send)** types the first option into the box and stops there. It never
submits. That is on purpose for a spike: it proves the write path exists without the extension
ever speaking on the user's behalf.

## What a passing result looks like

`question found: yes (code-block)` with the right title and options, and a `composer` that is
found. That combination means the readable half of the bridge is viable and the design in the
issue can proceed to the transport question.

If `question found` is `no` while a question is clearly on screen, extraction by DOM is the
wrong bet and the issue should be closed in favour of the API route.
