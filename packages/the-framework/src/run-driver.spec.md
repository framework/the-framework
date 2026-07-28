The one place a run's `--run-on` target becomes a real `Driver` (#1050): `createRunDriver()` maps `actions` → `ActionsDriver` (#934, requires resolved owner/repo/token), `web` → `CloudDriver` (#610, a Claude Code cloud session), anything else → the local agent driver via `createDriver` (byte-identical to before targets existed).

## Facts

- Kept off `createDriver` on purpose: ActionsDriver's owner/repo/token do not fit `CreateDriverOptions`, and folding them in would push GitHub config onto every local run.
- `web` needs no config of its own: the CLI already holds the account it signs the cloud session in with — the same auth the local driver runs on. Missing `actionsConfig` for target `actions` throws with a set-GH_TOKEN hint.
