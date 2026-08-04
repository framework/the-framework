The driver seam — the one abstraction a coding-agent CLI is wrapped behind: `start` a session, `prompt` it, `dispose`. Five implementations: local Claude Code, local Codex, GitHub Actions, Claude cloud, and an offline fake.

## TLDR

- `types.ts` is the design record, not just shapes: the seam is **the code and the outcome, never the agent's tool calls**. Driver events (`text`, `action`, `rate-limit`, `notice`) feed the dashboard for visibility, but control flow never branches on them; `action` carries a tool's *name* only, never its arguments.
- `prompt` is the fresh-context unit: each loop pass is a fresh CLI invocation; personas are prompt framing, not separate agents. Resuming a session is the documented opt-out, used only by live chat.
- `agent-cli.ts` is the agent-agnostic process core (spawn detached, feed the prompt over **stdin** so long prompts never hit argv limits, stream lines through a parser, gate the turn on exit code — a non-zero exit fails the turn even after streamed text). `codex.ts`, `claude-code-quota.ts`, `session-support.ts`, `fake.ts`, `actions-zip.ts` (a tiny zip reader — Node ships deflate, not zip) are the smaller pieces.
- Per-file specs: `claude-code.spec.md`, `cloud.spec.md`, `actions.spec.md`, `child-registry.spec.md`.

## Decisions

- **Optional methods are the degradation pattern**: `readQuota`/`readCode`/`handsOff` are omitted rather than stubbed. `costUsd` is *omitted*, never `0` — zero reads as free, absent as unknown (Codex reports tokens but no price, so a cost cap cannot fire there and the CLI says so at startup).
- Enum-shaped driver fields stay open strings: an unknown rate-limit status is exactly the signal being captured, so it must surface rather than be dropped.
- Quota is a discriminated union so "we couldn't ask" can never be confused with "nothing is used"; transient failure reasons (this attempt) are distinguished from setup failures (this machine), and only the latter may invalidate a retained reading.

## Facts

- The session handle is reported by a dedicated event, separate from the turn result — a turn that never settles (stop, error, kill) used to take the resume handle down with it.
- Quota windows have no "day" kind: Claude measures a 5-hour session and a week, nothing daily — a feature was once specced against a limit that does not exist.

## Before modifying this file

Read this file's format at https://raw.githubusercontent.com/brillout/sdd/refs/heads/main/sdd.md
