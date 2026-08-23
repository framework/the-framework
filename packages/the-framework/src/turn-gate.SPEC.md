The turn-boundary protocol: what an agent may tell The Framework in the final message of a turn, and how that message is read. The driver runs each turn as a black box, so this text — appended to the system prompt — plus the reading of the turn's last message is the framework's entire channel for learning that the agent stopped to ask, named its work, hit an error, wants a pull request, or is finished.

## User story

- The user is away. An agent hits a genuine fork in the road, parks the question on the dashboard as a choice, and the user answers it later — or autopilot answers it for them.
- The user watches an agent's card fill in as it works: the session name it picked, the views it pushed, the errors it hit, and finally the ready-for-merge badge.
- The user reviews the pull request the agent asked for and finds a title and a description the agent wrote, not a copy of the prompt.

## Glossary

- **signal block** - a fenced code block, tagged by name, that the agent writes into its turn's final message: `await-choices`, `show-markdown`, `set-session-name`, `open-pr`, `error`, `ready-for-merge`. The block is the whole channel; The Framework never inspects the agent's individual tool calls.
- **await round** - one cycle of the agent stopping to ask and being resumed with the user's pick.
- **span of turns** - the stretch of consecutive turns one caller runs under a single dedupe memory: a build and all its await rounds, or a whole backlog loop.

## Business logic — TL;DR

- **Protocol text on top of the system prompt** - four snippets that pin *how* to emit each signal; two of them are only told to agents that can use them.
- **One question shape for every gate** - a single `await-choices` block with N options covers approvals, plan reviews, multi-select and anything else; there are no gate kinds.
- **A bad block never breaks the agent** - gate parsing is deliberately forgiving, and anything unreadable is simply not a gate.
- **A pick that stops instead of resuming** - the agent can mark options whose meaning is "I will take it from here"; picking one ends the agent rather than resuming it.
- **A cap on stopping to ask** - after five await rounds the agent stops being gated and finishes.
- **One resume wording for every path** - every caller resumes a gated agent with the same sentence.
- **Non-blocking signals** - views, errors, session name, pull request, and ready for merge are recorded and reflected in the dashboard while the agent keeps going.
- **Each signal reported once per span** - repeating a block turn after turn does not repeat it on the dashboard.

## Business logic

### Protocol text on top of the system prompt

#### User story

The user gets an agent that reliably parks its questions and reports its state, without having to be told the mechanics themselves.

#### Business logic

Four protocol snippets are available for the system prompt. The **await protocol** pins how to emit a question the agent stopped on. The **signal protocol** pins how to emit the session name, ready for merge, errors, views, and a pull request. Both describe only the emission mechanics — *when* to use each one is the system prompt's business, not theirs.

Two more are conditional. The **hands-off protocol** is told only to a hands-off agent: gates do not exist in that session, so an ambiguous instruction should be read the most plausible way rather than parked on a question nobody attached can answer. The **browser protocol** is told only to an agent that has a browser: that it has one, and that anything it needs to see or act on goes through the browser rather than plain web fetching.

#### Rationale

The hands-off wording is framed as what is available in this session rather than as a rule, so that it disappears cleanly if gates ever become available there.

### One question shape for every gate

#### User story

The user answers every agent question through the same dashboard card, whether it is "approve this plan?", "which database?", "which of these files should I touch?" or "I need you to log in".

#### Business logic

A gate is one `await-choices` block carrying a title, a list of options, and optional extras: which option is **recommended** (the one autopilot accepts, and the one pre-selected for the user), whether any number of options may be picked rather than exactly one, and a markdown file the question is about — a plan under approval, which the dashboard renders beside the question. Each option carries a label, an optional one-line detail, an optional id the pick is posted back against, whether it starts checked in a multi-select, and whether picking it stops the agent.

#### Rationale

There used to be four question types — a single choice, a multi-select, a plan approval, and handing the browser over — each with its own block tag, parser, resolution path and dashboard card. Every one of them is a question with N options: approve/decline is two options, "handled it / could not" is two options, a plan approval is that pair with a file attached. One shape means the agent learns one block instead of four, and a new kind of question needs no new code at all.

### A bad block never breaks the agent

#### User story

The user's agent finishes its work even when it wrote a slightly malformed question — it does not crash, and it does not park on an empty one.

#### Business logic

The turn's last usable `await-choices` block is the question; blocks are considered newest first, so a malformed final block falls back to a good earlier one rather than losing the question entirely. Within a block: an option with no label is dropped, an option with no id gets one from its position, a blank title falls back to a generic "Which option?", and `recommended` is honored whether the agent named an option by its id or by its label. A block that is not valid JSON, or one whose options all fall away, is not a gate at all — the agent simply carries on. A turn with no `await-choices` block is the common case and flows straight through.

### A pick that stops instead of resuming

#### User story

The user is shown a plan, declines it, and gets the agent back for fresh instructions — instead of the agent building on the plan they just rejected.

#### Business logic

The agent marks options whose meaning is "stop, I will take it from here". Picking one ends the agent instead of resuming it, and the agent is told nothing further. The user sees a line naming the answer they picked, so the outcome reads as their decision rather than as a failure.

#### Rationale

Which answers mean "stop" is a property of the question, so the agent that wrote the question marks them, rather than the framework inferring it from a gate kind.

### A cap on stopping to ask

#### User story

The user is away, and an agent that keeps finding new things to ask still finishes rather than looping on questions.

#### Business logic

An agent may stop to ask and be resumed at most five times; past that its gates are no longer honored and it just finishes. The cap belongs to the protocol, so every path that runs gates shares the same one — a build, a direct prompt, and the backlog loop alike.

### One resume wording for every path

#### User story

The user's answer reaches the agent the same way no matter what the agent was doing when it asked.

#### Business logic

A resumed agent is told, in one sentence, what it paused to ask, what the user chose, and to continue with that decision. The caller's context is deliberately left out of it: the agent already knows what it is working on from its own session, so a clause that varied per caller carried no meaning to it, and one wording means a reword lands on every path at once.

#### Rationale

The resume prompt carries no "and do not ask that again" tail. A capable agent does not re-ask a settled question; spelling it out is babysitting, left off until an agent shows it is needed.

### Non-blocking signals

#### User story

The user watches an agent's dashboard card fill in while the agent keeps working: a named session, rendered notes, the errors it hit, a pull request request, and finally ready for merge.

#### Business logic

Five signals are read out of every turn and never stop the agent:

- **Views** — each `show-markdown` block becomes a rendered panel. A turn may carry several. The block's first heading line is the panel's title and the rest is its body; a block with no heading is titled "Note", and an empty one is skipped. Two blocks with the same title in one turn collapse to the later one, and re-showing an existing title updates that panel in place rather than adding another.
- **Session name** — the last `set-session-name` block wins, so an agent may rename its work mid-turn. Its first non-empty line is reduced to lowercase letters, digits and dashes, which is the shape a branch name needs. A block that reduces to nothing sets no name; a name is judged empty on its own merits, so a session legitimately named the same as one of the framework's own fallback words is not mistaken for an unnamed one.
- **Pull request** — the last non-empty `open-pr` block is read like a commit message: the first line names the work and the rest describes it. A first line longer than 100 characters is not a name but a paragraph, so the whole block becomes the description and the title falls back to the session name. Writing no block at all simply leaves the handoff to describe the work itself.
- **Errors** — every non-empty `error` block is kept, in the order written; the first line is the headline and the rest is the detail. Empty blocks are skipped.
- **Ready for merge** — a `ready-for-merge` block anywhere in the turn, with no body, flips the agent from building to ready for review.

#### Rationale

Errors are the one signal where every block is kept rather than only the last: two different things going wrong in one turn are two errors, and keeping only the last would lose one.

The `open-pr` block is how an agent opens a pull request *through* The Framework instead of reaching for the GitHub CLI itself. The title and the description are the agent's; the framework keeps the parts that have to stay consistent — the ticket's issue reference and recording the pull request number onto the agent. The title-length limit exists because the title becomes a squash-merge subject: without it, a raw prompt pasted into the block became a permanent commit subject running to a paragraph.

### Each signal reported once per span

#### User story

The user sees one entry per thing that happened, not one per turn in which the agent restated it.

#### Business logic

Signals are read on every turn the framework prompts, because the protocols are unconditional — the agent is told it may signal on any turn, so any turn left unread would drop a signal. Across a span of turns, ready for merge fires once; the session name and the pull request are re-emitted only when they actually change; and an error is reported once however often the agent restates it, keyed by its full text so that a second attempt failing differently is still its own error. Each caller keeps one dedupe memory for as many turns as should share it — a build together with its await rounds, or a whole backlog loop.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
