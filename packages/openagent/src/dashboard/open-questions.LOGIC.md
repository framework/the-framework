Lists every open question [1] across all projects in one place, longest waiting first: each agent [2] that ended waiting on its question [3], with that question, and each question a cloud session [5] is parked on as the Claude web bridge [6] reports it, under the web agent that cloud session belongs to. The list sends no answer: the dashboard shows each card as a row that opens its agent, and the question is answered on the agent's page.

## Context

**User story**: several agents [2] were started and more than one ended waiting for the user. Instead of opening each agent view to find the one that is blocked, the user sees every agent that waits on an open question [1] across projects in the launcher's hub, one row each with the question's title, opens the one to unblock, and answers on that agent's page.

**Problem**: an agent's card says only that the agent is `waiting`; the question [3] itself, with its options, the recommended option and the detail lines, is a line of the agent's diary [8]. A web agent's question is in no local event stream at all: the bridge [6] holds it. And listing a question nobody can answer any more, because the agent already went on, is worse than one card fewer.

## Glossary

[1] open question: a question nobody has answered yet, as the dashboard lists them across projects.
[2] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. OpenAgent starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[3] question: what an agent's turn ended on, asking the user to choose between options; the agent ends `waiting`, its checkout kept, and the answer resumes it. A cloud session's question is the one the bridge reports.
[5] cloud session: a Claude Code cloud session on claude.ai, the far end of a `web` agent.
[6] the Claude web bridge (the bridge): the daemon's bridge endpoints plus the Chrome extension: carries the question a cloud session is parked on into the dashboard, and types the user's answer back into the session.
[8] diary: what an agent said and did, one line per event: `<id>.jsonl`, in the agent's checkout while it has one, on the `agent-data` branch once recorded; read as events through `store/agent-store.ts`.
[9] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, named as its branch.
[11] recorded agents: the agents on the `agent-data` branch, which a project's full agent list includes beside the ones that have a checkout.
[12] handoff: what happens to an agent's work when the agent ends.

## Business logic — TL;DR

- **A local agent's open question** - every agent with a checkout whose status is `waiting` contributes one card carrying the whole question, read from the agent's own diary by the shared rule, and is skipped when the diary shows no open question.
- **A cloud session's question, from the bridge** - every question the bridge still holds without an answer on its way is joined to the web agent whose record names that cloud session, one card per question across projects.
- **Longest waiting first** - the cards are ordered by when the agent last spoke, oldest first, so the agent blocked the longest is the one to unblock first.
- **A failed read costs one card, never the page** - an unreadable project, agent list or event stream contributes nothing.

## Business logic

### A local agent's open question

#### Context

See `## Context`.

#### Business logic

For each project, every agent [2] that has a checkout [9] and whose status is `waiting` is looked at; an agent that is working, or that ended for good, contributes nothing. The agent's events are read from its diary [8], and the question [3] still open by the shared rule (`../open-choices.ts`: open through a waiting end, closed once the agent goes on) is taken, the last one when there are several, kept whole: its options, whether several may be picked, the recommended option and the detail lines. When the diary shows no open question, because the agent went on in the meantime or the diary cannot be read, the agent contributes no card. The card carries the project, the agent's id, what it was asked to do, and the time its card was last updated.

### A cloud session's question, from the bridge

#### Context

**User story**: a web agent's cloud session [5] stops on a question on claude.ai. The extension carries it into the dashboard, where the web agent is listed next to the local agents that wait; the user opens it and answers on the agent's page, without visiting claude.ai.

**Problem**: a web agent is done at its handoff [12] and its checkout [9] may be long gone, so only the project's full agent list, the recorded agents [11] included, can name the agent a bridged question belongs to.

#### Business logic

The questions the bridge [6] holds are taken minus those with an answer already on its way. When there is at least one, every agent [2] of each project is read, the recorded agents [11] included, and each web agent whose record names a cloud session [5] is joined to the bridge question for that same cloud session. One card is made per question: two projects that are working copies of one repository share their agents' records, so the first project to find a question claims it and the next project skips it. The card's question [3] is built from the bridge question by the rules in `bridge-question.ts`; the ids of its options are the option labels, which is what the extension types into the cloud session. The card's waiting time is when the bridge received the question, not the agent's handoff.

### Longest waiting first

#### Context

See `## Context`.

#### Business logic

All cards, local and bridged, are ordered by their waiting time, oldest first: for a local card the time the agent [2] last spoke, for a bridged card the time the bridge [6] received the question. A card with no time sorts first.

### A failed read costs one card, never the page

#### Context

See `## Context`.

#### Business logic

A project whose live agents [2] cannot be read, an agent whose diary [8] cannot be read, and a project whose full agent list cannot be read each contribute nothing; the rest of the list is unaffected.
