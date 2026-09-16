GitHub: [#1774](https://github.com/framework/the-framework/issues/1774)

# Dashboard architecture: the plan and six questions

## TLDR

The plan for #1768: a dashboard that shows a page, card or control only for the skills a repository picked. Today it is one React app in the framework that knows all four skills (`branches`, `tickets`, `queue`, `logs`) by name and by import. The picks posted on the thread win over the issue body:

- **Q1, where a skill's dashboard code lives:** out of the framework, in the skill's own package on its own export path. It can be split into a separate package later.
- **Q2, how the framework knows a skill: capabilities.** The framework stops knowing skills. A routine is a prompt ("get tickets to work on") plus the rules of the job, and the agent composes whatever skills are in the folder. The experiment backed it (16 `claude -p` runs, Sonnet and Opus): with the job rules in the prompt, both models did `queue` → `tickets claim` → work → push → `tickets close` → `queue done` → stop. Claims held with two agents on one queue, and an empty queue stopped for $0.11–0.18. The four names and imports go. Checkout before the run and the record after it stay framework code for now.
- **Q3, skills knowing each other:** never a skill, only the framework. The cross-skill sentence in SKILL.md goes. The Queue button becomes a generic "actions on a link" slot the queue widget fills. A claim's holder is an agent id the dashboard links when a records widget exists. The hot-tickets card is the framework's, or splits in two.
- **Q6, the daemon half (built as #1777, merged):** the drain became a command skill, `work-queue/SKILL.md` with `disable-model-invocation: true`. #1779 (merged) moved it into its own package, `@gemstack/skill-work-queue`: one package per command. Two kinds of skill: capability skills (a SKILL.md and a command) and command skills (a SKILL.md composing capabilities).
- **Q7, does the framework still need the daemon (comment of 09-14, edited 09-16):** the clock leaves the daemon for **agent-scheduler**, a tool like agent-driver (a package, not a skill) that owns one small process per project. The dashboard shows an on/off card that projects a file, and starts and stops the process through open/close hooks; it names no tool. All state lives in files.
  - Q7.1 D: the tick reads a tracked schedule file, `agent-schedule.md`, which names each command's check ("work-queue: when `npx queue` prints entries"). The scheduler knows no skill.
  - Q7.2 C: a scheduled run uses agent-driver and the branches package directly, one small process per run, no framework flow. Open: how the PR title and body reach the publisher.
  - Q7.3 D: the per-run process records its run and removes its checkout; a sweep on the tick catches what a dead process left.
  - Q7.4: one scheduler per project; machine-wide settings go (quota from agent-driver at each tick, cap per command in the schedule file).
  - Q7.5: closing the dashboard stops new starts only; running agents finish. The pid goes into `agent.json`.
  - Q7.6: `work-queue` tracked in the project first; the scheduler starts a command only if `.claude/skills/<command>` exists. A one-shot `run <prompt>` beside `tick`, `start`, `stop`, `status`. Heartbeat and transport retry dropped. Untracked per-user state in `.agent-scheduler/state.json`, keep-alive included. Runs in flight are marker files on `agent-data`, counted against the cap. The daemon's clock calls each project's `tick` during the transition.

## Why it matters

Labeled via #1768 as the highest priority: modularity (skip or *replace* a skill) beats UX paper cuts. It sets how every later skill and command plugs into the framework and the dashboard.

## What comes next (Q7, replaces Q6.5)

- Step 0: track `work-queue` in the project like #1778.
- First PR: the `agent-scheduler` package (`tick`, `run`, `start`, `stop`, `status`), the two files, the per-run process on agent-driver and the branches package, the markers, the sweep. The tick pulls `agent-data` first and schedules only `work-queue`. The daemon's look, its gates and the `Daemon:` trailer go.
- Then the hook API and the Scheduler card.
- Later: the rest of the daemon clock (CI watch, Discord, worktree sweep, cloud sweeps, boot reconcile) becomes scheduled commands, scheduler jobs, or goes; agent-driver writes the live log; the four rotation jobs become command packages that take their own locks and claims; web runs and the bridge stay with the dashboard server.

## Open points

- A stalled agent leaves its locks; only the routine's "release before you stop" rule and a person's Release button lift them (Q6.4).
- "A skill is absent" has to mean both its SKILL.md and its package are gone, or the agent still finds the command.
- Q4/Q5 (pages that need two skills; runs without the logs skill) and the dashboard half: see the thread.

## Source

Imported from GitHub issue [framework/the-framework#1774](https://github.com/framework/the-framework/issues/1774), created 2026-09-09, no labels, 4 comments (last folded: 2026-09-16T13:46Z).
