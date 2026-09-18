Names the one set of rules the dashboard [1] runs in the browser: every decision that both the daemon and the browser must make the same way — which questions an agent still waits on, how an event reads, what counts as local, what a web agent [3]'s cloud side is doing — is shared from here rather than copied into the browser app, where the two copies would drift apart in silence. Nothing that can only run on a server may be reached from this entry.

## Context

**Problem**: the dashboard [1] is a browser app and the rest of the product is a server. A rule that exists on both sides in two implementations eventually answers differently on each: an agent's [3] page would offer an answer to a question the daemon then refuses, and the browser would call an address local that the daemon rejects. Sharing the single implementation is the fix, but the browser cannot load anything that touches the files, the processes or the network stack of the machine.

**Business logic story**: the browser app also uses this product's type vocabulary, which costs nothing at run time and is taken from the package's main entry; only what actually executes in the browser comes from here.

## Glossary

[1] the dashboard: the browser app the daemon serves — the product's only user interface.
[2] handoff: what became of an ended agent's work: whether its branch exists, is pushed, and has a pull request.
[3] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch, started through the project's start hook and shown in the dashboard from the files its tool keeps. A web agent is one whose location is `web`.
[4] event: everything an agent does, one event per line appended to its event stream; every surface is a projection of it.
[5] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[6] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[7] spend offset: the user's adjustment of the quota boundary — the share of the account's subscription allowance that may be spent by now — in percentage points of the week: how far past it unattended work may start. Each project's scheduler holds its own, as `spendOffset` in its state file.
[8] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[9] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[10] gate: a question with options an agent's turn ended on: the agent ends waiting for the answer, the dashboard shows the question as a card, and the answer resumes the agent.
[11] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later. The user's driver choice is `claude-code` or `codex`.

## Business logic — TL;DR

- **Nothing server-only may be reached** - no rule shared here, and nothing any of them reaches in turn, may use a capability that exists only outside a browser; a rule with a server half keeps that half in a separate module.
- **What an agent will be asked** - the ask that plans one ticket, shared with the daemon's queue write so the launcher's start and the queued entry carry the same sentence.
- **Which questions an agent still waits on** - the one rule (`open-choices.ts`) the agent's page applies to its events, the same the daemon applies before it delivers an answer.
- **How an agent's activity reads** - an agent [3]'s events [4] rendered as terminal text, which options a pick [5] chose, the driver session [6] behind the agent, the errors it hit, and where its handoff [2] stands.
- **The defaults and limits the user adjusts** - the notification defaults, whether a notification method and category is on, and the default and maximum spend offset [7].
- **What the two notification feeds count as new** - the identity of an intervention [8] and of an activity item, and what counts as already there when a feed is first read, so the browser and the daemon never disagree about which item is new.
- **What is truly local** - whether an address is a loopback address, so the daemon's decision to demand a token and the dashboard [1]'s label for the connection agree.
- **Rules about the cloud side** - a question the Claude web bridge [9] holds rendered as a gate [10], and the word for what a web agent [3]'s cloud side is doing, so every surface derives the same one.
- **Small shared renderings** - a driver [11]'s name and label, a byte count as a short label, and an error rendered as a message.
