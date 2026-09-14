GitHub: [#1774](https://github.com/framework/the-framework/issues/1774)

# Dashboard architecture: the plan and six questions

## TLDR

The plan for #1768: a dashboard that shows a page, card or control only for the skills a repository picked. Today it is one React app in the framework that knows all four skills (`branches`, `tickets`, `queue`, `logs`) by name and by import. The picks posted on the thread win over the issue body:

- **Q1, where a skill's dashboard code lives:** out of the framework, in the skill's own package on its own export path. It can be split into a separate package later.
- **Q2, how the framework knows a skill: capabilities.** The framework stops knowing skills. A routine is a prompt ("get tickets to work on") plus the rules of the job, and the agent composes whatever skills are in the folder. The experiment backed it (16 `claude -p` runs, Sonnet and Opus): with the job rules in the prompt, both models did `queue` → `tickets claim` → work → push → `tickets close` → `queue done` → stop. Claims held with two agents on one queue, and an empty queue stopped for $0.11–0.18. The four names and imports go. Checkout before the run and the record after it stay framework code for now.
- **Q3, skills knowing each other:** never a skill, only the framework. The cross-skill sentence in SKILL.md goes. The Queue button becomes a generic "actions on a link" slot the queue widget fills. A claim's holder is an agent id the dashboard links when a records widget exists. The hot-tickets card is the framework's, or splits in two.
- **Q6, the daemon half (built as #1777):** the drain becomes a routine skill, `work-queue/SKILL.md` with `disable-model-invocation: true`, in its own package `@gemstack/routines`. The daemon fires `/work-queue`, then reads no queue, claims no ticket and names no skill. `auto-pm.ts`'s sweep and the `todo-loop.ts` drain go. Two kinds of skill: capability skills (a SKILL.md and a command) and routine skills (a SKILL.md only, composing capabilities).

## Why it matters

Labeled via #1768 as the highest priority: modularity (skip or *replace* a skill) beats UX paper cuts. It sets how every later skill and routine plugs into the framework and the dashboard.

## Open points

- A stalled agent leaves its locks, and nothing lifts them.
- Two tickets SKILL.md sentences get in the way: "close once merged" stalls Opus in a run with no merge step, and "install first" sends Sonnet to `npm install`.
- "A skill is absent" has to mean both its SKILL.md and its package are gone, or the agent still finds the command.
- Q4/Q5 (pages that need two skills; runs without the logs skill) and the rest of the order: see the thread.

## Source

Imported from GitHub issue [framework/the-framework#1774](https://github.com/framework/the-framework/issues/1774), created 2026-09-09, no labels, 3 comments (last folded: 2026-09-13T21:29Z).
