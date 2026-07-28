Status: open
Priority: 7
Topics: [bug, the-framework]
GitHub: [#1320](https://github.com/gemstack-land/the-framework/issues/1320)

# Web runs complete their work but cannot push: cloud container has no GitHub write access

## TLDR

`claude --cloud` hand-offs can produce sessions that finish their work, commit it on a branch, and then hit a proxy 403 ("GitHub access to this repository is not enabled for this session") on every push and API call — the work is stranded with zero local signal. The investigation in the thread settled the mechanism: `claude --cloud` has two creation paths, and on the affected machine it **always bundles** (uploads the local worktree) instead of cloning via the GitHub app. A bundle-upload session has no repo binding, and the proxy's per-repo GitHub grant follows the binding, not the account — so bundled sessions structurally cannot push, and teleport (which fetches from the remote) cannot recover them either. Filed upstream as anthropics/claude-code#81776 (repro on CLI 2.1.220 after `/web-setup`, relogin, and update all failed to change it).

## Why it matters

N fanned-out cloud sessions on an affected machine = N completed-and-stranded agents, discovered only by opening each session page by hand. This is the direct blocker for the 10-agent goal (#1327) on the `--cloud` path, and part of why maintainer direction moved to the extension-driven path (#1328).

## State of play (from the thread)

- Not a GitHub-side or account-settings problem: the `claude` app covers the org with `repository_selection: all`, `/web-setup` was completed, and the claude.ai UI repo picker works — UI-created sessions are repo-bound and push fine. Only the CLI hand-off path bundles.
- CloudDriver's "opens its own PR" promise is therefore true only on machines whose CLI handshake produces repo-bound sessions, and the driver cannot tell which mode it got — the session link looks identical. A cheap post-handoff canary is possible: require the session to push a marker ref first and report; no marker = bundled = warn immediately.
- The launcher preflight family (#1318) should grow a "cloud delivery unverified on this machine" state, flipped by the last verified round-trip.
- Stranded-work recovery recipe that works today: the session sends its commits as git-am patch attachments; download, `git am` onto a fresh branch from origin/main, test, push, PR.
- Diagnostic one-liner for any machine: `claude --cloud "Diagnostic: run git remote -v and say: clone or bundle. Change nothing."` — clone means delivery works on that box.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1320](https://github.com/gemstack-land/the-framework/issues/1320), created 2026-07-27, labels: `bug`, `priority: high`, `the-framework ♻️`, 6 comments (investigation log folded above).

### Original description

Found on the 3-run parallel web drive (2026-07-27). All three cloud sessions finished their tasks, committed clean work on a branch, and then hit the same wall: the proxy answers 403 "GitHub access to this repository is not enabled for this session" for both api.github.com and an authenticated push (anonymous read works). So a `claude --cloud` hand-off can produce a session that clones anonymously, does all the work, and never delivers it: no push, no PR, and from the local side pure silence (the run ended `done` at hand-off; nothing ever arrives).

Originally suspected cause was the account's Claude GitHub app not covering the repo; the thread's investigation (folded above) disproved that and located the real mechanism in the CLI's silent bundle-upload fallback.
