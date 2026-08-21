The driver seam: the one abstraction a coding-agent CLI is wrapped behind, so the whole product works the same whether the work happens in a local Claude Code or Codex process, a Claude cloud session, a GitHub Actions job, or a deterministic fake.

## User Stories

- The user picks which coding-agent CLI does the work — Claude Code or Codex — and nothing built on top changes with the pick.
- The user's work runs on their own subscription — Claude or ChatGPT — never on an API key held by the product.
- The user sends the same task to their own machine, a GitHub Actions runner, or a Claude Code cloud session.
- The user watches the agent work — its words, its tool calls as named actions — and sees what each turn spent.
- The user sees where the account's subscription quota stands on the dashboard.

## Flows

- **The contract.** A driver can start a session, prompt it turn by turn, read the resulting code, report the account's quota, and dispose — that is the entire contract. Tool calls surface only as named actions for the watching human; their arguments are never seen and never branched on.
- **Black-box turns.** Each turn runs the CLI's own loop to completion as a black box. A turn whose process exits abnormally fails, even if it streamed plausible text first.
- **The resume handle.** The session id is captured from the first thing the CLI says, not from the end of the turn. When the user's message tries to resume a conversation the CLI has forgotten, the turn reruns fresh with a notice — the message is never lost, and no failed turn is shown for one that recovered.
- **Process hygiene.** Every CLI invocation runs as its own process tree, and stopping an agent (or the framework dying) kills the whole tree — no stray processes outlive the agent that spawned them.
- **Local CLIs.** Claude Code runs with edits auto-accepted by default; skipping its permission system entirely is an explicit opt-in. Codex runs inside its own workspace sandbox and the bypass is never passed. Extra capabilities (e.g. the real browser) are merged alongside the user's own tools, never replacing them.
- **Hands-off locations.** A cloud session is handed the task exactly once per agent — so one agent can never fan out into several cloud sessions racing on one repo — and it ends with the link: there is nothing to read back. Whether later phases run is a fact about *where* the turn executed, so it is settled by the location rather than declared by the driver. A GitHub Actions workflow run is dispatched, polled, and read back from the transcript the workflow uploads. Its continuity between turns is the branch the previous turn pushed plus the carried session id, and its dispatch requires a real user's token — a bot-triggered run is refused.
- **Quota and cost.** Drivers that can, report the account's quota window: read via the CLI's own usage command — the reading that fills the dashboard's usage panel — and for free between turns from the telemetry the stream already carries. A transient failure (network, timeout, reworded readout) leaves the last good reading in force; "the CLI isn't installed / has no subscription" invalidates it. A driver that cannot price turns reports cost as unknown — never zero — so an unpriced agent never reads as free.
- **The fake.** A scripted, offline driver that exercises every path deterministically — the product's whole lifecycle is testable without spending a token.

## Rationales

- The contract is deliberately *the code and the outcome*, never the CLI's inner workings: gating on what the agent produced keeps each CLI's own loop untouched and swappable.
- An abnormal exit fails the turn even after plausible text because the product gates on outcomes — a crash mid-work must not pass as a result.
- The session id is captured at the start of the turn because a stopped or killed turn would otherwise take the resume handle down with it.

## Glossary

- **driver** — the wrapper that puts one coding-agent CLI behind this seam's single contract; swapping the driver swaps the agent, and nothing built on top changes.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
