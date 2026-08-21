A driver that hands the whole task to Claude Code on the web: it starts a real cloud session on the user's own account and gives back the link where the work continues.

## User Stories

- The user hands a task to Claude Code on the web and gets back the link where the work continues on their own account.
- The user's cloud session works on the real repository — it clones from GitHub and can push and open a pull request.
- The user later finds the session's work adopted onto the run's dashboard record, even though the session named its own branch.

## Flows

- One agent spends one cloud session — ever. Every prompt after the first just reports the hand-off that already happened, without spending another session.
- The agent ends at the hand-off: a cloud session offers no way to read status, replies, or output back — only its link, plus a command to pull the session back locally. That the agent ends there is a fact of the web location, not something this driver declares.
- The project root is trusted for the CLI before the hand-off, so the CLI's interactive trust question — which a background run could never answer — does not fire. If a trust dialog appears anyway, the start fails fast and names the manual fix, instead of timing out with nothing to show.
- Nothing the user typed can ever reach a shell as syntax.
- The session is repo-bound: it clones from GitHub and can push, never a silently uploaded copy of the local checkout whose work could never leave the session's VM. The CLI's nonessential traffic is switched off for the invocation to keep it so.
- Before handing off, the run leaves an anchor on the repository — a marker commit unique to this run — and the session clones at it. Whatever branch the session then works on descends from that anchor, and that ancestry is how the daemon later recognizes which branch is this run's.
- If the anchor cannot be created or pushed, the hand-off still goes ahead with no starting point named, says so, and names `--teleport` as the recovery path; such a run is never matched to its branch.

## Rationales

- The one-session guard exists because the loop keeps prompting (plan, build, review): without it a single agent would fan out into several cloud sessions racing on one repo.
- The hand-off ending lives on the location rather than on the driver so later phases never mistake the driver's own summary for the agent's answer.
- Trusting the project root on the user's behalf is sound because starting a web agent is itself the user's trust decision, and worktrees inherit the root's trust, so one grant covers every agent workspace.
- With nonessential traffic disabled, the CLI's server-side bundle experiment reads off, so a failed GitHub-App preflight falls through to a repo-bound session instead of a silent local-bundle upload (#1320, anthropics/claude-code#81776).
- The anchor is an empty commit on top of the checkout's tip, rather than the tip itself, so it is unique to this run and is minted without moving any branch.
- The anchor's name carries no slash and is handed to the CLI explicitly, because the CLI's default is to pin the current local branch — which an agent workspace's local-only branch fails — and a slash-carrying name never resolves on the cloud side even when pushed (anthropics/claude-code#87235).

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
