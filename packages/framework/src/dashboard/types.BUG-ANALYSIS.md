# Bug analysis: packages/framework/src/dashboard/types.ts

## Business logic (high-level)

A types-only leaf: the request/result vocabulary the dashboard's Start / Add / Preview RPCs speak, deliberately placed so the HTTP server, the RPC mount, and the RPC implementations depend on this file rather than on each other. No executable code — nothing can crash, race, or leak here; the review is whether the declared shapes match `types.SPEC.md` and the consumers.

Checked against the SPEC:

- `StartAgentOptions` carries every option the SPEC's "What a Start can ask for" lists: vanilla/transparent, context dirs, onBeforeMergeable, browser, handoff (absent → repo file → `pr` default), model, driver, target, unattended, ticket + planAgent (the plan-must-not-close-the-issue rule, #1334), resumeSession, continueAgentId, and the memory-only `remote {url, token, label}` device relay config with its "never persisted, stripped before forwarding" contract documented on the field (the stripping itself is enforced in relay-endpoints and pinned by server.test.ts).
- `StartAgentKind = 'build' | 'research' | 'prompt'` — three kinds per SPEC.
- `StartAgentResult` — `agentId` optional on success (present whenever the agent got a worktree, per #761), failure carries `error` and the distinguishing `busy` flag. Matches "a refusal says whether it was busy".
- `OnboardingSuggestion` — both fields nullable so a relay host discloses no filesystem layout; the withholding itself is the wiring's job.
- `DriverReady` — problems/warnings as human-ready strings; `problems` empty when ok (documented invariant, enforced by producers).
- `AddProjectResult`, `RemoveWorktreeResult`, `DeleteAgentResult`, `PreviewResult`, `PreviewStatus`, `AgentWorktree` (incl. the `pr` vs `prPending` distinction — "no PR" vs "lookup still running", #1028) — all consistent with the SPEC's TL;DR bullets.

Potential type-level hazards considered: optional-field unions here are all discriminated by `ok` where a consumer must branch — no shape allows an ambiguous read (e.g. `PreviewStatus` intentionally non-discriminated because `running: false` with stale `url` is never produced). Imports are type-only (`HandoffLevel`, `AgentLocation`, `LinkedPr`), so the leaf stays browser-safe with no runtime edges.

## Functions (low-level)

No functions, components, or runtime constants — interfaces and type aliases only. Nothing of consequence beyond the shape review above.

## Bugs found

None found.
