A driver that hands the whole task to Claude Code on the web: it starts a real cloud session on the user's own account and gives back the link where the work continues.

## TLDR

- One run, one cloud session — ever. The loop keeps prompting (plan, build, review), so without this guard a single run would fan out into several cloud sessions racing on one repo; every prompt after the first just reports the hand-off that already happened.
- The run ends at the hand-off: a cloud session offers no way to read status, replies, or output back — only its link, plus a command to pull the session back locally — so the driver declares itself hands-off and later phases never mistake its own summary for the agent's answer.
- A workspace the agent was never trusted in fails fast with the one-time fix named (trust the project root once; run workspaces inherit it) instead of timing out with nothing to show — and the driver never answers the trust question itself, since that is the user's call.
- Nothing the user typed can ever reach a shell as syntax.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
