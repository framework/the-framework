Status: open
GitHub: [#1180](https://github.com/gemstack-land/the-framework/issues/1180)

# Show prompt analysis to user

## TLDR

`ANALYSIS_RESULT.md` has neat info — surface it to the user in the dashboard: Scope (one word), Variability (one word), Plan yes/no ("Whether the work includes a plan"), New tickets yes/no ("Whether the work spans over new tickets"). Only if quick-win, and only for AI to pick up autonomously.

## Why it matters

The prompt analysis is the framework's first visible "thinking" about a request; showing it confirms to the user that the prompt was understood and how big the work is. Also an experiment in letting AI auto-work tickets ("Let me try to get AI to auto work on this").

## Source

Imported from GitHub issue [gemstack-land/the-framework#1180](https://github.com/gemstack-land/the-framework/issues/1180), created 2026-07-25.

### Original description

Only if quick-win and only for AI. (Let me try to get AI to auto work on this.)

ANALYSIS_RESULT.md has some neat info, how about showing the result to the user?
- Scope: [one word, e.g. small]
- Variability: [one word, e.g. large]
- Plan: yes/no [label: "Whether the work includes a plan"]
- New tickets: yes/no [label: "Whether the work spans over new tickets"]
