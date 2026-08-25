# Bug analysis: packages/framework/src/control.ts

## Business logic (high-level)

The dashboard→agent steering channel (#344): the daemon appends `ControlEntry` lines to `.the-framework/control.jsonl`, the agent tails the file. Per `control.SPEC.md`: five instructions (stop / choice pick / message / handoff rung / merge); a fresh channel per agent (truncate at start so a previous agent's picks never replay — gate ids repeat); malformed lines are skipped, never fatal; the watch never keeps the process alive.

Invariants:

- **File is the seam**: no IPC; `appendControl` mkdir+append, `watchControl` = `JsonlTailer` + `followFile` on the `.the-framework/` directory with a 300ms poll backstop and `unref: true`. `followFile` (read for context) survives a nonexistent/unwatchable directory (fs.watch throw is caught; the poll alone is a complete tail) and unrefs both handles — so the spec's "never keeps a process alive" and "watch is unreliable, poll backstops" both hold.
- **Fresh channel**: `resetControl` writes `''` in place (same inode, truncate). The tailer detects shrink (`size < offset`) and same-length rewrite (mtime advanced) and re-reads from the top; a watcher started *after* the reset sees only new entries (pinned by test). Ordering: the agent calls `resetControl` before `watchControl` (cli.ts does reset→watch), so a stale pick can't be delivered in the gap.
- **Half-written lines cannot act**: JSON.parse failure is skipped by the tailer; a parsed-but-wrong shape is dropped by `isControlEntry`. The one safety-critical field — the handoff rung — is validated by value (`isHandoffLevel`), because a coerced/absent rung could silently disarm publishing.
- **Concurrent appends**: the daemon is the only writer and single-process; O_APPEND keeps whole small lines atomic on POSIX regardless. No torn-line risk beyond what the tailer already tolerates.

Edge noted (reliance, not a bug): `isControlEntry` does not require `by` on a `choice` entry although the type declares it. A hand-crafted line `{"kind":"choice","id":"g","pick":"x"}` would be dispatched with `by: undefined`, which cli.ts forwards into the `choice-resolved` event (where `by` is then dropped by JSON serialization). The only writer (`appendControl` from the daemon's RPC layer) always supplies `by`, and a torn write fails JSON.parse entirely, so no real producer hits this; the guard's job is shape safety for the fields consumers branch on, and nothing branches on a missing `by`.

## Functions (low-level)

- `CONTROL_FILE` / `controlPath(cwd)` — `join(cwd, FRAMEWORK_DIR, 'control.jsonl')`. Correct.
- `ControlEntry` — the five kinds; `handoff` carries one rung (B5: checkboxes resolve impossible combinations down on the sender's side); `merge` is a pre-commitment, not an abort (consumed in cli.ts as arm-`merge` + `mergeAuthorized` + resolving only `todo-next*` gates). Matches SPEC. Correct.
- `appendControl(cwd, entry)` — mkdir recursive then append one JSON line. No escaping issues (JSON.stringify never emits raw newlines). Correct.
- `resetControl(cwd)` — mkdir + write `''`. Truncation in place is exactly what the tailer's shrink detection expects. Correct.
- `watchControl(cwd, onEntry, pollMs)` — tailer parses each line, `isControlEntry` filters, `followFile` drives with `unref: true`. Returns `{ close: stop }`; `followFile`'s stop is idempotent (guards on `stopped`, clears interval, closes watcher), matching the interface doc. Correct.
- `isControlEntry(value)` — `stop`/`merge` by kind alone; `handoff` requires a real rung; `message` requires non-empty string text (empty and missing text dropped — pinned by tests); `choice` requires non-empty string id and a pick that is a string or an all-strings array (`[]` legitimately allowed for multi-selects, documented and tested). Extra fields ignored (B3 `via` case tested). `null`/non-object rejected up front. Correct.

## Bugs found

None found.
