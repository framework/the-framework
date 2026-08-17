A driver that hands the whole task to Claude Code on the web: it starts a real cloud session on the user's own account and gives back the link where the work continues.

## TLDR

- One agent, one cloud session — ever. The loop keeps prompting (plan, build, review), so without this guard a single agent would fan out into several cloud sessions racing on one repo; every prompt after the first just reports the hand-off that already happened.
- The agent ends at the hand-off: a cloud session offers no way to read status, replies, or output back — only its link, plus a command to pull the session back locally. The location says so, so later phases never mistake this driver's own summary for the agent's answer.
- A workspace the agent was never trusted in fails fast with the one-time fix named (trust the project root once; agent workspaces inherit it) instead of timing out with nothing to show — and the driver never answers the trust question itself, since that is the user's call.
- Nothing the user typed can ever reach a shell as syntax.
- The session it creates is repo-bound, not a bundle (#1320): with nonessential traffic disabled the CLI's server-side bundle experiment reads off, so a failed GitHub-App preflight falls through to a session that clones from GitHub and can push — instead of silently uploading a local bundle whose work can never leave the VM (anthropics/claude-code#81776).
- Before the hand-off, HEAD is pushed to origin under the agent's own id: the CLI's default revision pin is the current local branch — which an agent workspace's local-only branch fails — and a slash-carrying ref never resolves on the cloud side even when pushed (anthropics/claude-code#87235), so the ref is minted slash-free and handed over explicitly. A push that fails degrades to the old behavior and says so, naming `--teleport` as the recovery path.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
