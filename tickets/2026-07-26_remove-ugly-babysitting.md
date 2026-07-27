Status: open
Priority: 8
Topics: [bug]
GitHub: [#1224](https://github.com/gemstack-land/the-framework/issues/1224)

# Remove ugly babysitting

## TLDR

Remove the "This project already exists — do NOT re-scaffold or rebuild it..." paragraph from the system prompt: avoid infantilizing agents.

## Why it matters

System-prompt tone is product philosophy: TF bets on capable agents, and defensive babysitting instructions both waste context and signal distrust. (Whether removing it regresses re-scaffolding behavior on existing projects is the thing to check.)

## Source

Imported from GitHub issue [gemstack-land/the-framework#1224](https://github.com/gemstack-land/the-framework/issues/1224), created 2026-07-26, labels: `bug`, `priority: high`.

### Original description

@suleimansh Can we remove this from the system prompt? Let's avoid infantilizing agents, that's bad.

> This project already exists — do NOT re-scaffold or rebuild it, and do not
replace its structure or swap its stack. Read the existing code first, follow
its conventions, and make the smallest coherent set of changes that adds what
is asked; new files and dependencies are fine when the feature needs them.
When done, summarize what you changed in one short paragraph.
