The driver seam: the one abstraction a coding agent is wrapped behind, so the whole product works the same whether the work happens in a local Claude Code or Codex process, a Claude cloud session, a GitHub Actions job, or a deterministic fake.

## TLDR

- A driver can start a session, prompt it turn by turn, read the resulting code, report the account's quota, and dispose. That is the entire contract — deliberately *the code and the outcome*, never the agent's inner workings. Tool calls surface only as named actions for the watching human; their arguments are never seen and never branched on.
- Each turn runs the agent's own loop to completion as a black box. A turn whose process exits abnormally fails, even if it streamed plausible text first — the product gates on outcomes, so a crash mid-work must not pass as a result.
- The agent's session id is captured from the first thing it says, not from the end of the turn, so a stopped or killed turn cannot take the resume handle with it. A resume that fails because the agent forgot the conversation silently reruns fresh, with a notice, rather than losing the message the user already sent.
- Every agent runs as its own process tree, and interrupting a run (or the framework dying) kills the whole tree — no stray agent processes outlive their run.

## Flows

- **Local agents.** Claude Code runs with edits auto-accepted by default; skipping its permission system entirely is an explicit opt-in. Codex runs inside its own workspace sandbox and the bypass is never passed. Extra capabilities (e.g. the real browser) are merged alongside the user's own tools, never replacing them.
- **Hands-off locations.** A cloud session is handed the task exactly once per run — so one run can never fan out into several cloud sessions racing on one repo — and the run ends with the link: there is nothing to read back. Whether later phases run is a fact about *where* the turn executed, so it is settled by the location rather than declared by the driver. A GitHub Actions run is dispatched, polled, and read back from the transcript the workflow uploads; continuity between turns is the branch the previous turn pushed plus the carried session id, and it requires a real user's token — bot-triggered agent runs are refused.
- **Quota and cost.** Drivers that can, report the account's quota window: read via the agent's own usage command, and for free between turns from the telemetry the stream already carries. A transient failure (network, timeout, reworded readout) leaves the last good reading in force; "the agent isn't installed / has no subscription" invalidates it. A driver that cannot price turns reports cost as unknown — never zero — so the budget cap simply cannot fire rather than counting everything as free.
- **The fake.** A scripted, offline driver that exercises every path deterministically — the product's whole lifecycle is testable without spending a token.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
