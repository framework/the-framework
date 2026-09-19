Decides which checkout [1] an agent id [2] addresses, and which diary [3] file a subscription to that agent [4] tails, for every surface addressed by agent — each dashboard RPC, the live feed, the relay — so that the fallback rules cannot drift apart between them.

## Context

**User story**: the user opens an agent in the dashboard the moment it starts, or long after it ended, and sees that agent's own events and checkout state — never another agent's.

**Problem**: the daemon learns an agent's id the moment the project's start hook answers, before the tool that runs the agent has made the checkout or written a line. A feed that resolved nothing for such an agent would stay empty; and a checkout directory exists before the agent's card is written, so a lookup by card alone would miss an agent that certainly exists.

## Glossary

[1] checkout: an agent's own working copy of the project: a git worktree under the project's `.branches/` directory, in a directory named `agent-<agent id>`. The user's own working copy is "the project's checkout".
[2] agent id: an agent's stable id, derived from the moment it started; it names the agent's checkout directory, its branch until the agent names it, and its card and diary.
[3] card / diary: an agent's record in two shapes, whose definition is The Framework's (`runs.ts`): the card `<id>.json` (what was asked, the branch, the pull request, how it ended, what it cost) and the diary `<id>.jsonl` (what the agent said, one line per event). While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs it; a finished agent's are what the runs provider [5] answers.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[5] runs provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's finished agents (`runs.ts`).

## Business logic — TL;DR

- **The checkout an agent id resolves to** - the checkout whose card names the agent [4], else the checkout directory named for the id when it exists, else the project root.
- **The diary a tail follows** - the diary [3] file in the agent's checkout [1] while the checkout exists; else the finished agent's lines from the runs provider [5]; else the place in the checkout where the diary will appear.

## Business logic

### The checkout an agent id resolves to

#### Context

See `## Context`.

#### Business logic

- No agent id [2], or an id that is not path-safe, resolves to the project root.
- An agent [4] whose card [3] sits in a checkout [1] resolves to that checkout (the agents with a checkout as read by `agent-store.ts`).
- Otherwise the checkout directory named for the id under `.branches/` resolves when it exists as a directory, even before the tool that runs the agent has written the card.
- Otherwise the project root: an unknown or finished agent's checkout may already be gone, and the project's own state is the sane thing to act on. Nothing here fails.

### The diary a tail follows

#### Context

**Problem**: an agent's diary [3] moves. While the agent works it is a file in the agent's checkout [1]; when the agent ends, the tool that runs it records it and reclaims the checkout, and from then on the runs provider [5] answers it; a resumed agent writes on in a checkout again.

#### Business logic

- No agent id [2], or an id that is not path-safe, has no diary to tail.
- The agent's checkout is the one whose card names it, else the directory named for the id under `.branches/`. While that checkout exists as a directory, the diary is `<agent id>.jsonl` under its `.the-framework/`, whether or not the file is there yet.
- With no checkout, the finished agent's diary, every line, is the answer when the runs provider [5] has the agent finished (the lookup in `agent-store.ts`).
- With neither, the agent was started a moment ago and its checkout is not made yet, even if its record already says `running`: the answer is the place in the checkout where the diary will appear, and the tail waits for it there (`../dashboard-rpc/events-tail.ts`). A project with no runs provider answers the same for a finished agent: the file that is gone, where nothing more comes.

Only the event tails resolve this way; every other agent-addressed surface keeps the checkout resolution's root fallback.
