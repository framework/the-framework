---
"@gemstack/framework": patch
---

Fix a continued run showing as finished (#768). Continuing a stopped run worked — the run went live again and the agent replied — but the dashboard kept rendering its finished replay, so it looked like nothing had happened.

Every reader deduped a run present in both the live and archived lists by keeping the archived copy. That was right while a run was only ever archived on its way out, so the archive was the final word. A continued run (#762) has an archive from its first leg while being live again, and that archive shadowed the live copy, showing a running run as done.

The live copy now wins, in the runs list, the activity feed and the project summaries.
