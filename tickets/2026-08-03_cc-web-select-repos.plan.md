Effort: 3
Uncertainty: 6

# [Plan] [CC Web] Select repos

The ticket's repo-picking step only exists on the unmerged extension-created-sessions path; on the shipped `--cloud` path there is no picker, so the actionable remainder is the "show an error when the repo isn't available in CC web" half — plus the "select all repos" default, parked until extension session-creation lands.

## TLDR

The ticket (issue #1498, 2026-08-03) was filed against the extension-driven new-session flow: the claude.ai UI asks which repositories the session may use, and the ask is (a) select all available repos by default instead of making the user pick, (b) show an error in our UI when the needed repo isn't available (user never added it in CC web). Since then the landscape moved:

- **Shipped path — `claude --cloud`** (`packages/the-framework/src/driver/cloud.ts`): repo-bound to the workspace's origin, no repo picker anywhere, and working as of 2026-08-17 (#1544 provisioning fix + #1518 behavior fix; evidence run → PR #1546, see `tickets/2026-08-03_cc-web-doesnt-work.plan.md`). Half the ticket ("don't make the user pick") is already true here by construction.
- **Unmerged path — extension-created sessions** (`origin/suleimansh/feat/1328-extension-sessions`, refs #1328): daemon queues repo+branch+prompt, `createSession` in the extension drives the claude.ai repo picker → branch picker → composer. This is the flow the issue's screenshot shows, and the only place a "select repos" default can be implemented.

Recommended scope now: implement the error half on the shipped path (a named-cure failure for "repo not connected in CC web", mirroring the existing trust-prompt precedent), and park the select-all-by-default half behind #1328's branch landing. The ticket itself licenses this: "if driving CC Web turns out too complex, polishing its UX can be deprioritized — but making it work cannot", and making it work is done.

## Problems

1. **Which path is the roadmap? — uncertainty 6.** Maintainer direction 2026-07-28 (#1328) said invest in the extension, not `--cloud`, because `--cloud` bundled and couldn't push (#1320). #1544 has since fixed exactly that, `--cloud` is the path that just proved out end to end, and the extension-creation branch is unmerged with no merge base against main. Whether extension-created sessions are still wanted (they buy multi-repo sessions and observability, at DOM-fragility cost) is a maintainer call this plan should not assume.
2. **What `--cloud` prints when the repo isn't connected — uncertainty 5.** With `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` a failed GitHub-App preflight falls through to a repo-bound session (`cloud.SPEC.md`), but an account that never added the repo to CC web at all is a different case: creation may fail with CLI output we've never captured, or worse, succeed and have the *in-session* clone fail — invisible to us, since a cloud session has no read-back API. Needs one live test against an account/repo that isn't connected before any pattern-matching code is written.
3. **Is the claude.ai repo picker multi-select? — uncertainty 4.** "Select all available repositories" presumes it is. The issue screenshot is not fetchable from this sandbox (proxy-scoped), and the picker's markup is exactly the "someone else's UI" risk `createSession` documents. Verify on the live page before coding the default.

## Solutions

- Problem 1: do the path-independent piece now (error surfacing on `--cloud`), keep the picker default as a follow-up condition on #1328 — no bet on the roadmap either way. Alternative: ask the maintainer first and do nothing until answered; rejected because the error half is wanted under both futures.
- Problem 2: capture the real failure output once (live test), then pattern-match it in `cloud.ts` exactly like `TRUST_PROMPT` — detect, emit a notice naming the cure, abort with a message that names it too. Alternative shortcut: skip detection and just append a static hint ("if this repo was never added to Claude Code on the web, add it at claude.ai/settings and retry") to the existing generic `no cloud session was created` failure — zero-risk, ships without the live test, catches less precisely.
- Problem 3: if the picker is multi-select, select every offered repo; if single-select, pick the queued repo and treat "select all" as satisfied vacuously (one repo per session). Either way, "queued repo not among the options" becomes a distinct machine-readable failure (`repo-not-available`) posted back on the bridge — an enum reason, keeping the bridge's no-free-text input property — which `CloudAgentNotice` renders as an error with the "add it in CC web" cure.

## Considerations

- **The trust-prompt precedent is the template** (`cloud.ts` `TRUST_PROMPT` / `trustAdvice`): detect a specific park-state in pty output, name the one-time fix against the durable path, abort instead of timing out. The repo-not-connected failure wants the identical shape.
- **No read-back API bounds what "show an error in the UI" can mean on `--cloud`**: creation-time failures are catchable; post-creation clone failures happen in a cloud VM we cannot query. The best-effort extension mirror (#1265) is the only surface that could ever see those; not worth building on for this ticket.
- **"UX over safety for now" is a real trade**: selecting all connected repos means a prompt-injected or confused session can touch every repo the user ever added, not just the target. The ticket explicitly accepts this today; when implemented, record it as a decision in `MEMORY.md` so it gets revisited deliberately rather than inherited.
- **Bridge input surface stays closed**: the start-queue branch's property — extension posts back only an id, a boolean and a session id, never free text — must survive the new failure reason; hence an enum, not a message string.
- **Cheap-first ordering**: the static-hint shortcut (Solutions, problem 2) can ship immediately and be upgraded to real detection after the live capture; they are not exclusive.

## Implementation

1. **Now, on the shipped path**: live-test `claude --cloud` from a repo not added to CC web; capture the pty output. Add detection + named-cure notice/abort in `cloud.ts` following the `TRUST_PROMPT` pattern (or ship the static-hint fallback first if the live test can't be run promptly). Test alongside the existing trust-prompt tests in `cloud.test.ts`.
2. **When (if) `suleimansh/feat/1328-extension-sessions` lands**: in `createSession`, select all repos the picker offers (multi-select case) instead of only the queued one; add the `repo-not-available` enum failure to the bridge post-back when the queued repo is absent; render it in `CloudAgentNotice` with the "add the repo in CC web, then retry" cure.
3. Step 2 is blocked on #1328; if that branch is abandoned in favor of `--cloud`, close this ticket after step 1 — on the `--cloud` path there is no picking step left to default away.
