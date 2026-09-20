Decides which checkout [1] an agent id [2] addresses, and where the diary [3] a subscription to that agent [4] tails is, for every surface addressed by agent — each dashboard RPC, the live feed, the relay — so that the fallback rules cannot drift apart between them.

## Context

**User story**: the user opens an agent in the dashboard the moment it starts, or long after it ended, and sees that agent's own events and checkout state — never another agent's.

**Problem**: the daemon learns an agent's id the moment the project's start hook answers, before the tool that runs the agent has made the checkout or written a line, and the checkouts are read through the branches provider [6], whose list is shared for a few seconds. A feed that resolved nothing for such an agent would stay empty, and a lookup off a list a few seconds old would miss an agent that certainly exists.

## Glossary

[1] checkout: an agent's own working copy of the project, where it works; the branches provider [6] says where it is. The user's own working copy is "the project's checkout".
[2] agent id: an agent's stable id, derived from the moment it started; it names the agent's card and diary, and its branch until the agent names it.
[3] card / diary: an agent's record in two shapes, whose definition is The Framework's (`runs.ts`): the card `<id>.json` (what was asked, the branch, the pull request, how it ended, what it cost) and the diary `<id>.jsonl` (what the agent said, one line per event). While the agent has a checkout they sit under the checkout's `.the-framework/`, written by the tool that runs it; a finished agent's are what the runs provider [5] answers.
[4] agent: the unit of work: one task worked by a coding agent in its own checkout, on its own branch. The Framework starts none itself: the tool the project's start hook names runs it, and the dashboard shows it from the files that tool keeps.
[5] runs provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's finished agents (`runs.ts`).
[6] branches provider: the command, among the commands of a project's dependencies, that a package declares as answering for the project's checkouts, in its own package.json under `"framework": { "branches": "<command>" }` (the `branches` skill's package declares its `branches` command); it lists the checkouts, tells what a branch holds, pushes and opens a branch's pull request, lands one, and reclaims a checkout (`store/branches.ts`).

## Business logic — TL;DR

- **The checkout an agent id resolves to** - the checkout the branches provider [6] lists for the agent, asked once more fresh when its shared list lacks it, else the project root.
- **The diary a tail follows** - the diary [3] file in the agent's checkout [1] while the provider lists one; else the finished agent's lines from the runs provider [5]; else nowhere yet, and the tail asks again.

## Business logic

### The checkout an agent id resolves to

#### Context

See `## Context`.

#### Business logic

- No agent id [2], or an id that is not path-safe, resolves to the project root.
- The checkout [1] the branches provider [6] lists for the agent resolves, whether or not the tool that runs the agent has written the card yet. When the provider's shared list lacks the agent, the list is asked once more, fresh (`branches.ts` says how fresh), since the agent may have started since the last read.
- Otherwise the project root: a project with no provider, an unknown agent, or a finished agent whose checkout is already gone; the project's own state is the sane thing to act on. Nothing here fails.

### The diary a tail follows

#### Context

**Problem**: an agent's diary [3] moves. While the agent works it is a file in the agent's checkout [1]; when the agent ends, the tool that runs it records it and reclaims the checkout, and from then on the runs provider [5] answers it; a resumed agent writes on in a checkout again.

#### Business logic

- No agent id [2], or an id that is not path-safe, has no diary to tail.
- While the branches provider [6] lists a checkout for the agent (asked once more fresh on a miss, as above), the diary is `<agent id>.jsonl` under that checkout's `.the-framework/`, whether or not the file is there yet.
- With no checkout, the finished agent's diary, every line, is the answer when the runs provider [5] has the agent finished (the lookup in `agent-store.ts`).
- With neither, the diary is nowhere yet: the agent was started a moment ago and its checkout is not made, even if its record already says `running`. The answer says so ("pending"), and the tail asks again on its own cadence until the diary has a home (`../dashboard-rpc/events-tail.ts`). A project with no runs provider answers the same for a finished agent, where nothing more comes.

Only the event tails resolve this way; every other agent-addressed surface keeps the checkout resolution's root fallback.
