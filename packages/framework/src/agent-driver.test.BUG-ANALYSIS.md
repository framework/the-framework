# Bug analysis: packages/framework/src/agent-driver.test.ts

## Business logic (high-level)

Tests for the run-target factory. Coverage against the test SPEC: `actions` → ActionsDriver
(with config), missing config → throws matching `/needs the repo owner/`, `web` → CloudDriver
(and `doesNotThrow` with zero config — the "CLI already holds the account" claim), everything
else (no target, `local`, `local`+codex) → the local drivers by instanceof.

Verification notes:
- The instanceof assertions are the right level for a factory: they pin *which* executor without
  running one (constructing ActionsDriver/CloudDriver performs no I/O — construction-time
  side effects would make these tests flaky, and none exist).
- `createAgentDriver({driver: 'claude'})` → ClaudeCodeDriver and `{driver: 'codex'}` →
  CodexDriver also pin that the local fall-through forwards the driver axis correctly.
- The throw test asserts on the message fragment, so a silent fallback-to-local regression (the
  worst failure: an unconfigured actions run silently running locally) cannot pass.
- The two `web` tests overlap (both construct with target 'web'); the second exists to document
  the zero-config claim explicitly — harmless duplication with documentary value.

No async, no fixtures, no cleanup needed. Every test can fail against a real regression.

## Functions (low-level)

- `ACTIONS` fixture — minimal owner/repo/token. Correct.
- Five `test(...)` blocks — analyzed above; assertions match their titles. Correct.

## Bugs found

None found.
