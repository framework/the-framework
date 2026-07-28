---
'@gemstack/the-framework': patch
---

An Actions run now falls back to the `gh` CLI's credential when `GH_TOKEN` is unset. The framework already opens every one of its PRs through the authenticated `gh` CLI, but `--run-on actions` demanded a raw environment variable and failed the run without it — so a machine that could open a PR still could not run a single Actions session, with the credential sitting one `gh auth token` away. The environment variables stay the override, since CI sets them and must beat whatever `gh` is logged in as on the runner. When there is no token to be had either way, the run says both ways to fix it and which process needs it: the daemon hands each run its own environment, so exporting the variable in a shell does nothing for a daemon that is already up.
