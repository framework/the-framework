Generic `execFile`-backed CLI runner factory (`cliRunner`), configured per binary, with timeout kills distinguished from real failures (#997).

## TLDR

- `cliRunner({bin, timeoutMs, maxBuffer?, preferStderr?})` builds a `CliRunner(args, cwd) => Promise<stdout>` that rejects on non-zero exit.
- `CliTimeout` is a flat number or a function of the args — one binary is not one operation (`git push` talks to a remote, `git rev-parse` reads a file).
- `CliTimeoutError` / `isCliTimeout()` — recognisable timeout rejections.

## Problems

- A SIGTERM'd `git push` usually writes nothing to stderr, so a timeout kill surfaced as a bare "Command failed: git push ..." that reads like a rejected push (#997).
- `execFile` sets `killed: true` on both timeout and a `maxBuffer` overrun; only the latter carries `code === 'ENOBUFS'`, which is how the two are told apart.

## Decisions

- `isCliTimeout` checks the `timedOut === true` brand rather than `instanceof`, so a value that crossed a module boundary is still recognisable.
- `preferStderr` rejects with the CLI's own trimmed stderr (e.g. `gh`'s "not logged in") instead of the generic exec message — exactly what the dashboard should show.
- Replaces five hand-written wrappers around `git`/`gh` that differed only in binary, timeout, and failure reporting.
