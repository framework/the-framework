The await protocol: the exact syntax an agent [1] must emit in a turn's [2] final message for the three things the built-in system prompt only names, so that The Framework can read them off the message. A question the agent stops at is one fenced `await-choices` block ending the turn, which becomes a gate [3]; handing a browser to a human is the same block with two fixed options; a document shown without waiting is a `show-markdown` block, which becomes a view [4]. Every agent receives it, vanilla [5] ones included, since it is the contract the dashboard's cards depend on; only a transparent agent does not.

## Context

**User story**: when the agent [1] needs a decision, the user sees a card in the dashboard with the question, the options, an optional one-liner under each, and the recommended one preselected; a plan under approval is shown beside the question. Answering re-prompts the agent with the pick [6]; choosing the option that rejects the work ends the agent instead. When nobody answers, the recommended option is taken. A document the agent wants to share without stopping appears in the right rail and updates in place.

**Business logic story**: the coding agent runs a turn [2] to completion as a black box, so the only way The Framework learns that the agent stopped to ask, rather than decided on its own, is a signal in the turn's final message. The composition rule in `src/system-prompt.ts` appends this protocol to every agent's system channel except a transparent one; what The Framework reads off the final message is the rule in `src/turn-gate.ts`, summarized below per signal.

## Glossary

[1] agent: the unit of work: one task worked by a coding agent under The Framework's control, in its own checkout, on its own branch, streaming events, handed off when it ends.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[4] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[5] vanilla: an agent started without the built-in system prompt but with the signal protocols kept. transparent: an agent started with nothing of The Framework's, the raw coding agent.
[6] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[7] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[8] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[9] await limit: the cap on consecutive gates within one exchange; an agent still asking past it finishes with its latest turn.
[10] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.

## Business logic — TL;DR

- **Awaiting a choice** - when told to show choices and await, the agent never decides for the user: it ends its turn with one `await-choices` block carrying the question, the options, and a recommended option safe to take unattended, and stops until re-prompted with the pick.
- **One block for every question** - an approval is two options with the rejecting one marked to stop; a plan to sign off names its file; several answers at once is a multi-select with pre-checked entries; a stop option ends the agent with the user taking over.
- **Handing the browser to a human** - at a login wall, a captcha or a two-factor step the agent stops and asks with the same block, "Handled it" or "Could not handle it", recommending the latter; it never types a password, attempts a captcha or uses a credential it found.
- **Showing a document without waiting** - a `show-markdown` block anywhere in the turn, its first line the title, becomes a view in the right rail without stopping the agent, and re-emitting the same title updates it in place.

## Business logic

### Awaiting a choice

#### Context

See `## Context`.

#### Business logic

When its instructions tell the agent [1] to show choices, show a multi-select or show a document and then await, the agent does not decide for the user. It ends its turn [2] with one fenced block tagged `await-choices`, then stops. The block is JSON with:

- `title`: the question.
- `options`: the options, each with a `label` and an optional one-line `detail`.
- `recommended`: the label to default to.

The agent is told that The Framework shows the block, waits for the user, and re-prompts it with the answer, and that it must not continue past the block on its own.

What The Framework does: the last usable `await-choices` block of the final message is the gate [3]. The parse is tolerant so that a bad block never breaks an agent: an option without a label is dropped, a missing title reads "Which option?", the recommended option may be named by label or by id, a malformed block is ignored, and a block left with no option is no gate at all, so the agent simply carries on. The dashboard shows the gate as a card; the pick [6] re-prompts the agent with "You paused to ask: "<question>". The user chose: <answer>. Continue with that decision." An unattended [7] agent gets the recommended option. An agent may stop at most five consecutive gates in one exchange, the await limit [9]; past it, it finishes with its latest turn.

### One block for every question

#### Context

**Problem**: every question an agent [1] asks is one question with some options; giving approvals, multi-selects, plan sign-offs and browser handovers each their own syntax would mean four things for the agent to learn and four cards for the dashboard to render, for no difference in what the user does.

#### Business logic

Whatever the question is about, it is this one block, shaped by four optional additions:

- An approval is two options, for instance "Approve" and "Decline", with the declining one marked `"stop": true` and "Approve" recommended.
- A plan or document the agent wrote and wants signed off adds `"file"`, for instance `PLAN_<slug>.agent.md`; The Framework shows that file beside the question.
- Several answers at once, the multi-select, adds `"multi": true`, and `"default": true` on the entries that start checked.
- `recommended` is what The Framework picks when nobody is there to answer, so the agent must name the option that is safe to take unattended [7], and never an option marked to stop.
- `"stop": true` marks an answer that ends the agent instead of resuming it: the user is taking over and will come back with fresh instructions. The agent marks the option that rejects its work, declining a plan or saying no to the approach, and leaves it off everything else. It is not re-prompted with that answer, so it must not plan around being told it.

What The Framework does with a stop [8] pick [6]: a local agent is not re-prompted and ends, and its log says "Stopped at your answer: <answer>. Awaiting your instructions."; a cloud session [10], which nothing on the machine can end, is instead told "You paused to ask: "<question>". The user chose: <answer>. Stop here: the user is taking over and will come back with fresh instructions."

### Handing the browser to a human

#### Context

**User story**: an agent [1] browsing with a real browser reaches a login page, a captcha, a single sign-on or a two-factor step; the user gets a card naming the page, does the step in that browser, and answers "Handled it", after which the agent continues on the page it was stuck on.

**Problem**: an agent that typed a password, solved a captcha or reused a credential it found in the repository or the environment would be acting as the user without the user's say; such steps are the user's alone.

#### Business logic

When the agent [1] works in a browser and hits something it cannot or should not get past itself, a login wall, a captcha, an SSO or two-factor step, it stops and hands the step over. It never types a password, never attempts a captcha, and never uses a credential it found lying around in the repository or the environment.

It asks with the same `await-choices` block: the title names what the human needs to do and the page it is stuck on; the options are "Handled it" and "Could not handle it"; the recommended option is "Could not handle it", the one that is true when nobody is there. The user acts in that browser, then the agent is re-prompted. When the answer says it was not handled, the agent does not retry the same page: it says what it could not reach and works on what it can, or stops.

### Showing a document without waiting

#### Context

**User story**: while an agent [1] works, a plan, a summary or a writeup it wants to share appears in the dashboard's right rail, and a later version replaces it in place instead of piling up.

#### Business logic

To display markdown without blocking, the agent [1] puts a `show-markdown` block anywhere in its turn [2]. The block's first line, a level-one heading, is the title; the rest is the body. This only shows the document: the agent does not stop, and it keeps working. Re-emitting a block with the same title updates that view [4] in place.

What The Framework does: every `show-markdown` block of the final message becomes a view; a block with no heading is titled "Note"; a blank block, or one with a heading and no body, is skipped; two blocks whose titles reduce to the same id are one view, the later block winning, which is how an in-turn update lands.
