Status: open
GitHub: [#1180](https://github.com/gemstack-land/the-framework/issues/1180)

# Show prompt analysis to user

## TLDR

`ANALYSIS_RESULT.md` has neat info — show it to the user: Scope (one word, e.g. small), Variability (one word, e.g. large), Plan yes/no ("Whether the work includes a plan"), New tickets yes/no ("Whether the work spans over new tickets"). Only if quick-win, and only-for-AI (the maintainer wants to try getting AI to auto-work on this).

## Why it matters

Surfaces the framework's own prompt analysis in the dashboard, giving the user an at-a-glance read on how the agent sized up their request. Also doubles as a dogfooding experiment for AI autonomously picking up tickets.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1180](https://github.com/gemstack-land/the-framework/issues/1180), created 2026-07-25, no labels.

### Original description

Only if quick-win and only for AI. (Let me try to get AI to auto work on this.)

ANALYSIS_RESULT.md has some neat info, how about showing the result to the user?
- Scope: [one word, e.g. small]
- Variability: [one word, e.g. large]
- Plan: yes/no [label: "Whether the work includes a plan"]
- New tickets: yes/no [label: "Whether the work spans over new tickets"]
