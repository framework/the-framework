# Bug analysis: packages/framework/src/agent-driver.ts

## Business logic (high-level)

The one place `--run-on` becomes an executor (#1050/#610). Three branches, checked against the
SPEC:

- `target === 'actions'` → requires `actionsConfig`, else throws with the remedy ("set a GitHub
  origin remote and GH_TOKEN") — the SPEC's "refuses to start unconfigured". The throw happens
  before any driver is built, so nothing is half-constructed. Correct.
- `target === 'web'` → `new CloudDriver(opts.cloudConfig ?? {})` — every field defaulted, no
  config required (SPEC: the CLI already holds the account). Note the caller (cli.ts) does pass a
  `cloudConfig` when a daemon/extension is available, and the bare `{}` path throws a
  descriptive error only later, at prompt time, when no extension is wired — which is the
  CloudDriver's own contract, not this file's. Correct.
- anything else (including `undefined` and `'local'`) → `createDriver(opts)` with the exact
  options object — `target`/`actionsConfig`/`cloudConfig` ride along as excess properties that
  `createDriver` ignores, keeping the local path byte-identical to before the axis existed (the
  documented goal). Correct.

Design note verified: `CreateAgentDriverOptions extends CreateDriverOptions`, so the local axis
(driver id, claude opts) type-checks through unchanged; the GitHub fields stay off
`CreateDriverOptions` per the rationale.

Edge cases: an unknown `target` value cannot arrive here typed (`AgentLocation`), and runtime
values from a browser/config are validated by `isAgentLocation` upstream; if one slipped through
it would fall to the local branch — the safe default. No async, no state.

## Functions (low-level)

- `createAgentDriver(opts)` — pure factory; three-way branch as above. Verdict: correct.

## Bugs found

None found.
