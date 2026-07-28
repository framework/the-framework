The driver seam's contract: the one abstraction The Framework wraps a coding-agent CLI behind, treating the agent as a black box (prompt it, let its own loop run, read the code, gate on the outcome).

## TLDR

- `Driver` — `name`, `start(opts) → DriverSession`, optional `readQuota` (#521, account-wide), optional `handsOff` flag (#1225: the first prompt is the whole run — cloud driver).
- `DriverSession` — `id`, `cwd`, `prompt(text, opts) → DriverTurn` (each call a fresh invocation unless documented otherwise), optional `readCode(path)`, idempotent `dispose()`.
- `DriverStartOptions` — workspace `cwd`, `system` framing (personas are prompt-framing, option A from #166), `model`, session-wide `signal`, `resumeSessionId` (#720 revive a finished run), `onEvent` observer.
- `DriverPromptOptions` — per-call `system`, `signal`, `resume` (#714: continue the previous turn, best-effort).
- `DriverTurn` — final `text`, agent's own `sessionId` (the MVP persistence shortcut: forward the agent's transcript, #165), optional `usage`.
- Telemetry types: `DriverUsage` (#322 per-turn tokens + optional cost), `DriverRateLimit` (#517 per-turn traffic light), `DriverQuota`/`DriverQuotaWindow` (#521 proportion of window consumed — the only one that can fill a progress bar), `DriverQuotaUnavailableReason` + `isTransientQuotaReason`.
- `DriverEvent` — `start` / `text` / `action` (tool name only, never arguments) / `result` (with optional `sessionLink`, #1317) / `rate-limit` / `error` / `notice` (#778).

## Decisions

- The seam is deliberately the code and the outcome, never the agent's individual tool calls (guardrail from #165); events are forwarded for visibility but control flow never branches on them.
- Single execution path (#166 option A): everything runs through the driver; each loop pass (review/security/QA/UX) is a fresh `prompt` call.
- `costUsd` is optional and tokens are not (#540): Codex reports counts without a price; omitted cost means "unknown", never 0 (= free). Cost is a notional metered-API price under a subscription — actual spend is quota.
- `DriverRateLimit.status`/`window` are open strings, not unions: an unknown status is exactly the signal being captured for and must surface rather than be dropped.
- `DriverQuota` is modelled as available-or-not rather than an empty window list, so "we couldn't ask" can't be mistaken for "nothing is used".
- Quota-unavailable reasons split transient (`fetch-failed`, `timeout`, `unrecognized` — this attempt) from authoritative (`agent-not-found`, `no-subscription` — the setup); a retained reading may outlive the former, never the latter (#960).

## Facts

- `DriverRateLimit.resetsAt` is epoch milliseconds (the agent reports seconds; drivers convert).
- `DriverQuotaWindow.kind` has deliberately no `day`: Claude measures a 5h session and a week, nothing daily (#519 was specced against a limit that does not exist). `resetsAtText` stays prose — the agent prints no year, so parsing to an epoch would be guesswork.
