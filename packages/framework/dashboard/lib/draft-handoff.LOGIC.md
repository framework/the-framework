Carries a prompt the user has typed into a composer [1] from wherever it was typed to the launcher [2] that will use it, without ever leaving the prompt in the address bar. A prompt arriving from another device [3] rides in the page's address as it opens; a prompt handed over inside the same tab is carried directly. Either way the launcher takes it once, and it is gone.

## Context

**User story**: the user types a prompt on this machine, then decides the work should run on another machine they have saved. The other machine's dashboard opens with the prompt already in its composer [1], so the user does not retype it. The user also clicks through from a ticket with no agent [4] of its own to the launcher [2], and the launcher opens already knowing what the next agent should be about.

**Problem**: the prompt is the user's own words and can name anything. A prompt left in the address bar would be kept in the browser's history and sent to whatever the page links to next as the page the visitor came from. It must therefore live in the address only for as long as it takes the page to open.

## Glossary

[1] composer: a project's prompt editor, also used for live chat.
[2] the launcher: the Start form on a project's own page.
[3] device: another machine's daemon the user saved by URL and token, to run agents on it from this dashboard.
[4] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.

## Business logic — TL;DR

- **A prompt arriving in the address is moved out of it immediately** - as the dashboard opens, a prompt carried in the page's address is put aside for the launcher [2] and erased from the address, from the history entry and from what the page reports as its origin to anything it links to.
- **A prompt handed over inside the tab never touches the address** - a click that knows what the next agent [4] should be about puts the prompt aside directly.
- **The launcher takes it once** - reading the carried prompt clears it, so reloading the page does not fill the composer [1] again, and it is forgotten when the tab closes.

## Business logic

### A prompt arriving in the address is moved out of it immediately

#### Context

See `## Context`.

#### Business logic

When the dashboard opens with a prompt carried in the page's address, the prompt is put aside for the launcher [2] and the address is rewritten without it, replacing the current history entry rather than adding one. The rest of the address — its path, its other parameters and its fragment — is left as it was. With no prompt in the address, nothing happens; opening the page twice with the same address has the same effect as opening it once. This is how a prompt reaches a device [3] the user hops to: the prompt travels beside the credential that lets the browser in, and only the credential is stripped by the machine being connected to.

### A prompt handed over inside the tab never touches the address

#### Context

**User story**: the user clicks a ticket that has no agent [4] of its own and lands on the launcher [2] with a prompt about that ticket already written.

#### Business logic

A navigation that stays inside the same tab puts the prompt aside directly, without ever writing it into the address. There is nothing to hand another machine in that case, so there is no reason for the user's words to appear in the address bar at all.

### The launcher takes it once

#### Context

**Problem**: a carried prompt that survived being read would refill the composer [1] on every reload, overwriting whatever the user has typed since.

#### Business logic

The launcher [2] asks for the carried prompt once; reading it removes it, so a reload starts from an empty composer [1]. The prompt is kept only for the life of the browser tab, so closing the tab forgets it. Where this runs without a browser behind it, there is nothing to keep and nothing is carried.
