The Overview: the dashboard's landing page when no project is picked — an at-a-glance board of what the account has left to spend, what needs a human, what the agents are doing now, what the framework takes up next, its scheduled routines, and the tickets worth attention across every project.

## User story

The user opens the dashboard after being away. Before drilling into any one project they want the whole picture in one screen: is there quota left, is anything waiting on them, is anything running, and what will happen next without them.

## Business logic — TL;DR

- **One board, ordered by what governs what** - onboarding checklist (until dismissed), then quota, then the two queues side by side, then Routine work, then hot tickets.
- **Live without a reload** - the board re-reads the daemon every few seconds, so a queue emptying or an agent finishing shows up on its own.
- **Human Queue: the cross-project "needs you" list** - open pull requests to review, agents parked on a gate, and finished work never pushed — each row jumping straight to where the user acts on it.
- **Every row is a way in** - rows open the agent they name, the ticket they name, or the pull request they name; nothing on the board is a dead end.

## Business logic

### The board and its order

#### User story

See `## User story`.

#### Business logic

The page stacks, in this order: the onboarding checklist (hidden once the user dismisses it — dismissing only hides it here, the settings page still offers it); the quota card; a two-column row holding the Human Queue on one side and, on the other, the agents working right now stacked on top of the AI Queue; the Routine work card; and the hot tickets feed. Everything is read from the daemon in one call, repeated every few seconds so the board stays current; until the first read lands, the sections that depend on it show as loading.

#### Rationale

Quota comes first because it governs everything an agent may do next. The two queues sit side by side because they answer the two halves of the same question: what needs a person, and what the framework will pick up on its own.

### The Human Queue

#### User story

The user is the only one who can approve, review, or answer — everything else the framework does by itself. This card is the complete list of those moments, pooled across every project, so nothing waits unnoticed in a project the user did not open.

#### Business logic

The card is titled "Human Queue", carries a count badge when it has entries, and reads "AI doesn't need you." when empty. It lists three kinds of intervention, each with its own marker and its own destination:

- **Awaiting** — an agent parked on a gate. The row opens that agent, where the user answers the choice.
- **Unpushed** — a finished agent whose work was never pushed. The row opens that agent, and names the branch the work sits on. It shows a commit count only when the count is known and above zero, so an unknown count says nothing rather than the contradictory "0 commits".
- **A pull request to review** — proposals and finished work both surface as pull requests. The row links out to the pull request on GitHub, where merging confirms the work and closing rejects it.

Awaiting and unpushed rows both name their agent; only if that identity is somehow missing does the row fall back to opening the project, rather than doing nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
