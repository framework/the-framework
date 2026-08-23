"Your call": the gate an agent parks on, shown to the user as a question with options and sent back as a pick.

## User story

- An agent reaches a decision it will not make alone and parks; the user answers it and the agent carries on.
- The user answers the gate inline where it was asked in the agent's event log, from the pooled open questions list, or on the notice of an agent handed to a Claude Code cloud session.
- A question a cloud session parked on is answered exactly like a local agent's — one click, the same panel — even though it has to travel out through the user's browser to reach that session.

## Business logic — TL;DR

- **One shape for every gate** - a title plus options, picked one at a time or several at once; there is no separate approve/decline card.
- **The recommended option is marked** - and it is what Accept and the keyboard shortcut choose.
- **A multi-select says what Accept will do** - the button names how many options are selected, so accepting nothing is a deliberate choice rather than a surprise.
- **The panel stays parked after answering** - it reports that the pick was sent and waits for the agent to pick it up, instead of just greying out.
- **Ctrl+Enter accepts, on one gate at a time** - only the agent's newest open gate binds the shortcut, so it is never ambiguous.
- **Where the pick is delivered can be swapped** - by default it goes to the agent it belongs to; a question carried in by the Claude web bridge queues it for the browser extension instead, and the panel is identical either way.
- **A refused pick is reported and retryable** - the panel says the choice could not be sent rather than failing silently.

## Business logic

### One shape for every gate

#### User story

The agent asks the user to approve something, or to choose between options, or to select several.

#### Business logic

Every gate renders the same way: an eyebrow reading "Your call", the question's title, and its options. A single-select gate shows each option as its own button, with the option's extra detail under its label. A multi-select gate shows each option as a checkbox, pre-ticking the ones the agent marked as default, and one Accept button below.

#### Rationale

There used to be three shapes — an approve/decline confirmation had its own green and red buttons — but an approval is just a question with two options, and giving it its own card only meant the agent had to know which of three blocks to emit.

### The recommended option is marked

#### User story

The user wants the agent's own suggestion to be obvious.

#### Business logic

In a single-select gate, the option the agent recommends is visually emphasised and labelled "Recommended". Accepting without choosing — via the keyboard shortcut — picks that recommended option, or the first option when the agent named none. In a multi-select gate, accepting picks exactly the boxes currently ticked.

### A multi-select says what Accept will do

#### User story

The user unticks everything and wants to know that this will be sent as "none".

#### Business logic

The Accept button's label states what it will post: how many options are selected, or "Accept none" when none are.

### The panel stays parked after answering

#### User story

The user picks an option and wants to know the agent has it.

#### Business logic

Once a pick is posted and the daemon accepts it, the options are disabled and the panel reports first that the choice is being sent, then that it has been sent and is waiting for the agent to pick it up. The panel disappears only when the agent's own event stream reports the gate resolved — or, for a gate carried in by the Claude web bridge, when the surface around it swaps the question for the state of the answer on its way to the cloud session. A gate that is asked again starts over with fresh state.

#### Rationale

Before this, the buttons simply greyed out with no word on why.

### Ctrl+Enter accepts, on one gate at a time

#### User story

The user has several gates open and wants the keyboard shortcut to be unambiguous.

#### Business logic

Ctrl+Enter (or its command-key equivalent) accepts the gate marked as active — the newest open gate in the agent's event log — and only that one; the hint "Ctrl+Enter to accept" is shown on that gate alone. The shortcut does nothing once a pick has been sent.

### Where the pick goes, and where it is shown

#### User story

The user answers a gate that belongs to one specific agent — which may be running on this machine, or may be a Claude Code cloud session this machine cannot steer.

#### Business logic

By default the pick is posted to the agent it belongs to, recorded as answered by the user rather than by autopilot; without an agent it falls back to the project's own control channel. A gate only ever reaches this panel when somebody is watching — an unwatched agent resolves its gates to the recommended option without one.

Where the pick is delivered can be swapped out for a gate that did not come from a local agent. A question the Claude web bridge carried in from a cloud session queues the pick for the browser extension to type back into that session, instead of writing it to a control channel no cloud session reads. Nothing else changes: the same panel, the same one click, the same multi-select and recommended option — which is the point, since a cloud session's question is a question like any other.

The panel appears in three places with identical behaviour and only a different container: as a rounded card inline in the agent's event log, in the pooled open questions list, and on the notice shown for an agent handed to a cloud session. The pooled list is told what was picked so it can collapse the answered gate to a single line; inline in the log no such notice is needed, because the gate-resolved event removes the panel there.

### A refused pick is reported and retryable

#### User story

The pick cannot reach the daemon.

#### Business logic

A failed post shows "Could not send your choice — try again." on the panel, and the options stay usable so the user can try again.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
