Reads the turn signals [1] off a turn's [2] final message, the one place The Framework learns anything from an agent [3]: the markdown views [4] it pushed, the errors it reported, the ready-for-merge [5] signal, the pull request it asked for, and the gate [6] it stopped at. It also fixes the four protocol texts that tell the agent how to emit each of those, the await limit [7], and the exact wording that resumes or stops an agent once a gate is answered. Parsing is tolerant by design: a malformed block is ignored, never a reason to fail the agent.

## Context

**User story**: the user watches an agent [3] on its agent view: a plan appears in the right rail while the agent keeps working, an error is counted on the agent without the user reading the whole event stream, the badge flips from building to ready, the pull request opens under the agent's own title, and when the agent stops to ask, a card shows the question with the recommended option highlighted.

**Problem**: the driver [8] runs each turn [2] of the coding agent [9] as a black box, so nothing the agent decided is visible until its final message. Every signal therefore travels as a fenced code block in that message, tagged by kind. The protocols that teach the agent these blocks pin only how to emit them; when to act is the built-in system prompt's [10] business. Every turn The Framework prompts is read this way, because the agent is told it may signal on any turn, and a turn left unread would drop the signal.

## Glossary

[1] turn signals: what The Framework reads off a turn's final message: the ready-for-merge signal, the pull request title and body, markdown views, reported errors, and the gate it stops at.
[2] turn: one prompt sent to the driver; the coding agent's own loop runs to completion and answers with a final message.
[3] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends. Started from the dashboard by the user, or by the daemon.
[4] view: a markdown document an agent pushes to the dashboard's right rail while it works.
[5] ready for merge: the signal an agent emits when it believes its work is complete: it flips the agent's badge from building to ready and authorizes the handoff.
[6] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent. When nobody can answer, the recommended option is taken.
[7] await limit: the cap on consecutive gates within one exchange; an agent still asking past it finishes with its latest turn.
[8] driver: a coding agent wrapped as a black box: start it in a directory, prompt it for one turn, stream what it does, resume it later.
[9] coding agent: the CLI doing the actual work: Claude Code or Codex.
[10] the built-in system prompt: the standing instructions every agent starts with (`prompts/system_prompt.md`); `SYSTEM.md` is the project's own instructions added on top.
[11] hands-off: said of an agent whose work leaves this machine, so its first prompt is the whole agent: an agent whose location is `web`.
[12] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[13] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[14] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[15] vanilla: an agent started without the built-in system prompt but with the signal protocols kept.
[16] stop: ending an agent before it finishes: the Stop button, Ctrl-C, or a pick marked to stop.
[17] skill: one of the four capabilities an agent is taught — `branches`, `tickets`, `queue`, `logs` — each a package with the instructions the agent reads, a command on the agent's PATH, and an API the product calls.
[18] handoff: what happens to an agent's work when the agent ends, as one ladder of four levels: `local` (keep the work in its checkout), `push` (push its branch), `pr` (also open a pull request — the default), `merge` (also merge it).
[19] unattended: said of an agent nobody is watching: its gates take the recommended option and it ends when its work settles.
[20] build agent / prompt agent: the two kinds of agent: a build works the agent queue after its opening exchange; a prompt agent runs one prompt and stops there.
[21] backlog loop: after a build agent's opening work settles, the loop that works the agent queue one entry per turn until it is empty.
[22] driver session: the coding agent's own conversation for one agent, which the driver can resume by its session id.
[23] the bridge: the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[24] live chat: the user's own messages to a running agent, each continuing the same driver session.
[25] event: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.

## Business logic — TL;DR

- **The protocols the agent is taught** - four texts pin how to emit a gate, a view, ready for merge, a pull request and an error, and what an agent with a browser or a hands-off agent may do; the session name is not a signal.
- **Markdown views** - every `show-markdown` block becomes a view titled by its first heading, "Note" without one; blank blocks are skipped, and a repeated title updates the same view in place.
- **The pull request the agent asks for** - the last non-empty `open-pr` block, read like a commit message; its first line is the title only when it is 100 characters or shorter, else the whole block is the description.
- **Reported errors** - every non-empty `error` block, in order, first line the headline and the rest the detail; an empty block is no error.
- **Ready for merge** - a `ready-for-merge` block anywhere in the message, with or without a body.
- **The gate the turn stops at** - the last usable `await-choices` block: a JSON object with at least one labeled option, ids synthesized when missing, the recommendation matched by id or label, a blank title replaced by "Which option?"; a malformed block is ignored.
- **The await limit** - five gates per exchange, shared by every path that runs gates.
- **Answering a gate, in fixed words** - one continuation wording resumes the agent with the pick; a stopping pick logs a message to the user, or, for a cloud session, tells the agent the user is taking over.
- **One reader per span of turns** - views are emitted every turn they appear; an identical error is reported once; ready for merge fires once; the pull request is re-emitted only when it changes.

## Business logic

### The protocols the agent is taught

#### Context

**Business logic story**: the system channel composed in `system-prompt.ts` ends with these texts. They are the emit contract an agent [3] keeps even when the built-in system prompt [10] is switched off (vanilla [15]): without them nothing the agent signals could be read.

#### Business logic

Four texts, each a markdown file under `prompts/protocols/`, are handed to the system channel, and each pins how, never when:

- The await protocol (`await.md`): how to stop and ask through one `await-choices` block that ends the turn [2], whatever the question is about; how to mark the option that is safe to take when nobody is there, and the option whose pick [13] ends the agent [3] instead of resuming it; how to hand a browser over to the user at a login wall, a captcha or a sign-in step, with the same block; and how to show a document in the right rail without waiting, through a `show-markdown` block.
- The signal protocol (`signal.md`): how to emit ready for merge [5] as an empty block that flips the dashboard status without stopping the turn; the `open-pr` block that should ride with it, written like a commit message; and the `error` block for something only the user can fix, reported once.
- The browser section (`browser.md`), only for an agent with a real browser attached: that it has one, and that anything it must see or act on goes through the browser tools rather than a plain fetch.
- The hands-off section (`hands_off.md`), only for a hands-off [11] agent: nothing on a machine follows it, so it must commit its work and open a pull request before it ends.

Every signal but the gate [6] is non-blocking: the agent emits the block and keeps going, and The Framework records it and reflects it in the dashboard. The session name [12] is not a signal: the agent names its branch through the `branches` skill [17], and The Framework reads the name off the branch. The instructions themselves are described with the prompt files.

### Markdown views

#### Context

**User story**: while an agent [3] works, a plan, a summary or a write-up appears in the right rail of its agent view; the agent does not stop for it, and re-showing the same title replaces the earlier document instead of adding a second one.

#### Business logic

Every `show-markdown` block in the message yields a view [4], so one turn [2] may carry several. When the block's first line is a markdown heading (`# ...`), that heading, trimmed, is the view's title and the lines below it are the body; a block without a heading is titled "Note" and its whole content is the body. A blank block is skipped, and so is a block whose body is empty once the heading is removed. The view's id is a slug of its title: lowercased, every run of characters outside `a-z` and `0-9` replaced by one `-`, leading and trailing dashes dropped; a title with no usable character gets the id `view`. Two blocks in the same turn with the same id keep the later one, which is how an agent updates a view within a turn; across turns, the same id updates the view in place on the dashboard. Reading views never fails.

### The pull request the agent asks for

#### Context

**User story**: an agent's [3] pull request opens under the agent's own title and description, not under a repeat of the prompt it was given; the agent may revise them as the work changes.

**Problem**: the pull request's title becomes the squash-merge subject, so a first line that runs to a paragraph must not be cut mid-sentence into a permanent commit subject.

#### Business logic

The pull request is read from the last non-empty `open-pr` block of the message, so the latest of several wins. A message without one yields nothing, and the handoff [18] then describes the work itself. The block is read like a commit message. When its first line, trimmed, is 100 characters or shorter, that line is the title, and everything below it, trimmed, is the description, omitted when empty. When the first line is longer, the agent wrote a paragraph and not a name: the block has no title and the whole block, trimmed, is the description, leaving the handoff to name the pull request after the session name [12] rather than after a cut-off sentence. The block carries only the agent's part: the handoff adds what has to stay consistent, the ticket's issue reference and the pull request number recorded on the agent.

### Reported errors

#### Context

**User story**: an agent [3] hits something only the user can fix, a missing file it was told to read, a command that will not run, a login it does not have; the user sees it marked in the event stream and counted on the agent without reading everything.

#### Business logic

Every non-empty `error` block, in the order written, is one error: its first line, trimmed, is the headline, and everything below it, trimmed, is the detail, omitted when empty. Unlike the other signals, every block is kept and not only the last: two things going wrong in one turn [2] are two errors. An empty block is skipped, since an error with nothing to say is not an error. Reporting an error does not stop the turn and asks the user nothing; a question goes through a gate [6].

### Ready for merge

#### Context

See `## Context`.

#### Business logic

The signal is the presence of a `ready-for-merge` block anywhere in the message, empty or with a body; it has nothing to read and is a plain yes or no. It does not stop the turn [2]: it flips the agent [3] from building to ready for merge [5], and the handoff [18] is what acts on it.

### The gate the turn stops at

#### Context

**User story**: an agent [3] stops to ask; the dashboard shows the question as a card with its options, the recommended one preselected, and the pick [13] re-prompts the agent. Unattended [19], the recommended option is taken.

**Problem**: a bad block must never crash the agent, and an empty question must never park the agent waiting for an answer nobody can give.

#### Business logic

The gate [6] is read from the last usable `await-choices` block of the message: the blocks are tried newest first, so a malformed last block falls back to a good earlier one rather than losing a good question to a bad one after it. A message with no usable block means the agent [3] simply finished, the common case, and the turn [2] flows straight through.

A block is usable when its body is a JSON object with an `options` list, and at least one option survives these rules:

- An option needs a non-blank `label`, trimmed; an option without one is dropped.
- Its `id` is trimmed; when absent, it is synthesized from the option's position in the agent's list (`opt:<position>`, counted from zero), so the pick [13] can always be posted back against something stable.
- Its `detail`, trimmed, is kept when non-blank.
- `default` (the option starts checked, meaningful on a gate that takes several picks) and `stop` (picking it ends the agent instead of resuming it, the mark for an answer that rejects the work) are kept only when exactly true.

When no option survives, the block is not a gate: the agent carries on rather than parking on an empty question. Of the rest of the block: `recommended`, trimmed, names an option by id or, failing that, by label, and is kept as that option's id; a name matching nothing is dropped. `multi` is kept only when exactly true. `file`, trimmed, is kept when non-blank: the markdown file the question is about, a plan under approval, which the dashboard shows beside the question. The `title` is trimmed, and a blank one becomes "Which option?". A body that is not JSON, not an object, or has no options list is ignored. Reading a gate never throws.

### The await limit

#### Context

**Problem**: an agent [3] that keeps asking would otherwise be resumed forever; and a build, a prompt and the backlog loop [21] each running gates [6] must not each set a cap of their own.

#### Business logic

The await limit [7] is five: an agent [3] may stop to ask and be resumed with the pick [13] at most 5 times within one exchange, and one still asking past that finishes with its latest turn [2]. The cap belongs to the await protocol, so every path that runs gates [6] shares it: a build agent's [20] opening exchange, a prompt agent, and the backlog loop [21]. The rounds themselves are run in `await-gate.ts`.

### Answering a gate, in fixed words

#### Context

**Problem**: the agent [3] already knows what it is working on from its driver session [22], so the wording that resumes it carries no per-path clause. A stopping pick [13] means the user is taking over: a local agent is never told and simply ends, but a cloud session [14] lives on claude.ai, where nothing on this machine can end it, so the bridge [23] must type the decision in.

#### Business logic

Three fixed wordings:

- The continuation prompt, what re-prompts the agent [3] after a pick [13]: `You paused to ask: "<the question>". The user chose: <the pick>. Continue with that decision.` It is one wording for every path that runs gates [6], and it carries no "do not ask again" tail: a capable agent does not re-ask a settled question.
- The takeover prompt, what the bridge [23] types into a cloud session [14] when the user picks an option marked `stop` [16]: `You paused to ask: "<the question>". The user chose: <the pick>. Stop here: the user is taking over and will come back with fresh instructions.`
- The stop message, written to the event stream for the user, never sent to the agent, when a pick marked `stop` ends a local agent: `Stopped at your answer: <the pick>. Awaiting your instructions.` It names the pick because "stopped" alone reads as a failure when it was a decision.

### One reader per span of turns

#### Context

**Problem**: agents [3] restate their blocks turn [2] after turn, and the same failure logged ten times reads as ten failures; a repeated ready-for-merge [5] signal must not flip the agent twice; an unchanged `open-pr` block must not re-announce the pull request.

#### Business logic

Every turn [2] The Framework prompts is read by one reader that keeps state across the turns it covers, and each caller keeps one reader for the whole span whose turns should share that state: the opening exchange together with its live chat [24] (`agent.ts`), or the whole backlog loop [21] (`todo-loop.ts`). Each turn is read in this order:

- Every view [4] becomes a view event [25], every time it appears.
- Every reported error becomes an error event, except one whose headline and detail both match an error already reported in the span, which is ignored; a second attempt that fails differently is still its own error.
- The ready-for-merge [5] event is emitted the first time the signal appears in the span and never again.
- The pull request the agent [3] asked for is emitted as an event only when its title and description differ from the last ones emitted in the span.
