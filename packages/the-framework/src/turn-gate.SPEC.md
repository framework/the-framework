The turn-boundary contract with the wrapped agent: each turn runs as a black box, so everything the framework learns — the agent stopping to ask, views to show, its chosen session name, ready-for-merge, a pull-request description — is a tagged block parsed out of the turn's final message.

## User Stories

- The user answers the agent's question, and the agent resumes the same conversation.
- The user's answer can end the agent instead of resuming it — declining a plan stops the run.

## Flows

- The protocol texts appended to the system channel pin how to emit, not when: one blocking ask-gate and the non-blocking signals (markdown views, session name, ready-for-merge, a pull-request description).
- There is one gate block, not four: every gate is a question with options, and what distinguishes the kinds is what the agent writes in one — two options for an approval, a file for a plan, a flag for several picks, a mark on the options that end the agent rather than resuming it.
- Parsing is tolerant on purpose: a malformed block is ignored rather than crashing an agent, the block appearing latest in the turn wins (falling back past a broken one), and missing ids and titles get sensible defaults. A block with nothing pickable in it is not a gate — the agent carries on rather than parking on an empty question.
- One continuation wording resumes the agent after any answered gate, and a shared cap on ask-rounds stops an agent that keeps asking.
- Signal emission is deduped across a span of turns: ready-for-merge fires once, and a session name or a pull-request description re-emits only on a real change.
- An agent names and describes its pull request in a block instead of opening one itself, written like a commit message: the first line is the title the end-of-agent handoff publishes, the rest is the body, and the last block the agent wrote is the one used. A first line too long to be a name for the work is read as body text instead, so a paragraph never becomes a pull request title.

## Rationales

- One gate block instead of a tag, a parser, and a card per question kind: a single choice, several picks, an approval, and handing over a browser are all a question with options, so a new kind of question needs no new code.
- The pull-request description is offered as a capability rather than the agent being told not to open its own: an agent that describes the work and lets the framework publish it keeps the title, the ticket's issue reference and the recorded pull-request number, and an agent that prefers its own way is not stopped.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
