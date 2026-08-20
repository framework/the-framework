A driver that hands the whole task to Claude Code on the web: it starts a real cloud session on the user's own account and gives back the link where the work continues.

## Flows

- One agent, one cloud session — ever. Every prompt after the first just reports the hand-off that already happened, without spending another session.
- The agent ends at the hand-off: a cloud session offers no way to read status, replies, or output back — only its link, plus a command to pull the session back locally. That the agent ends there is a fact of the web location, not something this driver declares.
- The project root is trusted for the CLI before the hand-off, so the CLI's interactive trust question — which a background run could never answer — does not fire. A dialog that appears anyway (the write failed or was rejected) still fails fast with the manual fix named instead of timing out with nothing to show.
- Nothing the user typed can ever reach a shell as syntax.
- The session it creates is repo-bound — it clones from GitHub and can push — never a silently uploaded local bundle whose work could never leave the VM; the CLI's nonessential traffic is switched off for the invocation to keep it so.
- Before the hand-off, HEAD is pushed to origin under the agent's own slash-free id and the session is told to clone at that ref. A push that fails hands the ref choice back to the CLI's own default and says so, naming `--teleport` as the recovery path.

## Rationales

- The one-session guard exists because the loop keeps prompting (plan, build, review): without it a single agent would fan out into several cloud sessions racing on one repo.
- The hand-off ending lives on the location rather than on the driver so later phases never mistake the driver's own summary for the agent's answer.
- Trusting the project root on the user's behalf is sound because starting a web agent is itself the user's trust decision, and worktrees inherit the root's trust, so one grant covers every agent workspace.
- With nonessential traffic disabled, the CLI's server-side bundle experiment reads off, so a failed GitHub-App preflight falls through to a repo-bound session instead of a silent local-bundle upload (#1320, anthropics/claude-code#81776).
- The ref is minted slash-free and handed over explicitly because the CLI's default revision pin is the current local branch — which an agent workspace's local-only branch fails — and a slash-carrying ref never resolves on the cloud side even when pushed (anthropics/claude-code#87235).

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
