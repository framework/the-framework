The second real driver: wraps the Codex CLI so the product runs the same way on the user's own ChatGPT subscription.

## TLDR

- Codex works inside its own workspace sandbox — it can edit the workspace it was pointed at and nothing else — and the sandbox-bypass option is never passed.
- Codex takes no separate system prompt, so role framing is prepended to the prompt; the same words reach the agent.
- It reports tokens but never a price, so turns carry the counts with the cost left unknown — never zero — which means the budget cap simply cannot fire here; cached input is split out of the inclusive total and reasoning tokens are not double-counted, so accounting means the same thing across agents.
- No quota read: an agent that can't report one simply doesn't.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
