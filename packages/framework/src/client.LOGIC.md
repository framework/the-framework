Names the one set of rules the dashboard [1] runs in the browser: every decision that both the daemon and the browser must make the same way — which questions an agent still waits on, how an event reads, what counts as local, what a web agent [2]'s cloud side is doing — is shared from here rather than copied into the browser app, where the two copies would drift apart in silence. Nothing that can only run on a server may be reached from this entry.

## Context

**Problem**: the dashboard [1] is a browser app and the rest of the product is a server. A rule that exists on both sides in two implementations eventually answers differently on each: an agent's [2] page would offer an answer to a question the daemon then refuses, and the browser would call an address local that the daemon rejects. Sharing the single implementation is the fix, but the browser cannot load anything that touches the files, the processes or the network stack of the machine.

**Business logic story**: the browser app also uses this product's type vocabulary, which costs nothing at run time and is taken from the package's main entry; only what actually executes in the browser comes from here.

## Glossary

[1] the dashboard: the browser app the daemon serves — the product's only user interface.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps. A web agent is one whose location is `web`.
[3] event: everything an agent does, one event per line appended to its event stream; every surface is a projection of it.
[4] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[5] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[6] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[7] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[8] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[9] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude-code` or `codex`.

## Business logic — TL;DR

- **Nothing server-only may be reached** - no rule shared here, and nothing any of them reaches in turn, may use a capability that exists only outside a browser; a rule with a server half keeps that half in a separate module.
- **What an agent will be asked** - the ask that plans one ticket, shared with the daemon's queue write so the launcher's start and the queued entry carry the same sentence.
- **Which questions an agent still waits on** - the one rule (`open-choices.ts`) the agent's page applies to its events, the same the daemon applies before it delivers an answer.
- **How an agent's activity reads** - an agent [2]'s events [3] rendered as terminal text, which options a pick [4] chose, and the driver session [5] behind the agent.
- **The notification defaults** - the notification defaults, and whether a notification method and category is on.
- **What the two notification feeds count as new** - the identity of an intervention [6] and of an activity item, and what counts as already there when a feed is first read, so the browser and the daemon never disagree about which item is new.
- **What is truly local** - whether an address is a loopback address, so the daemon's decision to demand a token and the dashboard [1]'s label for the connection agree.
- **Rules about the cloud side** - a question the Claude web bridge [7] holds rendered as a gate [8], and the word for what a web agent [2]'s cloud side is doing, so every surface derives the same one.
- **Small shared renderings** - a driver [9]'s name and label, a byte count as a short label, and an error rendered as a message.
