The first real driver: wraps the Claude Code CLI so the product runs work on the user's own Claude subscription, one fresh non-interactive invocation per prompt.

## User Stories

- The user picks Claude Code and the work runs on their own Claude subscription.
- The user chats with a live agent — or reopens a finished one — and every message continues the same conversation.
- The user hands the agent extra capabilities, like a real browser to drive, without giving up any of their own tools.

## Flows

- File edits are auto-accepted by default so agents never stall on a permission prompt; skipping the CLI's permission system entirely is a separate, explicit opt-in meant for sandboxes.
- The user's chat message resumes the agent's previous conversation, so it lands with full context. When the CLI has forgotten that conversation, the turn reruns fresh with a notice rather than losing the message the user already typed — and no failed turn is shown for one that recovered.
- Extra capabilities are offered as additional tool servers that merge with the user's own, never replacing them.
- The CLI's stream is mined for free telemetry — the session id (announced at the start of the turn), assistant text, tool names, per-turn token and cost accounting, and the account's quota standing — which is what the dashboard's transcript and spend readout draw from, with no extra calls.

## Rationales

- The session id is captured at the start of the turn because a stopped or killed turn would otherwise take the agent's resume handle down with it.

## Before modifying/creating SPEC.md files

You must always read and respect https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
