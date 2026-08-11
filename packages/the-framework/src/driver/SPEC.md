The driver seam: the one abstraction a coding agent is wrapped behind, so the whole product works the same whether the work happens in a local Claude Code or Codex process, a Claude cloud session, a GitHub Actions job, or a deterministic fake.

## TLDR

- A driver can start a session, prompt it turn by turn, read the resulting code, report the account's quota, and dispose — that is the entire contract, deliberately *the code and the outcome*, never the agent's inner workings.
- Each turn runs to completion as a black box; a turn whose process exits abnormally fails, even if it streamed plausible text first.
- Every child process is its own process group and a registry kills whole groups, so an interrupted session cannot orphan a tree of helpers.

## Flows

- **Local agents.** Claude Code runs with edits auto-accepted by default; skipping its permission system entirely is an explicit opt-in. Codex runs inside its own workspace-write sandbox and the bypass flag is never passed. Extra MCP servers (e.g. the browser tools) are merged alongside the user's own, never replacing them.
- **Hands-off targets.** A cloud session is handed the task once and the run ends with the link: there is nothing to read back, and the driver flags itself hands-off so later phases don't mistake its own summary for the agent's answer. A GitHub Actions run is dispatched, polled, and read back from the transcript the workflow uploads; continuity between turns is the branch the previous turn pushed plus the carried session id.
- **Quota and cost.** Drivers that can, report the account's quota window — read via the agent's own usage command, and cheaply between turns from the rate-limit telemetry the stream already carries. A failed read is classified: a transient failure (network, timeout) leaves the last good reading in force, while "the agent isn't installed / has no subscription" invalidates it.
- **The fake.** A scripted, offline driver that exercises every path deterministically — the product's whole lifecycle is testable without spending a token.

## Rationales

- Tool calls surface only as named actions for the watching human; their arguments are never seen and never branched on — that is what keeps the agent a black box.
- An abnormal exit fails the turn even after plausible text because the product gates on outcomes, and a crash mid-work must not pass as a result.
- The agent's session id is captured from the first thing it says, not from the end of the turn, so a stopped or killed turn cannot take the resume handle with it.
- A resume that fails because the agent forgot the session silently reruns as a fresh conversation, with a notice, rather than losing the message the user already sent.
- A graceful stop escalates to a hard kill only after a grace period.
- The task is handed to a cloud session exactly once per session, so one run can never fan out into several cloud sessions racing on one repo.
- The GitHub Actions driver requires a real user's token — it refuses bot-triggered agent runs.
- A driver that cannot price turns reports cost as unknown — never zero — so the budget cap simply cannot fire rather than counting everything as free.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
