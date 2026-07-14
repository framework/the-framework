---
"@gemstack/framework": minor
---

Add the `setSessionName()` and `setReadyForMerge()` lifecycle signals (#326). Both are non-blocking turn-boundary signals, the same shape as the existing `show-markdown` view: the agent emits a fenced `set-session-name` / `ready-for-merge` block and keeps working, and the framework records it and reflects it in the dashboard. `setSessionName(<name>)` labels the run with the `[a-z0-9-]` slug it chose (also its `the-framework/<name>` branch); `setReadyForMerge()` flips the run's status from building to ready-for-review. The dashboard shows the session name and a status dot (amber while building, green once ready) in both the run overview and the cross-project "working now" list. This is the signal the post-merge quality suite will hang off.
