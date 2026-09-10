Names the one set of rules the dashboard [1] runs in the browser: every decision that both the daemon and the browser must make the same way — what a preset [2] prompt says, what the built-in system prompt [3] contains, which handoff [4] rung a set of checkboxes means, what counts as local, what a web agent [5]'s cloud side is doing — is shared from here rather than copied into the browser app, where the two copies would drift apart in silence. Nothing that can only run on a server may be reached from this entry.

## Context

**Problem**: the dashboard [1] is a browser app and the rest of the product is a server. A rule that exists on both sides in two implementations eventually answers differently on each: the launcher [6] would offer a preset [2] whose prompt is not the prompt the agent [5] receives, the checkbox row would arm a handoff [4] the agent does not perform, and the browser would call an address local that the daemon rejects. Sharing the single implementation is the fix, but the browser cannot load anything that touches the files, the processes or the network stack of the machine.

**Business logic story**: the browser app also uses this product's type vocabulary, which costs nothing at run time and is taken from the package's main entry; only what actually executes in the browser comes from here.

## Glossary

[1] the dashboard: the browser app the daemon serves — the product's only user interface.
[2] preset: a canned prompt the user launches from the dashboard (research, readability, maintainability, security audit, UX, maintenance, market research, update tickets, plan tickets, suggest new tickets, suggest new features, suggest tickets to work on, drain queue, triage quick, triage consensual).
[3] the built-in system prompt: the standing instructions every agent starts with; `SYSTEM.md` is the project's own instructions added on top.
[4] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[5] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. A web agent is one whose location is `web`.
[6] launcher: the Start form on a project's own page.
[7] routine: a preset the daemon fires on its own on a schedule — update tickets, triage quick, triage consensual, plan tickets, maintenance — each switchable off and runnable on demand.
[8] Auto PM: the daemon's unattended product management: drain the agent queue, and refill it by running the routines.
[9] event: everything an agent does, one event per line appended to its event stream; every surface is a projection of it.
[10] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[11] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[12] spend offset: the user's adjustment of the quota boundary — the share of the account's subscription allowance that may be spent by now — in percentage points of the week.
[13] intervention: something that needs a human — an open question, a pull request to review, unpushed commits — one of the two notification feeds. The other is activity: an agent started or finished.
[14] the Claude web bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[15] gate: a question with options at which an agent stops and waits for an answer.

## Business logic — TL;DR

- **Nothing server-only may be reached** - no rule shared here, and nothing any of them reaches in turn, may use a capability that exists only outside a browser; a rule with a server half keeps that half in a separate module, the way reading the project's own `SYSTEM.md` from disk is kept apart from composing the prompt text.
- **What an agent will be told** - the presets [2] and their prompts, the ask that plans one ticket, and the composition and rendering of the built-in system prompt [3], so the launcher [6] can prefill and show the user the exact text an agent [5] will receive instead of describing it.
- **What the daemon does on its own** - the routines [7] Auto PM [8] fires, and its drain and maintenance work, so the list the user sees and can run on demand is the list the daemon runs, not a copy of it.
- **How an agent's activity reads** - an agent [5]'s events [9] rendered as terminal text, which options a pick [10] chose, the driver session [11] behind the agent, the agent's progress, the errors it reported, and where its handoff [4] stands.
- **What an agent will be started with** - the mapping from the user's preferences to an agent [5]'s options and its handoff [4] rung, how the repo file `the-framework.yml` reads as preferences, and the handoff ladder itself with the conversions between the checkbox row and a rung, so an impossible combination resolves on the screen that collected it.
- **The defaults and limits the user adjusts** - the notification defaults, whether a notification method and category is on, the default and maximum spend offset [12], and how many agents Auto PM [8] runs at once.
- **What the two notification feeds count as new** - the identity of an intervention [13] and of an activity item, and what counts as already there when a feed is first read, so the browser and the daemon never disagree about which item is new.
- **What is truly local** - whether an address is a loopback address, so the daemon's decision to demand a token and the dashboard [1]'s label for the connection agree.
- **Rules about the cloud side** - a question the Claude web bridge [14] holds rendered as a gate [15], and the word for what a web agent [5]'s cloud side is doing, so every surface derives the same one.
- **Small shared renderings** - a driver's name and label, a byte count as a short label, and an error rendered as a message.
