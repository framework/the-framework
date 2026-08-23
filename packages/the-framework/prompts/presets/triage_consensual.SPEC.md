The triage-consensual preset: fills the agent queue with the significant work that needs no human input. The agent reads all tickets, picks only the ones that are significant — explicitly not quick wins — and consensual, meaning zero open questions and zero variability, such as a ticket with a single fairly obvious plan, and appends them to the agent queue (`TODO_AGENTS.md`).

## Business logic — TL;DR

- **Significant and consensual only** - quick wins are left to the sibling triage preset, and anything carrying an open question or a real choice of approach is left out entirely.
- **A fixed session name guards against double triage** - the agent always names its session `triage-consensual`, and aborts when the branch of that name already exists.
- **It only queues** - the shared triage rule appended to this preset forbids implementing any ticket it picks.

## Business logic

### Significant and consensual only

#### User story

The user wants unattended work to be substantial but never to make a decision that was theirs to make. A ticket with one obvious plan can be worked while they sleep; a ticket with a real choice in it cannot.

#### Business logic

Two filters apply together: the ticket must be significant, and it must be consensual — zero open questions and zero variability. Quick wins are excluded here because the sibling triage preset covers them, which is what lets the daemon queue the cheap batch and the significant batch on separate firings rather than in one indiscriminate sweep.

### A fixed session name guards against double triage

#### User story

Triage runs on a schedule. A firing that starts while the previous triage is still in flight would triage the same tickets twice.

#### Business logic

The agent always sets its session name to `triage-consensual` rather than inventing one. If the branch `tf-triage-consensual` already exists, it aborts and tells the user that the branch exists and a triage is already pending. The branch is therefore the lock: a triage still in flight owns it, so the next firing does nothing.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
