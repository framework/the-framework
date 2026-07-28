---
'@gemstack/the-framework': patch
'@gemstack/framework-dashboard': patch
---

A session no longer spends a branch and a worktree on an agent that can never start (#1326). Preflight already checked that the picked agent's CLI was installed, but installed is not usable: a logged-out `claude` resolves on PATH and answers `--version` exactly like a working one, then dies before the session exists. That is what our first external-user report (#1323) looked like from outside, with run branches piling up across six projects while the dashboard sat on "Waiting for the session to start...".

Preflight now also asks the CLI whether it is authenticated (`claude auth status`, `codex login status`) and warns when the daemon runs as root, where `sudo` moves `HOME` and both agents lose their credentials the same way. The daemon runs these before it allocates a run's checkout, so a doomed start is refused with the command that fixes it instead of costing a branch, and the launcher shows the same thing before you press Start, the way it already warns about folder trust (#1318). A CLI too old to answer the question is treated as unknown rather than logged out, so an unreadable answer never blocks a setup that works.
