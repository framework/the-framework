The backlog loop (#323): once the main work settles, consume the agent's own TODO backlog one gated entry per turn until empty — plus the parsing, priority-placement, and resume-note helpers around the backlog files.

## TLDR

- `parseTodoEntries()`: open entries = markdown list items (`-`, `*`, `1.`) whose checkbox is absent or unchecked; checked `[x]` = done; headings/prose/blanks are not entries.
- `findTodoBacklog()`: the flat file via `findFlatTodo` (`TODO_AGENTS.md`, or a legacy `tickets/TODO.md` / root `TODO.md`); a leftover session-scoped `TODO_<slug>.agent.md` is ignored (#1369).
- `appendTodoEntry()` (plain append — resume notes and agent follow-ups) vs `appendFlatTodoEntry()` (priority placement for dashboard picks, #697/#1164). Both write the flat queue — the durable one `promoteQueue` carries between branches (#624/#852).
- `insertTodoEntry()` (#1164): pure priority placement into the `## Priority N` sections — join an existing section's end, create before the first lower-priority section, or land above the first heading; a plain append had put a just-queued ticket at the *end* of the file, worked last.
- `nextQueuedTicket()` / `ticketForPrompt()` (#1117): the ticket the next drain run will pick up (first open entry of the flat backlog, same read as the sweep's) — a best guess that only labels an Overview lane, never starts or steers a run.
- `leaveResumeNote()` (#529): a paused run leaves `Resume <session-name>` on the backlog so a later run picks the work back up — the backlog is already what a run drains, so a resume note needs no machinery of its own.
- `runTodoLoop()`: read next open entry → per-item gate ("start the next item?", auto-accepted under autopilot) → prompt the agent to complete exactly that entry and check it off → repeat. Ends: `empty` / `stopped` / `stalled` / `max-items`.

## Problems

- Unattended safety: the run signal (Stop / budget cap #322) ends any turn, `DEFAULT_MAX_TODO_ITEMS` (25) bounds the run, and two consecutive items that leave the *next* entry untouched stop the loop instead of spinning (`MAX_STALLS` = 2). New entries appended by the work (e.g. Maintenance follow-ups) are fine — only the next entry standing still counts as a stall.
- The write helpers never throw (they run while a run is already unwinding, and must not mask the reason it stopped); a legacy `tickets/TODO.md` still needs its dir mkdir'd.

## Decisions

- Termination is Rom's call on the issue: stop when the backlog is empty. The framework only drives; the agent writes the backlog itself (large scope, Maintenance follow-ups, [Research] deep-dive picks).
- The per-item gate is interactive-only (like the plan-approval gate): a headless run emits no gate and proceeds (autopilot semantics, budget-capped).
- One `createTurnSignalEmitter` for the whole backlog, so `ready-for-merge` fires once across every item and a session name only re-emits on an actual rename.
- A backlog turn is a turn like any other: await gates and signals are honored (via `runAwaitRounds`); a declined plan ends the item turn and the stall check takes it from there.
- Plain append (no priority) is kept for resume notes and agent follow-ups: those are a running list whose order is theirs.
- The session-scoped `TODO_<SESSION_NAME>.agent.md` backlog is retired *as a drained queue* (#1369): `TODO_AGENTS.md` superseded it and the system prompt migrated long ago. A session file in a checkout is ignored here, not drained. The [Research] preset still writes one on purpose (42fd47d): its deep-dive picks are session notes, and putting them on the flat queue would spawn follow-up agents that delay the research itself.

## Facts

- The item prompt pins scope: "work on the FIRST open entry only … check the entry off (or remove it). Do not start any other entry."
- Drain detection (`ticketForPrompt`) keys off `drainsQueue(prompt)` from the preset catalog.

## Flows

- loop: `findTodoBacklog` → (first item: count log) → gate → item prompt via `runAwaitRounds` → re-read backlog → stall check → repeat until empty/cap/abort → result log + `TodoLoopResult`.
- pause/resume (#529): quota pause → `leaveResumeNote` appends `Resume <name>` → later run drains it as an ordinary entry.
