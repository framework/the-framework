Status: open
Priority: 9
Topics: [bug]
GitHub: [#1224](https://github.com/gemstack-land/the-framework/issues/1224)

# Remove ugly babysitting

## TLDR

Remove the "This project already exists — do NOT re-scaffold or rebuild it..." paragraph from the system prompt. Rationale: avoid infantilizing agents — that kind of babysitting instruction is bad prompt design.

## Why it matters

System-prompt quality directly shapes every run; defensive boilerplate wastes prompt budget and signals distrust the current models don't need. Labeled `highest-prio 🌟`.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1224](https://github.com/gemstack-land/the-framework/issues/1224), created 2026-07-26, labels: `bug`, `highest-prio 🌟`.

### Original description

@suleimansh Can we remove this from the system prompt? Let's avoid infantilizing agents, that's bad.

> This project already exists — do NOT re-scaffold or rebuild it, and do not
replace its structure or swap its stack. Read the existing code first, follow
its conventions, and make the smallest coherent set of changes that adds what
is asked; new files and dependencies are fine when the feature needs them.
When done, summarize what you changed in one short paragraph.
