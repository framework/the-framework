The extra turn an agent is given the moment it signals ready for merge, when the user has turned this on: it asks the agent to queue quality follow-ups on the work it just did, and to fold what it learned into the project's knowledge base. Opt-in — an agent whose user left it off is never sent it.

## User story

- The user wants a maintainability or security pass on the code an agent just wrote, but does not want that pass to hold up the agent's own pull request.
- The user wants the reasoning behind a change — the decisions taken, the facts discovered — to survive the agent that made it, so the next agent starts from what the project already knows instead of rediscovering it.

## Business logic — TL;DR

- **Quality work is queued, not run** - the agent appends entries to the agent queue (`TODO_AGENTS.md`) asking for the quality presets to be applied to its own changes; a later drain does the work.
- **Two conditions, two presets** - non-trivial changes with refactor potential queue the maintainability preset, changes that could lead to security issues queue the security-audit preset; each entry scopes the preset to "changes introduced by <session name>".
- **What was learned goes into the knowledge base** - the agent updates the project's decisions, facts and insights files from the session's changes and discussions, creating them when missing, and writes only what a future agent could not get from the code itself.

## Business logic

### Quality work is queued, not run

#### User story

See `## User story`: the user wants the follow-up passes to happen, but on their own schedule and in their own agents, not bolted onto the agent that is already finished.

#### Business logic

The prompt asks the agent to *append* work to the agent queue rather than perform it. Each entry names a preset file and the target to apply it to, so a later drain of the queue turns it into its own agent. The agent judges both conditions itself against the changes it just made:

- changes that are not trivial and have refactor potential queue the maintainability preset;
- changes that can potentially lead to security issues queue the security-audit preset.

Either, both, or neither entry may be written. Every entry scopes the preset's target to "changes introduced by <session name>", so the follow-up reviews this agent's diff rather than the whole codebase.

### What was learned goes into the knowledge base

#### User story

See `## User story`: knowledge that lived only in one agent's conversation is lost when that agent ends.

#### Business logic

The agent is asked to consider updating three project files from the changes and discussions of the session, and to create any that are missing: `knowledge-base/DECISIONS.md` (decisions taken, and why), `knowledge-base/FACTS.md` (non-obvious facts relevant to the project) and `knowledge-base/INSIGHTS.md` (insights relevant to the project). One rule bounds what goes in: only what a future agent would need and cannot get from the code itself.

#### Rationale

These are exactly the files the system prompt already puts in every agent's starting context, so what one agent writes here is what the next agent reads — the knowledge base is only worth keeping if both halves name the same set of files.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
