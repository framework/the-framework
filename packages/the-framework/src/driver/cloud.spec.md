`Driver` that hands the run to Claude Code on the web (#610): runs the CLI's own `--cloud` flag under a pty, captures the claude.ai session URL it prints, and ends the run at the hand-off.

## TLDR

- `CloudDriver` (`name: 'claude-web'`) marks itself `handsOff: true` (#1225): a cloud session exposes no read-back API of any kind (no status, no transcript), so everything after the first prompt would be reading the driver's own summary as if it were the agent's answer.
- `CloudSession.prompt` hands off exactly once per session: the first prompt spawns the CLI, watches ANSI-stripped output for `https://claude.ai/code/session_...`, aborts the child the moment the URL lands, and stores it; every later prompt reports the existing hand-off without spending another session.
- The turn/result carry the session URL (`sessionLink`, #1317) and `claude --teleport <id>` as the continuation path; a `cloud <url>` action event is what the run view links through.
- No `readCode` (workspace is in a cloud VM), no `readQuota` (same subscription the local driver reports).

## Problems

- `--cloud` refuses to run when stdout is a pipe (a non-interactive invocation would silently run locally). The check is about the terminal, not a human, so the CLI runs under a pty supplied by `script` — handling both dialects (BSD: typescript file then command; util-linux: `-c <command>` then file).
- BSD `script` reads its stdin's terminal attributes to mirror onto the pty; a pipe is a socketpair and it dies with `tcgetattr: Operation not supported on socket`. stdin must therefore be a regular file (an empty temp file), which tcgetattr can fail on harmlessly.
- Untrusted workspace: the CLI shows a trust dialog and the cloud session is never created. The dialog is detected with every space removed (`trustthisfolder` — terminals may draw words with cursor moves), never auto-answered (trusting is the user's call); the failure names its own cure via `trustRootOf` — trust is recorded per directory and inherited, and a run's worktree is ephemeral, so the advice is to trust the project root once.
- One run must equal one cloud session: the loop prompts per pass (plan/build/review/backlog), and a session-per-prompt driver turned one run into six racing cloud VMs — the `handedOff` guard is that fix.

## Decisions

- No browser, no extension, no scraping of claude.ai — the two earlier candidates for #610, both ruled out by the Usage Policy; the mechanism is the CLI's own flag, so account/auth/quota are the user's (#495).
- `CLOUD_COMMAND` is a fixed shell literal; prompt and model travel as env vars (`FW_CLOUD_PROMPT`, `FW_CLOUD_MODEL`) so user text can never reach the shell as syntax. Exported so a test can pin the argument order.
- The prompt must come directly after `--cloud`: the description is that flag's own value, so a model flag placed between claimed the slot and the CLI stopped with "--cloud requires a description" — why it failed only for accounts with a model preference.
- Model ids are vetted against `[A-Za-z0-9._:-]` before being passed through.

## Facts

- Session id is `cloud-<counter>-<randomTag>`; the random tag keeps ids unique across daemon-spawned processes (counter restarts per process).
- Default timeout for session creation: 120s. Aborting the pty child is the *normal* ending once the URL is captured.

## Flows

- prompt (first): combineFraming → emit `start` → runPty(`script` + CLOUD_COMMAND, env vars) → scan output for session URL | trust prompt → abort child → on URL: store handedOff, emit `action: cloud <url>` + `result` with sessionLink → return summary turn; on trust: notice + error naming the root-trust fix; else error with output tail.
- prompt (later): return "already handed off" report, no spawn.
