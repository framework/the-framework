Status: open
Priority: 5
Topics: [enhancement, the-framework, ux]
GitHub: [#1235](https://github.com/gemstack-land/the-framework/issues/1235)

# Spike: pull a Claude web session back into a local run so its questions can be answered

## TLDR

A CC web session that needs a human is a dead end today; the proposal was a `Continue here` action that pulls the cloud session into an ordinary local run via `claude --teleport`, so all existing gates/feeds/handoff work unchanged. **The thread killed the teleport route**: `--teleport` is interactive-only — under `-p` it is silently ignored and a fresh local session runs at full cost (a pty doesn't help), so the spike's open question 1 is answered "no". The OP's "no read-back" premise was also corrected: the shipped CLI (2.1.220) contains a private session API (SSE `events/stream`, GET/POST `events`) that could stream and answer a cloud session — but it's undocumented (can break on any CLI update) and authenticates with the user's subscription credential (moves off the #495 posture). #1237 now carries the extension route; this stays open only for the drive-the-interactive-TUI teleport variant, judged worse than both alternatives.

## Why it matters

Some cloud runs genuinely need a decision, and #1234 only prevents deadlocks — it doesn't let anyone answer. The spike's measured findings (what the CLI actually supports vs what its flags pretend) are the ground truth any web-run interaction story must build on, and they redirect the effort to the #1237 extension bridge.

## Source

Imported from GitHub issue [gemstack-land/the-framework#1235](https://github.com/gemstack-land/the-framework/issues/1235), created 2026-07-26, labels: `enhancement`, `priority: medium`, `the-framework ♻️`, `UX ✨`, 1 comment.

### Original description

## The problem

A Claude web session that needs a human is a dead end today. It asks its question over there, and our dashboard can neither show it nor answer it. #1234 keeps a cloud run from parking on a question it invented no answer for, but it does not give the target an interaction story: some runs genuinely need a decision.

## What is actually possible

Verified 2026-07-26 on CLI 2.1.220, so this is measured rather than assumed:

- no read-back. `claude agents --json --all` lists local background agents only, and a `session_01...` cloud id does not appear. No status, transcript or output endpoint exists.
- no second message. `--cloud` starts a session; nothing sends another one to it.

The one official bridge is `claude --teleport <session_id>`, which pulls the session onto this machine. That is a takeover, not a peek: there is no way to look at a cloud session and leave it running there.

## Proposal

A `Continue here` action on the cloud run notice, which starts a local run resuming that cloud session. From that point it is an ordinary local session, so the existing choice gates, the live feed, the diff panel and the handoff all work unchanged, with no relay to build.

The cloud leg becomes the cheap unattended first pass, and the moment it needs a person you pull it local.

## Open questions, the reason this is a spike

1. **Can `--teleport` run behind the Driver seam at all?** `--cloud` only turned out to be drivable because it gates on stdout being a terminal and a pty satisfies that. Teleport may be genuinely TUI-only. Answering this is most of the spike, and a negative answer kills the proposal.
2. **What does teleport actually carry?** The whole conversation including the pending question, or only the branch the session pushed? If it is only the branch, the question is still lost and this buys much less than it looks.
3. **Product call: is a cloud run meant to be fire and forget?** The notice currently promises the session "opens its own pull request", which is a complete story on its own. `Continue here` makes the target a two-phase thing instead. That is a direction decision, not an implementation one, and it should be settled before anything is built.
4. **Who triggers it?** The user clicking, presumably, since the framework cannot detect that the session parked without read-back. Worth confirming that a manual trigger is acceptable rather than a limitation worth waiting out.

## Related

- #1234: stop cloud runs deadlocking on questions nobody can answer. That one is buildable today and does not depend on this.
- #1225 and #1231: the choices that were being shown were locally invented, and now are not.
- #610: the target itself.

### Notes from the GitHub thread

- Premise correction: read-back does exist — the CLI binary (2.1.220) contains a private session API: `GET /v1/code/sessions/{id}/events/stream` (SSE, resumable via `from_sequence_num`), `GET /v1/code/sessions/{id}/events?limit=&sort_order=desc`, `POST /v1/code/sessions/{id}/events`. Blocked on being undocumented (can break on any CLI update) and on authenticating with the user's subscription credential (moves off the #495 posture where the CLI holds its own).
- `--attach` / `--follow` / `--watch` are not real Claude Code flags — strings from bundled dependencies; `--help` short-circuits option validation and makes anything look accepted.
- `--teleport` cannot sit behind the driver seam: interactive-only; under `-p` it is silently ignored and a fresh local session runs instead at full cost — confirmed twice, including under a pty. Open question 1: answered, no.
- #1237 carries the extension route (avoids the credential problem by running in the user's own session); this issue stays open only for the interactive-TUI teleport option, which would mean scraping a terminal UI and is worse than both alternatives.
