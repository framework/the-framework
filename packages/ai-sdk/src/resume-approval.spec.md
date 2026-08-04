Approval-resume transcript reconstruction: after a run pauses on a human approval gate, rebuild a provider-valid tool transcript from the client's resubmitted history plus the approval decisions.

## Problems

- After a stop-on-approval pause, the history ends in an assistant message whose tool calls were never fulfilled — which providers (Anthropic especially) reject outright. Something must supply a result for every declared call before the conversation can continue.

## Decisions

- The walk: pop trailing placeholder tool messages from any prior partial resume → find the real parent assistant message behind trailing tool messages → collect already-resolved ids so approved tools are never double-executed → then per call: unknown tools error; unresolved client tools get an explicit error the model can recover from; rejections become JSON rejection results; **still-pending calls get placeholder results synthesized for themselves and every unresolved sibling** (keeping the tool-call/tool-result invariant while still paused); approved calls validate and execute, draining any generator yields silently.
- Deliberate deviations from the main loop: approval-resume bypasses middleware entirely (raw arguments), and a throwing model-output projection falls back silently — there is no middleware context to report through.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
