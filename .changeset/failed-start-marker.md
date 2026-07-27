---
'@gemstack/the-framework': patch
---

A run whose child dies at boot no longer shows "Waiting for the session to start" forever. Runs spawn detached with their stdio dropped, so a child that crashed before opening its run store (a dangling workspace link was the observed case) died invisibly: no run.json, no log line, a session page polling for a start that already failed. The daemon's exit handler now writes the minimal failed meta the page needs, dated by the run id, and the child's stderr is captured to a file in its checkout so the run log can quote the actual boot error. A child that wrote its own lifecycle is left alone, and the existing retention rules then keep the failed checkout for inspection.
