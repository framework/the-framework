Assembles the Overview page: the cross-project, at-a-glance rollup of what is running, what recently happened, and how much work is waiting.

## Flows

- What a reader actually asks of it, and nothing else: how many projects there are and how much work is waiting, which agents are going right now, the per-project queue, and which projects have tickets — ordered most-recently-active first, because the onboarding checklist acts on the head of that list.
- A pure projection of what is already on disk; a project whose records cannot be read simply contributes nothing.

## Rationales

- The payload is pinned to what its readers ask for: a rollup over past agents costs a fan-out over every project's whole archive on every poll, and what a payload costs is a reason to keep it honest about who reads it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
