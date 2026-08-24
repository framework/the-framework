Priority: 7
Topics: [enhancement, the-framework]
GitHub: [#1132](https://github.com/gemstack-land/the-framework/issues/1132)

# Interrupt the current turn (steer in place), not only a hard Stop

## TLDR

Today Stop is a hard kill: `{kind:'stop'}` aborts the run and SIGTERM/SIGKILLs the one-shot `claude -p` process — the in-flight turn is lost, and interrupting the *first* turn leaves the session unresumable (no session id yet). Wanted: a soft `{kind:'interrupt'}` that stops the current work and accepts a new instruction into the same live session, like Ctrl+C in the Claude Code CLI. The spike removed the architectural blocker: the already-installed CLI (2.1.219) supports it via one persistent `claude -p --input-format stream-json --output-format stream-json --replay-user-messages` process — interrupt is a first-class `control_request` (acknowledged), the process survives, and a follow-up message steers in place. No Agent SDK needed.

## Why it matters

Interrupt-and-steer is a core agent-control affordance: redirecting an agent mid-turn today means killing it and starting over. The dashboard side is small once the driver goes persistent (an "Interrupt" action beside Stop, keeping `stop` as the hard kill). Remaining opens: abort vs finish the in-flight tool call on interrupt, and how this composes with autopilot and handoff arming (#799/#1102).

## Source

Imported from GitHub issue [gemstack-land/the-framework#1132](https://github.com/gemstack-land/the-framework/issues/1132), created 2026-07-24, labels: `enhancement`, `priority: high`, `priority: medium`, `the-framework ♻️`, 7 comments.

### Original description

## Problem

Today Stop (and the framework's own interrupt) is a hard process kill: it writes `{kind:'stop'}` to the control log, which aborts the run's AbortController and SIGTERM/SIGKILLs the one-shot `claude -p` process tree for the current turn. There is no way to interrupt the current turn and immediately steer the same live session, the way Ctrl+C does in the Claude Code CLI / web.

Consequences: the current turn's in-flight work is lost (no `result`, no session id emitted for that turn), and "continuing" is actually a new `claude -p --resume <id>` process, which only works if a prior turn already reported a session id. Interrupting during the first turn leaves the session unresumable.

## Why this matters

Interrupt-and-steer is a core agent-control affordance. To redirect an agent mid-turn today you must kill it (losing that turn's output, and on a first turn its resumability) and start over. A real interrupt would let you stop the current work and send a new instruction into the same conversation without losing the session.

## The blocker (architectural)

Each turn runs as a one-shot `claude -p --output-format stream-json` invocation, so there is no persistent live session to interrupt in place, only a process to kill. Enabling interrupt requires the Claude Code driver to run an interactive / streaming session (Claude Agent SDK streaming input, or `claude` stream-json input mode) that:

- keeps one session process alive across turns,
- supports interrupting the current turn (abort the in-flight tool call, then accept input),
- accepts a follow-up message into the same live session (steer in place),
- keeps the session id continuously, so resume/continuity is not gated on a turn completing.

## Dashboard side (once the driver supports it)

- A new control entry, e.g. `{kind:'interrupt'}`, distinct from `stop`.
- An "Interrupt" action for live runs (beside or in place of Stop). Interrupt keeps the run live and returns focus to the composer to send the next message into the same session.
- Keep `stop` as the hard kill; `interrupt` is the soft, steer-in-place path.

## Open questions

- SDK streaming vs `claude` stream-json input mode for the interactive driver.
- In-flight tool call on interrupt: abort immediately vs let it finish then pause.
- How this composes with autopilot and the handoff arming (#799/#1102).

### Notes from the GitHub thread

- Spike result: the installed CLI already supports everything asked (verified on 2.1.219, no Agent SDK needed). One persistent `claude -p --input-format stream-json --output-format stream-json --replay-user-messages` process: a long task was sent, interrupted mid-turn (`{"type":"control_request","request":{"subtype":"interrupt"}}` on stdin, acknowledged with `{"subtype":"success","still_queued":[]}`), and a second message was answered on the same process — steer-in-place works; the interrupted turn ends with `subtype=error_during_execution`.
- Traycer research (2026-07-30): it doesn't interrupt — it avoids needing to. Traycer is an orchestration layer that splits an objective into phases handed to existing agents (spawned as subprocesses, like our `claude -p`), steers at phase boundaries, and runs a verify pass per phase; any mid-turn interrupt behaviour is inherited from the underlying agent. That phase-plus-verify strategy is the opposite of our black-box stance (#1373), so this issue stays on the first strategy: genuinely interrupt the turn (the spike showed the installed CLI already supports it).
- Maintainer direction (2026-07-30): ideally TF behaves like CC CLI/web — you can send messages while the agent is working (nice but post-MVP-able); in general keep TF as much as possible a "transparent"/thin layer on top of CC CLI/web. Also worth borrowing as much as possible from Traycer's implementations — they have lots of experience.
- Triage (2026-08-24): confirmed still a gap — Stop is a kill, chat waits for the turn (`claude -p` + `--resume`). Still post-MVP; kept open through the mass triage.
