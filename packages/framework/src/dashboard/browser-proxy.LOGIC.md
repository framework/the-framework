The daemon's route from the dashboard to the browser an agent [1] is driving: the "Browser" panel asks the daemon for the live picture and sends clicks and keys back, and the daemon relays both to the agent's own browser bridge [2] on this machine. The address of that bridge is never something the browser gets to name — the daemon looks it up from the agent itself — which is what keeps this from becoming an open relay into anything else listening on the machine.

## Context

**User story**: an agent [1] working with a real browser hits a login wall or a captcha and parks, asking a human to deal with it. The browser it is parked on has no window of its own, so the dashboard shows a live picture of it in the right rail's "Browser" panel and sends the human's clicks and keystrokes back into it.

**Problem**: the browser bridge [2] belongs to the agent and listens on a port the operating system picks for that agent, on this machine only. The dashboard is served by the daemon on a different port, so it is a different origin and cannot talk to that bridge itself — and making the bridge accept browser origins would undo the containment that keeps the agent's browser unreachable from any web page the user happens to open. The daemon relays instead: the dashboard talks only to the daemon, and the daemon talks only to this machine.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] browser bridge: the small server an agent runs beside its browser while it works, which serves the live picture of that browser and accepts clicks and keys for it.
[3] project: a repository the user registered in the dashboard, identified by an id derived from its path.
[4] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its run.

## Business logic — TL;DR

- **Two legs, addressed by project and agent** - the dashboard asks for the picture or posts input under `/browser/<project>/<agent>/stream` or `/browser/<project>/<agent>/input`; anything else is not a browser request at all.
- **The destination is looked up, never supplied** - the daemon finds the agent's [1] browser bridge [2] from that agent's own record, so no caller can aim the relay anywhere else.
- **Only a running agent has a browser to show** - a finished agent, an agent started without a browser, and an unknown id are all answered "no browser preview for this run".
- **Both legs stream** - the picture is an endless response and is passed through as it arrives, never collected first, and it is never cached.
- **When the far end dies, the pane is told** - a bridge that fails or disappears mid-stream ends the response with a gateway error instead of hanging.
- **A pane that goes away stops costing frames** - closing the panel tears the relay down, so the agent stops serving a viewer that is no longer there.

## Business logic

### Two legs, addressed by project and agent

#### Context

See `## Context`.

#### Business logic

The dashboard addresses the relay at `/browser/<project id>/<agent id>/stream` for the live picture and `/browser/<project id>/<agent id>/input` for a click or a key sent back. The picture leg is a plain fetch of an image that keeps updating; the input leg carries the click or key as JSON.

Any other shape under that prefix — a missing project [3] or agent id [4], a fourth path segment, any word other than `stream` or `input`, or a target the daemon cannot make sense of at all, such as a broken escape sequence — is not treated as a browser request and is served as an ordinary dashboard address instead. Nothing is guessed at, and a malformed address never brings the daemon down.

The ids are used only to look an agent [1] up. They are never used as a path on disk.

### The destination is looked up, never supplied

#### Context

**Problem**: if the address the daemon relays to came from the request, anyone who could reach the dashboard could aim it at any service listening on the machine and read the answer through the daemon. The relay must be able to reach exactly one thing: the browser bridge [2] of the agent [1] named in the address.

#### Business logic

The daemon resolves the project [3] to its directory, reads the live agents [1] recorded there, finds the one with the given agent id [4], and takes the browser bridge's [2] address from that agent's own record. The relay then talks to that address on this machine only. No part of the address the caller sent decides where the request goes.

### Only a running agent has a browser to show

#### Context

**Problem**: an agent's [1] browser bridge [2] dies with the agent, and the number it was reachable at is handed out again to whatever starts next. Relaying to the address of a finished agent would point the panel at a stranger.

#### Business logic

The relay serves only an agent [1] that is currently running and recorded a browser bridge [2]. An agent that has finished, an agent started without a browser, an unknown agent id [4], an unknown project [3], and a record that cannot be read are all answered the same way: the response says "no browser preview for this run".

That answer is ordinary rather than a fault: the panel asks repeatedly while an agent is starting up, and many agents never have a browser at all, so a miss is not reported anywhere.

### Both legs stream

#### Context

**Problem**: the live picture is an endless response — it never finishes while the agent [1] is working. Anything that waited for it to finish before answering would answer never.

#### Business logic

Both legs are passed through as the bytes arrive, in both directions, and neither is collected first. The status and headers the browser bridge [2] answers with are passed back as they are, with one addition: the response is marked as never to be cached, because every frame is a live picture of what is happening right now.

### When the far end dies, the pane is told

#### Context

**Problem**: an agent [1] can end, crash or be stopped while its picture is being watched. That failure arrives as a broken connection rather than as an answer.

#### Business logic

When the browser bridge [2] cannot be reached or fails mid-stream, the response is closed. If nothing has been sent yet, it is closed as a gateway error, so the panel learns the far end is gone instead of waiting forever.

### A pane that goes away stops costing frames

#### Context

**Problem**: the picture is produced continuously while someone is asking for it. A viewer that has closed the panel or navigated away would otherwise go on costing the agent [1] a stream of frames nobody sees.

#### Business logic

When the dashboard's end of the response closes, the daemon's request to the browser bridge [2] is torn down immediately, so the agent [1] stops producing frames for a viewer that is gone.
