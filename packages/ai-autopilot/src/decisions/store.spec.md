Persistence for the ledger: `loadLedger`/`saveLedger` round-trip a `DecisionLedger` to a `DECISIONS.md` file through the minimal `LedgerFs` seam.

## TLDR

- `LedgerFs` = `{ read, write, exists }` — deliberately a subset of the runner's `RunnerFs`, so a booted `RunnerSession.fs` satisfies it directly and the ledger persists inside a sandbox the same way as on the host.
- `loadLedger(fs, path = DECISIONS_FILE)`: a missing file yields an empty ledger (the expected first-run state) so callers never branch on existence.
- `nodeLedgerFs()` — the host adapter over `node:fs/promises`; `exists` is a `stat().isFile()` that swallows errors.

## Decisions

- `node:fs/promises` is imported dynamically inside each method, keeping the decisions core free of a hard `node:fs` dependency — ledger + markdown work in any runtime; only this adapter touches disk.

## Facts

- `DECISIONS_FILE = 'DECISIONS.md'`, resolved at the project/workspace root by default.
