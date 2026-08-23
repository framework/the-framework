Pins how an agent parks at a gate: one fenced block at the end of its turn, in one shape for every question it could ever stop to ask, so The Framework can detect the gate, show the choice, and resume the agent with the user's pick. Also covers the two things that ride on the same block — handing a stuck browser to a human, and pushing a document to the dashboard without stopping.

## User story

- The user is the one who decides. Whenever the agent's instructions say to show options and wait, the agent hands the decision over instead of taking it.
- The user is often not there. A gate must carry which option is safe to take on their behalf, so an unattended agent keeps moving rather than parking forever.
- The agent hits a login wall or a captcha in its browser. The user wants to be asked to step in, not to have the agent type credentials it found lying around.
- The user wants to read the agent's plan or writeup while it keeps working, not only when it stops.

## Glossary

- **await block** - the fenced `await-choices` block, carrying the question and its options as data, that an agent ends its turn with to park at a gate. The Framework reads the turn's final message for it; there is no other way for an agent to ask.

## Business logic — TL;DR

- **One block, every question** - an approval, a multi-select, a plan sign-off and a browser hand-over are all the same await block with different fields, and the agent ends its turn with it and stops.
- **The question carries its own answer for nobody** - the recommended option is what The Framework picks when nobody is there, so it must be the one that is safe to take unattended.
- **An option can end the agent instead of resuming it** - the answer that rejects the agent's work is marked as stopping, and the agent is never re-prompted with it.
- **A document can be attached to the question** - a plan or writeup the agent wants signed off is named on the block, and the dashboard shows that file beside the question.
- **A stuck browser is handed to the human, never forced** - the agent never types a password, attempts a captcha, or uses a credential it found; it asks with the same block and does not retry a page the human could not unblock.
- **Showing a document does not stop the agent** - a markdown block anywhere in a turn displays in the dashboard's side panel and keeps the agent working; re-using a title updates that view in place.

## Business logic

### One block, every question

#### User story

See `## User story`: the user decides, and The Framework has to be able to tell "the agent stopped to ask" from "the agent finished".

#### Business logic

When the agent's instructions tell it to show choices, show a multi-select, or show a document and then await, it must not decide for the user. It ends its turn with a single fenced `await-choices` block and stops. The block states the question, the options to pick between — each with a label and an optional one-line detail — and which option is recommended.

Every question the agent stops to ask is that one block, whatever it is about. An approval is simply two options. Several answers at once is the same block marked as multi-select, with the entries that start checked marked as defaulted.

The Framework then shows the question, waits for the user, and re-prompts the agent with their answer. The agent must not continue past a gate on its own.

#### Rationale

Collapsing every kind of question into one block means the agent learns one thing rather than one per question type, and a new kind of question needs nothing new on either side.

### The question carries its own answer for nobody

#### User story

See `## User story`: unattended agents must not park on a question nobody will answer.

#### Business logic

The recommended option is explicitly described to the agent as what The Framework picks when nobody is there to answer. The agent is therefore told to name the option that is safe to take unattended — and never an option marked as stopping.

### An option can end the agent instead of resuming it

#### User story

When the user rejects an approach or declines a plan, their next move is fresh instructions. Continuing on the rejected plan is the worst possible use of the time.

#### Business logic

An option may be marked as stopping, which means picking it ends the agent rather than resuming it: the user is taking over and will come back with fresh instructions. The agent marks the option that rejects its work — declining a plan, saying no to the approach — and leaves the mark off everything else. It is told it will not be re-prompted with that answer, so it must not plan around being told it.

### A document can be attached to the question

#### User story

Approving a plan means reading the plan.

#### Business logic

A plan or document the agent wrote and wants signed off is named on the same block, and The Framework shows that file beside the question.

### A stuck browser is handed to the human, never forced

#### User story

See `## User story`: an agent working in a browser reaches a login wall, a captcha, or an SSO or two-factor step.

#### Business logic

At such a point the agent stops and hands the browser over. Three things are forbidden outright: typing a password, attempting a captcha, and using a credential found lying around in the repo or the environment.

It asks with the same await block, naming both what the human needs to do and the page it is stuck on, offering "handled it" and "could not handle it", and recommending the one that is true when nobody is there — that it was not handled. The user acts in that browser and the agent is re-prompted with their answer. If the answer says it was not handled, the agent must not retry the same page: it says what it could not reach and works on what it can, or stops.

### Showing a document does not stop the agent

#### User story

See `## User story`: the user wants to read a plan, summary or writeup while the agent keeps going.

#### Business logic

To display markdown in the dashboard's side panel without blocking, the agent puts a `show-markdown` block anywhere in its turn; the block's first line is the view's title and the rest is its body. This only shows the document — the agent does not stop. Emitting the same title again updates that view in place rather than adding a second one.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
