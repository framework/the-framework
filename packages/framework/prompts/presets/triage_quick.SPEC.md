The triage-quick preset: fills the agent queue with the cheap, decision-free work. The agent lists the tickets with the `tickets` skill and picks only those whose plan shows a quick win — a low effort rating with an uncertainty of zero — then puts them on the agent queue (`TODO_AGENTS.md`), one entry each, linked to its ticket and given a priority.

## Business logic — TL;DR

- **The plan is the filter** - a ticket qualifies only if it has a plan, and only if that plan rates it low effort with zero uncertainty; an unplanned ticket cannot be picked.
- **The cheapest work goes first** - entries are prioritized sensibly, with the lowest-effort tickets bumped so that the trivial ones become the next tasks agents work on.
- **A fixed session name** - the agent always names its session `triage-quick` rather than inventing one, so this triage's work always lands on the same branch.
- **It only queues** - the shared triage rule appended to this preset forbids implementing any ticket it picks.

## Business logic

### The plan is the filter

#### User story

The user wants a steady stream of cheap wins done unattended, and wants the choice of what qualifies to rest on evidence already written down rather than on the triaging agent's impression.

#### Business logic

Eligibility is read entirely off a ticket's plan, whose effort and uncertainty ratings the skill's listing reports for every ticket: the plan must rate the ticket low effort and must rate its uncertainty zero — the value that says outright that no human intervention is needed. A ticket with no plan is therefore never picked by this preset, which is what makes planning a prerequisite for unattended quick-win work.

### The cheapest work goes first

#### User story

The queue is worked top-down, so the order decides how quickly the backlog of trivia clears.

#### Business logic

The agent gives each entry it adds a sensible priority, and is told to consider bumping the lowest-effort tickets — so that the ones rated as trivial become the next tasks agents work on.

### A fixed session name

#### User story

Triage runs on a schedule, and the user wants every firing of it recognizable in the same place rather than under a new invented name each time.

#### Business logic

The agent always sets its session name to `triage-quick` rather than inventing one, so this triage's branch is always `agent-triage-quick`.

#### Rationale

The prompt says nothing about two triages overlapping, because keeping one triage at a time is not the agent's job: the daemon takes this routine's lock before starting the agent at all. The prompt used to carry that guard — abort if the branch already exists — which cost a started agent to discover, and stopped guarding anything across machines once a triage no longer committed to that branch.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
