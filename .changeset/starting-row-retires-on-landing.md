---
'@gemstack/framework-dashboard': patch
---

The rail no longer shows a phantom second session when a run finishes as fast as it started. The "starting…" stand-in row waited for a `running` row to hand over to, but the runs list polls every two seconds, so a session that starts and finishes inside one interval is never once observed running — the stand-in then sat beside the finished session's own row, reading as a duplicate session that was starting, until a 20-second deadline swept it. It now retires on the real signal: the first run to appear that was not in the list when Start was clicked, whatever status it landed in. The deadline stays as the backstop for a start that produces no run at all.
