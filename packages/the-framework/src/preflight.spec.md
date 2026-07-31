Preflight checks for a live run: verify the picked agent's CLI is installed, logged in, and not being run as root, so a missing prerequisite fails early and clearly instead of spawning a broken process mid-run.

## TLDR

- `preflight(opts)` returns `{ ok, checks[] }`: Node is implicit ok (we are running), then the agent's binary is probed with `<bin> --version` (10s timeout), then its login state.
- Probes the agent the run actually picked (#542): `--agent codex` is checked against `codex` and fails on codex missing, not claude. Default agent `claude`; bin defaults to the agent spec's own.
- A failed check carries the agent spec's `installHint` as the fix; success carries the version string.
- Auth (#1326): each agent's `AgentAuthSpec` says how to ask (`claude auth status`, `codex login status`) and how to read the answer. Only an explicit "logged out" fails; an unrecognised answer is unknown and never blocks, because a wrong refusal is worse than the dead run this prevents. Skipped when the binary itself is missing.
- Publish (#1419): `publish: true` (the launcher's PR/merge rung is armed) also probes `gh --version` then `gh auth status`. Both are `warn` checks, never failures — the session's own work needs no gh and the push rung is plain git, so the run is worth starting either way; the warning names the fix (`brew install gh` / cli.github.com, `gh auth login`). Auth is skipped when `gh` itself is missing, same one-line stance as the agent checks.
- Root (#1326): a `warn` check, not a failure. `sudo` moves `HOME`, so both agents lose their credentials and every run dies identically (#1323), but a container legitimately runs as root, so this is said rather than enforced. Names `$SUDO_USER` when there is one.
- `ok` counts failures only, so a warning travels without blocking. `preflightProblems(result)` renders the failures one line each.
- `--fake` runs need none of this — preflight only gates live runs.
- `CliProbe` (formerly `VersionProbe`, still exported as an alias) is injectable so tests need no real CLI; it merges stdout and stderr because the two CLIs disagree about where a status line belongs.
