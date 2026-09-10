Lists every open question [1] across all projects in one place, longest waiting first: each running agent [2] parked on a gate [3], with the whole gate so the pick [4] can be made from wherever the card is rendered, and each question a cloud session [5] is parked on as the Claude web bridge [6] reports it. A local question is answered through the agent's control file [7]; a bridged one is typed back into the cloud session by the bridge.

## Context

**User story**: several agents [2] are running and more than one is waiting for the user. Instead of opening each agent view to find the one that is blocked, the user sees every open question [1] across projects in the launcher's hub, with its options, its recommended option and whether several options may be picked, and answers it right there.

**Problem**: an agent's live record names only the id and title of the gate [3] it is parked on, which is all the sidebar's badge needs; the options, the recommended option and the detail lines are in the gate's event in the agent's event stream [8]. A web agent's question is in no local event stream at all: the bridge [6] holds it. And offering an answer the daemon would refuse, because the gate is already resolved, is worse than one card fewer.

## Glossary

[1] open question: a gate nobody has answered yet, as the dashboard lists them across projects.
[2] agent: the unit of work: one task worked by a coding agent under The Framework's control — in its own checkout, on its own branch, streaming events, handed off when it ends.
[3] gate: a question with options at which an agent stops and waits for an answer: it emits the question in its turn's final message, the dashboard shows it as a card, and the answer re-prompts the agent.
[4] pick: the answer to a gate: the option or options chosen, by the user or automatically.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] the Claude web bridge (the bridge): the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the pick back into the session.
[7] control file: `.the-framework/control.jsonl`: the file the daemon appends steering to (stops, picks, chat messages) and the agent's process tails.
[8] event stream: everything an agent does, one event per line appended to `.the-framework/events.jsonl` in its checkout; every surface (dashboard, terminal, archive, run) is a projection of it.
[9] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[10] session name: the name an agent gives its own work (`[a-z0-9-]+`); its branch is renamed to `agent-<session name>` and the dashboard labels the agent by it.
[11] archive: the transient copy of a finished agent's events and status under a project's `.the-framework/agents/`.
[12] handoff: what happens to an agent's work when the agent ends.

## Business logic — TL;DR

- **A local agent's open question** - every running agent parked on a gate contributes one card carrying the whole gate, read from the agent's own event stream, and is skipped when that stream no longer shows the gate open.
- **A cloud session's question, from the bridge** - every question the bridge still holds without an answer on its way is joined to the web agent whose record names that cloud session, one card per question across projects, answered back through the bridge.
- **Longest waiting first** - the cards are ordered by when the agent last spoke, oldest first, so the agent blocked the longest is the one to unblock first.
- **A failed read costs one card, never the page** - an unreadable project, agent list or event stream contributes nothing.

## Business logic

### A local agent's open question

#### Context

See `## Context`.

#### Business logic

For each project, every live agent [2] whose status is running and whose record names a pending gate [3] is looked at. The agent's event stream [8] is read from the agent's own checkout [9], not from the project's root, because an agent the daemon started writes its events in its checkout. The gate counts as open when its question event has no later resolution event with the same id; the question is kept whole, with its options, whether several may be picked, the recommended option and the detail lines. When the event stream no longer shows the gate open, because it was resolved in the meantime or the stream cannot be read, the agent contributes no card. A card carries the project's id and name, the agent's id, the session name [10] when the agent's branch carries one, what the agent was asked to do as the label for an agent that never named itself, the time the agent last spoke, and the gate. The pick [4] on such a card goes to the agent through its control file [7] (`../dashboard-rpc/`).

### A cloud session's question, from the bridge

#### Context

**User story**: a web agent's cloud session [5] stops on a question on claude.ai. The extension carries it into the dashboard and the user answers it next to the local agents' questions, without visiting claude.ai.

**Problem**: a web agent is done at its handoff [12] and its checkout [9] may be long gone, so only the project's full agent list, archive [11] included, can name the agent a bridged question belongs to.

#### Business logic

The questions the bridge [6] holds are taken minus those with an answer already on its way. When there is at least one, every agent [2] of each project is read, archive [11] included, and each web agent whose record names a cloud session [5] is joined to the bridge question for that same cloud session. One card is made per question: two projects that are working copies of one repository share their agents' records, so the first project to find a question claims it and the next project skips it. The card's gate [3] is built from the bridge question by the rules in `bridge-question.ts`; the ids of its options are the option labels, which is what the extension types into the session. The card's waiting time is when the bridge received the question, not the agent's handoff. The card also carries the cloud session's id and its URL, `https://claude.ai/code/<session id>`, and a pick [4] on it goes back through the bridge rather than through the agent's control file [7].

### Longest waiting first

#### Context

See `## Context`.

#### Business logic

All cards, local and bridged, are ordered by their waiting time, oldest first: for a local card the time the agent [2] last spoke, for a bridged card the time the bridge [6] received the question. A card with no time sorts first.

### A failed read costs one card, never the page

#### Context

See `## Context`.

#### Business logic

A project whose live agents [2] cannot be read, an agent whose event stream [8] cannot be read, and a project whose full agent list cannot be read each contribute nothing; the rest of the list is unaffected.
