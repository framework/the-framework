---
'@gemstack/the-framework': patch
---

The auto-merge-disabled warning (#1417) can actually render now: its repo probe used `gh repo view --json autoMergeAllowed`, a field `repo view` has never had, so the probe always errored into "could not say" and the warning never showed anywhere. The probe is now `gh api repos/{owner}/{repo}` reading `allow_auto_merge`; a viewer without push access gets the field omitted, which stays "could not say".
