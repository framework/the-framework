---
"@gemstack/the-framework": patch
---

The triage routines no longer jam after their first run: a pinned branch (`the-framework/triage-quick`) whose PR was closed or merged is released before the routine fires, instead of tripping the prompt's "triage is already pending" abort forever. An open PR still keeps the branch, and a branch with no PR history is left alone.
