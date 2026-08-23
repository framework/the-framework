Told only to a hands-off agent, right after the await protocol it amends: this agent was handed somewhere nothing local can steer, so it must never park at a gate, and everything it produces has to land in the repository as a pull request rather than in a conversation nobody will read.

## User story

- The user hands a task to a cloud session and closes the dashboard. An agent that stops there to ask a question waits forever, because nothing attached can answer it.
- The user's only view of that work is what comes back as a pull request. Analysis that stayed in the remote conversation is analysis they never see.

## Business logic — TL;DR

- **Decide alone** - where the instructions say to show options and await, the agent takes the most plausible reading, states the assumption it made in one line, and carries on without emitting a gate.
- **The non-blocking signals still apply** - showing a document, setting the session name and signalling ready for merge are unaffected.
- **Land everything** - before ending, the agent commits on its agent branch and opens a pull request; a deliverable that is analysis, a plan or a decision is written into committed files.
- **No pull request is the exception, and must be said** - the agent ends without one only when the task genuinely required no repository change, and states that explicitly in its final message.

## Business logic

### Decide alone

#### User story

See `## User story`: nothing that can answer a gate is attached to this agent, and no machine sees its workspace.

#### Business logic

The prompt tells the agent outright that it runs detached. Wherever its other instructions say to show choices, show a multi-select or show a document and then await, it must not emit the await block and must not stop. Instead it takes the most plausible interpretation — the option it would have marked as recommended — states in one line which assumption it made, and carries the work through to the end.

The non-blocking blocks are explicitly unaffected: showing a document, setting the session name, and signalling ready for merge all still apply.

#### Rationale

This is worded as an availability — the gates are not available in this session — rather than as a standing rule, so it can be deleted cleanly once gates become available per session instead of per target.

### Land everything

#### User story

See `## User story`: the pull request is the only channel back to the user.

#### Business logic

Before ending, the agent commits its work on its agent branch and opens a pull request for it. When the deliverable is analysis, a plan, or a decision rather than code, it writes that into committed files — the prompt states plainly that a result living only in the conversation, or in a gitignored file, reaches nobody.

Ending without a pull request is allowed only when the task genuinely required no repository change, and the agent must say so explicitly in its final message.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
