Browser-safe barrel for the dashboard client (#431): re-exports only pure, Node-free logic so the client bundle never drags in the server barrel (relay, sandbox, node:fs/http).

## TLDR

- Agent vocabulary, `formatFrameworkEvent`, event/run-view projections (`loopStatus`, `sessionInfo`, `runProgress`, `handoffState`, …).
- Prompt work: system-prompt composition (#520), preset catalog + renderers (#433/#874) — so the dashboard shows/edits the exact prompt before a run.
- `AUTO_PM_ROUTINES` and jobs (#1159): the dashboard lists the very jobs the daemon runs, not a copy.
- Shared daemon/dashboard rules: notifier keys (#627), preference defaults, preferences→run-options mapping (#858), Discord credential precedence + validation (#1095).

## Decisions

- Everything reachable from here must be importable in a browser; `loadUserSystemPrompt` (the one Node-bound system-prompt export) deliberately lives in `system-prompt-file.ts` and stays out.
- Sharing the pure logic with the daemon exists to prevent silently drifting dashboard copies (identity/diff, defaults, validation).

## Facts

- The no-`node:*` contract is enforced mechanically by `client.test.ts`, which walks the compiled import graph.
