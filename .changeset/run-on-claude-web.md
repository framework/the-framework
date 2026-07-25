---
'@gemstack/the-framework': minor
---

"Run on: Claude web" is a real run target now, not a placeholder. Picking it hands the session to Claude Code on the web on your own account: the work runs on Anthropic's infrastructure at no local CPU cost, does its own git worktree and opens its own pull request, and the run view links straight to the session plus the `claude --teleport` command that pulls it back to this machine. Also available as `framework run --run-on web`.

This is a hand-off rather than a streamed run, and deliberately so: a cloud session exposes no read-back API of any kind, so following the work happens on claude.ai or through the branch it pushes. Nothing here drives the claude.ai UI — it goes through the CLI's own `--cloud` flag, with the same subscription auth every other target uses.
