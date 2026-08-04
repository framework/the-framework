The cloud driver: hand a task off to a real Claude Code cloud session (claude.ai) — at zero local CPU, with **no read-back of any kind**.

## Problems

- `claude --cloud` refuses a piped stdout (a non-interactive invocation would silently run locally), so the driver runs it under a `script` pseudo-terminal — handling both the BSD and util-linux dialects.
- BSD `script` inspects its own stdin, and a pipe is a socket it rejects — so stdin must be a regular file, created just to be that file descriptor.
- A cloud session exposes no status/transcript/output API, only its URL. So the turn resolves at session **creation** (the driver aborts the pty the moment the session URL appears), and the run drops every phase after build — without this, the checklist read the driver's own hand-off summary as agent output and produced bogus verdicts and unanswerable gates.

## Decisions

- Injection stance: the command line is a fixed literal; prompt and model travel as environment variables (model additionally regex-gated), so nothing typed is ever parsed as shell syntax.
- **One hand-off per session, ever**: the loop prompts several times per run, and a session-per-prompt turned one run into six cloud VMs racing on one repository. Later prompts report "already handed off" and spend nothing — there is no way to send a cloud session a second message anyway.
- The workspace-trust dialog is detected (with whitespace stripped — terminals draw with cursor moves) but deliberately **not** answered: trusting a workspace is the user's one-time call. Advice names the project root, not the worktree, because trust is inherited from the root and the worktree is gone before the user could act.

## Facts

- The prompt must come directly after `--cloud` (it is that flag's value, not a positional) — argument order is exported for a test because getting it wrong only failed on accounts with a model preference.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
