The dashboard-to-run steering channel (#344): the daemon appends `ControlEntry` lines to `.the-framework/control.jsonl` and the live run tails them — the reverse of the events log, same file-is-the-seam design, no run↔daemon IPC.

## TLDR

- Entry kinds: `stop` (Stop button), `choice` (resolve a parked gate by id/pick/by), `message` (live chat to the run, #714, with optional `via` surface name, #917), `handoff` (arm/disarm end-of-session push/PR, #1102), `bind` (bind a project-less topic run to a project, #1121), `merge` (the user's Merge action, #1391: arm the full ladder + record the human authorization the #1363 gate honors instead of the agent's signal).
- `appendControl` / `resetControl` / `controlPath`; `watchControl` tails via `JsonlTailer` + `followFile` (`fs.watch` on `.the-framework/` plus a poll backstop, since `fs.watch` is unreliable across platforms), unref'd so steering never keeps the process alive.
- `isControlEntry` shape-checks every parsed line; malformed or unknown lines are skipped so a bad write can never crash a run.

## Decisions

- A run truncates the control log at start (`resetControl`) so a previous run's picks can never fire into this one — gate ids like `plan-approval` repeat across runs.
- `handoff` is steering rather than an event because it is an instruction that must reach a run whose dashboard tab was opened after it started; the run echoes what it applied back as an event, which is what the checkboxes read. Both booleans must be real booleans — a half-written entry would otherwise disarm by accident, and this decides whether the session's work reaches the remote.
- `message.via` is optional (older entries have none) but a present one must pass `isSafeVia`: it is written into a line-parsed conversation heading, and a surface names itself (#917).
- `bind` requires a non-empty `projectId` — it decides which project the run re-homes into (#1122 does the worktree move).
