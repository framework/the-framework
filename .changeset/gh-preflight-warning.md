---
'@gemstack/the-framework': patch
'@gemstack/framework-dashboard': patch
---

The launcher warns when a PR/merge rung is armed and `gh` cannot deliver it (#1419): the handoff publishes through the GitHub CLI, so a missing or logged-out `gh` used to surface hours later as publishing that silently stopped at the pushed branch. The #1326 preflight gains a `publish` half probing `gh --version` and `gh auth status` — warnings that name the fix (`brew install gh` / cli.github.com, `gh auth login`), never blocks: the session's own work needs no gh and the push rung is plain git. Probed only while a PR/merge rung is armed on a local run.
