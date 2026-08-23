Renders the on-before-mergeable prompt: one extra agent turn sent after an agent signals ready for merge, which queues quality follow-up work and folds the agent's learnings back into the repo's knowledge docs.

## Glossary

- **on-before-mergeable prompt** — the extra turn The Framework sends a finished agent right after it signals ready for merge (when the on-before-mergeable quality preference is on), before the work is handed off.

## Business logic — TL;DR

- **Queues quality work, never runs it** - the prompt tells the agent to append entries to the agent queue (`TODO_AGENTS.md`), one per quality preset; a later routine drains them.
- **Folds knowledge back** - the prompt asks the agent to update the repo's business-knowledge docs with what it learned during the task.
- **Every entry names the session** - each queued entry targets "changes introduced by <session name>"; rendering without a session name fails loudly.

## Business logic

### Queues quality work, never runs it

#### User story

An agent finishes a task. The user wants the changes to also get a maintainability pass and a security audit — but as ordinary queued work that respects quota and scheduling, not as extra work blocking this agent's handoff.

#### Business logic

The prompt's `## Maintenance` section instructs the agent to append one agent queue entry per quality preset to `TODO_AGENTS.md`, each of the form "Apply `.the-framework/presets/<preset>.md` with tf.params.what set to 'changes introduced by <session name>'". The entry points at the preset's real on-disk file under `.the-framework/presets/`, so the agent that later picks the entry up opens the actual preset text. A later drain of the agent queue turns each entry into its own agent.

#### Rationale

An earlier design executed maintainability, readability and security-audit as three child runs on the spot, which did not compose with the agent queue: the follow-ups bypassed the backlog and its quota pacing. Queueing makes them ordinary entries like any other.

### Folds knowledge back

#### User story

Working a task teaches the agent non-obvious facts about the product. That knowledge should outlive the agent so the next one starts smarter.

#### Business logic

The prompt's `## Business knowledge` section asks the agent to fold what it learned during the task back into the repo's business-knowledge docs — `knowledge-base/DECISIONS.md`, `knowledge-base/FACTS.md`, `knowledge-base/INSIGHTS.md` — the same set of files every agent is told to read at start.

### Every entry names the session

#### Business logic

Rendering fills the finished agent's session name into every queued entry and every instruction. A render with no session name fails with an error naming the missing value, rather than queueing entries about "changes introduced by undefined". Absent optional settings read as off, so a minimal caller gets a deterministic prompt. The template deliberately never nests one `${{ }}` fragment inside another — the template language forbids it (a nested fragment would end the outer one early and break rendering), so the prompt is written flat.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
