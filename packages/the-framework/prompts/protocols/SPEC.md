The protocols appended to every agent's system channel: how an agent signals to The Framework. They pin the exact shape of an awaited choice, of the session name and the ready-for-merge signal, and they tell an agent what this particular agent can do — whether it has a browser, whether it has to land its own work, and whether anybody can answer the questions it stops to ask.

## User story

- The user drives coding agents through The Framework's dashboard: answering their questions, watching them name their work, and merging it when they say it is done. All of that only works if an agent's message can be recognized as a question, a name, or a finished-signal.
- The user turns on a browser for an agent, or hands a task to a place nothing local can steer. The agent has to be told which of those it is in — including whether a question it asks from there can still reach the user.

## Glossary

- **system channel** - the standing instructions an agent is given for its whole run, as opposed to the prompt it is asked to work on. The protocols are appended to it.

## Business logic — TL;DR

- **The protocols are the emit contract, not prompt content** - they are appended even when the user has dropped The Framework's built-in system prompt, because without them the agent cannot signal anything.
- **Awaiting** - one block shape for every question an agent stops to ask, including handing a stuck browser to a human, plus a non-blocking way to show a document.
- **Signalling** - the non-blocking blocks: the session name, ready for merge, the pull request to open, and an error only the user can fix.
- **Browser** - added only when this agent has a real browser, telling it so and when to prefer the browser over plain page fetching.
- **Unattended** - added only when nothing can answer this agent's gates, replacing them with "decide alone".
- **Hands-off** - added to every agent handed somewhere nothing local can steer, requiring it to land everything as a pull request.
- **Order is fixed** - the browser section comes first, then awaiting, then unattended amending it, then hands-off, and signalling stays last.

## Business logic

### The protocols are the emit contract, not prompt content

#### User story

The user can turn The Framework's built-in system prompt off and still expect the dashboard to show what their agents are doing.

#### Business logic

The protocols describe *how* to signal, never *when* — deciding when to stop and ask, or when work is finished, belongs to the system prompt. Because they are the contract rather than the content, they are appended even when the built-in system prompt has been dropped. The single exception is a fully transparent agent, where there is no framework behavior left to signal to and the whole system channel is empty.

### What each protocol covers

#### User story

See `## User story`.

#### Business logic

- **Awaiting** — how an agent parks at a gate: one block ending the turn, in one shape for an approval, a multi-select, a plan sign-off or handing a stuck browser to a human, carrying which option is safe to take when nobody answers and which option ends the agent instead of resuming it. It also covers pushing a document to the dashboard without stopping.
- **Signalling** — the blocks an agent emits mid-turn without stopping: the session name it chose, the ready-for-merge declaration, the title and description of the pull request The Framework then opens for it, and errors only the user can fix.
- **Browser** — added only to an agent that has a real browser: that it has one, that the browser is for what it must see or act on while plain fetching remains better for reading, and that it should stay within one page so the user can watch.
- **Unattended** — added only to an agent nothing can answer: the gates just taught have nobody attached to take them, so instead of parking it takes the most plausible reading and says in one line which assumption it made. The non-blocking blocks are unaffected.
- **Hands-off** — added to every agent handed somewhere nothing local can steer: no machine here sees its workspace, so it must commit its work and open a pull request for it, and write any analysis, plan or decision into committed files, because the conversation reaches nobody.

Being handed off and being unanswerable used to be the same thing, and are now decided separately: every agent handed off is told to land its work, while only one whose questions cannot reach the user is told to decide alone.

### Order is fixed

#### User story

The dashboard shows the user the exact system channel an agent will receive, and two protocols only make sense in relation to another.

#### Business logic

The browser section goes ahead of the rest; the await protocol follows; the unattended protocol comes immediately after it, because it amends what that protocol just taught — the gates are described and then declared unanswerable, which keeps the shape intact for The Framework's parser while telling the agent not to reach for it. The hands-off protocol comes after those, and the signal protocol is always last in the channel.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
