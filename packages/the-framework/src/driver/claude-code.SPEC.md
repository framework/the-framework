The first real driver: wraps the Claude Code CLI so the product runs work on the user's own Claude subscription, one fresh non-interactive invocation per prompt.

## TLDR

- File edits are auto-accepted by default so agents never stall on a permission prompt; skipping the CLI's permission system entirely is a separate, explicit opt-in meant for sandboxes.
- A chat turn can resume the agent's previous conversation so the message lands with full context; when that conversation no longer exists, the turn reruns fresh with a notice rather than losing the message the user already typed — and without showing a failed turn for one that recovered.
- Extra capabilities (like the real browser) are offered as additional tool servers that merge with the user's own, never replacing them.
- The agent's stream is mined for free telemetry: its session id — announced at the start of the turn, so a stopped or killed turn can't take the resume handle with it — assistant text, tool names, per-turn token/cost accounting, and the account's quota standing.

## Before writing SPEC.md files

Read https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
