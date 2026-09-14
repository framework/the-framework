GitHub: [#1774](https://github.com/framework/the-framework/issues/1774)

# Dashboard architecture: the plan and six questions

## TLDR

The plan for #1768: a dashboard that shows a page, card or control only for the skills a repository picked. Today it is one React app in the framework that knows all four skills (`branches`, `tickets`, `queue`, `logs`) by name and by import. The picks posted on the thread win over the issue body:

- **Q1, where a skill's dashboard code lives:** out of the framework, in the skill's own package on its own export path. It can be split into a separate package later.
- **Q2, how the framework knows a skill: capabilities.** The framework stops knowing skills. A routine is a prompt ("get tickets to work on") plus the rules of the job, and the agent composes whatever skills are in the folder. The experiment backed it (16 `claude -p` runs, Sonnet and Opus): with the job rules in the prompt, both models did `queue` → `tickets claim` → work → push → `tickets close` → `queue done` → stop. Claims held with two agents on one queue, and an empty queue stopped for $0.11–0.18. The four names and imports go. Checkout before the run and the record after it stay framework code for now.
- **Q3, skills knowing each other:** never a skill, only the framework. The cross-skill sentence in SKILL.md goes. The Queue button becomes a generic "actions on a link" slot the queue widget fills. A claim's holder is an agent id the dashboard links when a records widget exists. The hot-tickets card is the framework's, or splits in two.
- **Q6, the daemon half (built as #1777, merged):** the drain became a command skill, `work-queue/SKILL.md` with `disable-model-invocation: true`. #1779 (merged) moved it into its own package, `@gemstack/skill-work-queue`: one package per command. The daemon fires `/work-queue` when the `agent-data` branch moves, then reads no queue, claims no ticket and names no skill. `auto-pm.ts`'s sweep and the `todo-loop.ts` drain are gone. Two kinds of skill: capability skills (a SKILL.md and a command) and command skills (a SKILL.md composing capabilities).

## Why it matters

Labeled via #1768 as the highest priority: modularity (skip or *replace* a skill) beats UX paper cuts. It sets how every later skill and command plugs into the framework and the dashboard.

## What comes next (Q6.5, edited)

- The four rotation jobs (update tickets, triage quick, triage consensual, plan tickets) become command skills, one PR each, plan tickets last (its fan-out needs its own design).
- Not triggers in the front matter plus a scheduler package, as first written. Instead `skill-schedule`: a command skill the user configures with `agent-schedule.md` on the project's main branch, saying which command runs when. It fires any command skill by its slash command, so a command declares nothing and whatever fires the schedule knows no command. The framework's dependency on the command packages goes with it.
- Branches to zero imports at step 4 (Q6.3 B).

## Open points

- A stalled agent leaves its locks; only the routine's "release before you stop" rule and a person's Release button lift them (Q6.4).
- "A skill is absent" has to mean both its SKILL.md and its package are gone, or the agent still finds the command.
- Q4/Q5 (pages that need two skills; runs without the logs skill) and the dashboard half: see the thread.

## Source

Imported from GitHub issue [framework/the-framework#1774](https://github.com/framework/the-framework/issues/1774), created 2026-09-09, no labels, 3 comments (last folded: 2026-09-14T19:30Z).
