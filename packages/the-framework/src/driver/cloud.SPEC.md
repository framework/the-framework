A driver that hands the whole task to Claude Code on the web: it starts a real cloud session on the user's own account and gives back the link where the work continues.

## TLDR

- One agent, one cloud session — ever. The loop keeps prompting (plan, build, review), so without this guard a single agent would fan out into several cloud sessions racing on one repo; every prompt after the first just reports the hand-off that already happened.
- The agent ends at the hand-off: a cloud session offers no way to read status, replies, or output back — only its link, plus a command to pull the session back locally. The location says so, so later phases never mistake this driver's own summary for the agent's answer.
- The project root is trusted for the CLI before the hand-off — worktrees inherit the root's trust, and starting a web agent is itself the user's trust decision — so the CLI's interactive trust question, which a background run could never answer, does not fire. A dialog that appears anyway (the write failed or was rejected) still fails fast with the manual fix named instead of timing out with nothing to show.
- Nothing the user typed can ever reach a shell as syntax.
- The session it creates is repo-bound, not a bundle (#1320): with nonessential traffic disabled the CLI's server-side bundle experiment reads off, so a failed GitHub-App preflight falls through to a session that clones from GitHub and can push — instead of silently uploading a local bundle whose work can never leave the VM (anthropics/claude-code#81776).
- Before the hand-off, the anchor is pushed to origin under the agent's own id: an empty commit on top of HEAD, unique to this run and minted without moving any branch. The session clones at it, so the branch it does its work on — a name of the cloud's own choosing — descends from it, and that ancestry is how the daemon later recognizes which branch is this run's. The ref is explicit and slash-free because the CLI's default revision pin is the current local branch — which an agent workspace's local-only branch fails — and a slash-carrying ref never resolves on the cloud side even when pushed (anthropics/claude-code#87235). A push that fails degrades to the old behavior and says so, naming `--teleport` as the recovery path; a repo where the anchor cannot be minted hands off plain HEAD, and the run is simply never matched to its branch.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
