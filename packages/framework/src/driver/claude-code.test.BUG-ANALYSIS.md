# Bug analysis: packages/framework/src/driver/claude-code.test.ts

## Business logic (high-level)

Covers the Claude Code driver at three layers, and the assertions genuinely pin the SPEC claims:

- **`StreamJsonParser` unit tests** — session id announced from the first line and re-announced only on change (#1322); assistant text + tool names surfaced; the `result` line captured without emitting (the runner owns the `result` event); usage parsed with `costUsd` present, absent, and — the #540 pin — *absent-not-zero* verified via `hasOwnProperty` (so a `costUsd: undefined` property would fail, the strongest form); non-JSON noise ignored with assistant-text fallback; rate-limit telemetry with the real captured payload (seconds→ms asserted via `1784079000_000`), unknown status/window values passed through, and four malformed shapes silent. Note the malformed-shape test covers `{}`, `null` payload, missing `resetsAt`, and string `resetsAt` — but not a top-level `null` *line*, which is the crash recorded against the source file; a regression test for `p.push('null')` would be the natural pin for that fix.
- **`runClaude` process tests** — fake spawn streaming real-shaped lines; final turn, event ordering (`start` first, `result` last), non-zero exit rejecting with stderr detail (`/boom/`) and with streamed-text detail plus `error`-not-`result` event ordering.
- **`ClaudeCodeDriver`/`Session` behavior tests** — argv assembly (print mode + verbose + permission mode + system + model), mcp-config absent/present/stable-across-prompts/removed-on-dispose (checked on the real filesystem), resume chaining (`--resume sess-1`, no system append), seeded resume (#720), the #778 vanished-conversation retry (argv of both attempts, notice emitted, dead id dropped so the *next* resume uses the new id), no-retry on other failures (exactly one spawn), and resume-with-no-prior-id running fresh with framing.

Verification soundness spot-checks:

- The #778 retry test's fake returns exit-1 + the exact CLI phrase on call 1 and a normal turn on call 2, then asserts `calls.length === 2` and framing restored on the retry — this would catch both an over-eager retry (calls>2) and a lost message. It does not assert the held-`error` suppression (no `onEvent` assertion that zero `error` events surfaced on the recovered path) — the notice assertion is present but an `error`-free feed is the actual #778 UX promise; a `!events.some(e => e.type === 'error')` would strengthen it. Gap, not a defect.
- `fakeSpawn` wires `close` off stdout `end` with the scripted exit code, and returns captured argv via closure — each test's `captured`/`calls` are read only after the awaited prompt, so no ordering hazard.
- All async tests await their prompts and rejections; no floating promises; every assertion can fail.

## Functions (low-level)

- **`fakeSpawn(lines, code, stderr)`** — standard fake; stderr delivered as one chunk (multibyte-split decoding is exercised only implicitly; the Buffer-concat behavior is source-side). Verdict: correct.
- **Individual tests** — as analyzed above; each asserts observable behavior causally tied to its claim. Verdict: correct.

## Bugs found

None found.
