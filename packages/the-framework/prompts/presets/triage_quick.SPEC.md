The triage-quick preset: fills the agent queue with the cheap, decision-free work. The agent reads the tickets and picks only those whose plan shows a quick win — a low effort rating with an uncertainty of zero — then appends them to the agent queue (`TODO_AGENTS.md`).

## Business logic — TL;DR

- **The plan is the filter** - a ticket qualifies only if it has a plan, and only if that plan rates it low effort with zero uncertainty; an unplanned ticket cannot be picked.
- **The cheapest work goes first** - entries are prioritized sensibly, with the lowest-effort tickets bumped so that the trivial ones become the next tasks agents work on.
- **A fixed session name guards against double triage** - the agent always names its session `triage-quick`, and aborts when the branch of that name already exists.
- **It only queues** - the shared triage rule appended to this preset forbids implementing any ticket it picks.

## Business logic

### The plan is the filter

#### User story

The user wants a steady stream of cheap wins done unattended, and wants the choice of what qualifies to rest on evidence already written down rather than on the triaging agent's impression.

#### Business logic

Eligibility is read entirely off a ticket's plan file: the plan must rate the ticket low effort and must rate its uncertainty zero — the value that says outright that no human intervention is needed. A ticket with no plan is therefore never picked by this preset, which is what makes planning a prerequisite for unattended quick-win work.

### The cheapest work goes first

#### User story

The queue is worked top-down, so the order decides how quickly the backlog of trivia clears.

#### Business logic

The agent prioritizes the entries it adds sensibly, and is told to consider bumping the lowest-effort tickets — so that the ones rated as trivial become the next tasks agents work on.

### A fixed session name guards against double triage

#### User story

Triage runs on a schedule. A firing that starts while the previous triage is still in flight would triage the same tickets twice.

#### Business logic

The agent always sets its session name to `triage-quick` rather than inventing one. If the branch `tf-triage-quick` already exists, it aborts and tells the user that the branch exists and a triage is already pending. The branch is therefore the lock: a triage still in flight owns it, so the next firing does nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
