The second real driver: wraps the Codex CLI so the product runs the same way on the user's own ChatGPT subscription.

## User Stories

- The user picks Codex and the same product runs on their own ChatGPT subscription instead.

## Flows

- Codex works inside its own workspace sandbox — it can edit the workspace it was pointed at and nothing else — and the sandbox-bypass option is never passed.
- Codex takes no separate system prompt, so role framing is prepended to the prompt; the same words reach the CLI.
- Codex reports tokens but never a price, so turns carry the counts with the cost left unknown — never zero — and the budget cap simply cannot fire here. Cached input is split out of the inclusive total and reasoning tokens are not double-counted, so a token count means the same thing whichever CLI the user picked.
- No quota read: a driver that can't report one simply doesn't.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
