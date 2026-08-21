Assembles the Overview page: the cross-project, at-a-glance rollup of what is running and how much work is waiting.

## User Stories

- The user opens the Overview and sees at a glance which agents are working right now and how much queued work is waiting, across every project.
- The user's onboarding checklist points at the project they touched last.

## Flows

- What the user actually asks of the page, and nothing else: how many projects there are, how much work is waiting, which agents are going right now, the per-project queue, and which projects have tickets. Projects are ordered most-recently-active first, because the onboarding checklist acts on the head of that list.
- A pure projection of what is already on disk; a project whose records cannot be read simply contributes nothing.

## Rationales

- The payload is pinned to what the page reads: a rollup over past agents would cost reading every project's whole archive on every poll, and a cost like that is only paid for numbers somebody actually looks at.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
