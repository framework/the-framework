# Bug analysis: packages/framework/src/bin.ts

## Business logic (high-level)

The `the-framework` executable entry point (`bin.SPEC.md`): hand `process.argv.slice(2)` to
`runCli`, turn its resolved number into the process exit code, print any unhandled error and exit
nonzero. Eleven lines, no state.

Checked properties:

- **Exit-code plumbing** — `process.exitCode = code` (not `process.exit(code)`), so stdout/stderr
  flush and, critically for this project, the foreground dashboard/daemon keeps the loop alive
  until `runCli` resolves (MEMORY.md: "The CLI always runs in the foreground"). A forced
  `process.exit` here would truncate output on short commands; the current form is right.
- **Rejection path** — `.catch` prints the raw error (`console.error(err)`, which for `Error`
  includes the stack — appropriate for an *unhandled* error per the SPEC) and sets exit code 1.
  No re-throw, so no unhandledRejection double-report.
- **Shebang** — `#!/usr/bin/env node` present, required for the npm bin entry.
- **Ordering** — the `.then` only runs after the CLI (including a served dashboard) fully
  resolves; Ctrl-C handling lives in cli.ts (`armInterrupt`: first SIGINT aborts, second
  `process.exit(130)`), so bin.ts correctly owns nothing about signals.
- **Edge cases** — `runCli` returning a non-integer is not possible per its signature
  (`Promise<number>`); a synchronous throw *inside* `runCli` before its first await would still be
  captured by the promise machinery since `runCli` is async. If the event loop holds stray refs
  after `runCli` resolves the process would linger — that is a property of what cli.ts leaves
  running (see the await-gate keepalive finding in await-gate.BUG-ANALYSIS.md), not of this file.

## Functions (low-level)

- **Top-level expression** — `runCli(argv).then(set exitCode).catch(print + exitCode 1)`. Inputs:
  the process argv tail; outputs: the exit code side effect. No races (single chain), no resource
  ownership. Verdict: correct.

## Bugs found

None found.
