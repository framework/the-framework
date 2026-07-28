Preflight checks for a live run: verify the picked agent's CLI is installed and runnable so a missing prerequisite fails early and clearly instead of spawning a broken process mid-run.

## TLDR

- `preflight(opts)` returns `{ ok, checks[] }`: Node is implicit ok (we are running), then the agent's binary is probed with `<bin> --version` (10s timeout).
- Probes the agent the run actually picked (#542): `--agent codex` is checked against `codex` and fails on codex missing, not claude. Default agent `claude`; bin defaults to the agent spec's own.
- A failed check carries the agent spec's `installHint` as the fix; success carries the version string.
- `--fake` runs need none of this — preflight only gates live runs.
- `VersionProbe` is injectable so tests need no real CLI.
