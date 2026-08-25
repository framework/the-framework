# Bug analysis: packages/framework/src/driver/types.ts

## Business logic (high-level)

The driver seam's vocabulary: the `Driver` / `DriverSession` contract (start, prompt, readCode, dispose), per-turn outcome (`DriverTurn`), spend accounting (`DriverUsage`), the per-turn traffic light (`DriverRateLimit`), the account-wide quota reading (`DriverQuota` / `DriverQuotaWindow` / `DriverQuotaUnavailableReason`), and the black-box progress events (`DriverEvent`). Almost entirely type declarations; the single piece of executable code is `isTransientQuotaReason`.

Invariants stated here and depended on elsewhere:

- **Optional capabilities are omitted, never faked** — `readQuota?`, `readCode?`, `resume` best-effort. Codex omits `readQuota` (verified in `codex.ts`), Cloud omits `readCode` and `readQuota` (verified in `cloud.ts`).
- **`costUsd` omitted ≠ 0** — the budget gate reads 0 as free, absent as unknown. `claude-code.ts#parseUsage` and `codex.ts#parseCodexUsage` both honor this (spread-conditional, never default 0).
- **`DriverRateLimit.status` / `.window` deliberately open strings** — unknown values must surface. Parsers pass them through unfiltered; consistent.
- **`resetsAt` is epoch milliseconds** while the agent reports seconds — the ×1000 conversion lives in `claude-code.ts#parseRateLimit`; consistent.
- **`DriverQuota` is available-or-not**, never an empty windows list meaning "unused" — `claude-code-quota.ts#parseQuotaReadout` returns `{available:false}` when no window parses; consistent.
- **Transient vs authoritative failure reasons** — `fetch-failed`/`timeout`/`unrecognized` describe one attempt; `agent-not-found`/`no-subscription` describe the setup. `isTransientQuotaReason` encodes exactly that split, and the test (`claude-code-quota.test.ts`) pins all five values.

Cross-checked against `driver-names.ts`: `DriverImplId` values used by the five implementations (`claude-code`, `codex`, `claude-web`, `github-actions`, `fake`) all exist in the union; `driverFromImpl` collapses the three Claude surfaces to `claude`.

One doc-level nuance, not a defect: the `types.SPEC.md` sentence "The read always ends … the user cancelling, and the read taking too long … each produce their own distinct outcome" is implemented in `claude-code-quota.ts` with cancel and timeout sharing the `timeout` reason (`DriverQuotaUnavailableReason` has no `aborted` member). Since both are transient and an aborted read's result is discarded by the caller, this reads as a deliberate collapse; noted in `claude-code-quota.BUG-ANALYSIS.md`.

## Functions (low-level)

- **`isTransientQuotaReason(reason)`** — returns true for `fetch-failed` | `timeout` | `unrecognized`, false otherwise. Exhaustive over the union (2 remaining members are the setup reasons). Pure, total, no edge cases (TypeScript restricts the input to the union; a widened string would return false, the safe default — a retained reading would be dropped rather than kept forever). Verdict: correct.
- **`DriverEvent` union** — includes `session` (announced at turn start, #1322) and `result` with optional `sessionLink` / `anchorSha` (#1317/#1601). All emitters observed (claude-code, codex, cloud, fake, cli-session) stay within this shape. Verdict: correct.
- Remaining exports are `interface`/`type` declarations with no runtime behavior.

## Bugs found

None found.
