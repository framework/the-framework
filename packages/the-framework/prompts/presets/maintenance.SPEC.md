The maintenance preset: the periodic sweep that turns a codebase into queued quality work. The agent analyzes whatever the user named — the launcher asks "what to analyze for refactor opportunities" — and looks for opportunities to refactor.

## Business logic — TL;DR

- **It queues work, it does not refactor** - for every part of the codebase that needs it, the agent appends entries to the agent queue (`TODO_AGENTS.md`) asking for the maintainability preset and the security-audit preset to be applied to that part.
- **Each entry names its own target** - the agent replaces the placeholder with a clear designation of the codebase subset, so the queued entry stands on its own when a later drain picks it up.
- **Queued low** - the entries usually go on at low priority, so routine quality work never displaces the roadmap.

## Business logic

### It queues work, it does not refactor

#### User story

The user wants quality passes to happen across the whole codebase over time, without one agent trying to refactor everything at once and without those passes crowding out the work they actually asked for.

#### Business logic

The agent's output is entries on the agent queue rather than code changes. It divides the analyzed area into codebase subsets, and for each subset that needs it appends two entries: one applying the maintainability preset to that subset, one applying the security-audit preset to it. Each entry names the subset explicitly, and the entries usually go on at low priority. A later drain of the queue turns each entry into its own agent.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
