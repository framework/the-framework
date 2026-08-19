Priority: 2
Topics: [bug]
GitHub: [#1143](https://github.com/gemstack-land/the-framework/issues/1143)

# Bug: cannot select Fable

## TLDR

The original bug — Fable cannot be selected in the dashboard's model picker — appears fixed (screenshot on the thread, 2026-07-29). Remaining work: remove the 'Default' option from the picker; it's useless (Default = unknown model). Low priority, post-MVP.

## Why it matters

Model selection is how users route work to the strongest model; a picker entry that can't be chosen silently forces a different model than intended. (Small but user-facing — and Fable is the model the maintainers actually want runs on.)

## Source

Imported from GitHub issue [gemstack-land/the-framework#1143](https://github.com/gemstack-land/the-framework/issues/1143), created 2026-07-25, labels: `bug`, `priority: low`, 1 comment.

### Original description

Low-prio, post-MVP.

<img width="620" height="273" alt="Image" src="https://github.com/user-attachments/assets/dc78d88f-9c7a-4e0d-aa09-31174c057f05" />

### Notes from the GitHub thread

- 2026-07-29: "Seems to have been fixed" (screenshot shows Fable selectable). The ticket's remaining scope is removing the 'Default' option — Default = unknown model, so the entry is useless.
