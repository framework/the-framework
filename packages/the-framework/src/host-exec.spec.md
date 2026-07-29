A `DeployExecutor` that runs shell commands on the host in the workspace the wrapped agent built, so real deploy targets (e.g. `cloudflareTarget`) can install/build/run `wrangler` against the code the agent just wrote.

## TLDR

- `hostExecutor(cwd, opts)` → `{ exec(command, execOpts) }` via `node:child_process` `exec`; relative `execOpts.cwd` resolves against the workspace `cwd`, env layers `opts.env ?? process.env` under per-call overrides.
- Never rejects: non-zero exit or spawn error resolves to an `ExecResult` `{ stdout, stderr, exitCode }`, matching the runner-session contract deploy targets expect.

## Facts

- Exists because ai-autopilot's `LocalRunner` cannot serve deploys: it mkdtemps a fresh workspace and deletes it on dispose, so deploys must run on the host in the persistent workspace instead.
- Default output buffer is 16 MiB per command; `execOpts.timeoutMs` defaults to 0 (no timeout).
