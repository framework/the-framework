The dashboard's Telefunc RPC surface (#405), implemented in `the-framework` and served in-process by whichever host mounts it (daemon, per-run foreground, or public relay).

## TLDR

- `context.ts` — accessors over the Telefunc request context; each host wires only the capabilities it has.
- `reads.telefunc.ts` — the read model: runs, docs/tickets/log, git/file-tree reads, cross-project rollups, bridge state.
- `control.telefunc.ts` — the write side: run steering via control log, start/preview, worktree removal, handoff push/PR, ticket queueing.
- `events.telefunc.ts` + `events-tail.ts` + `stream-channel.ts` — the live event stream: tail `events.jsonl` (or an in-memory source) into a Telefunc Channel.
- `projects.telefunc.ts` — project list/add, onboarding suggestion, Claude trust check.
- `preferences.telefunc.ts` — user/project preferences, project presets, editors, Discord credentials.
- `quota.telefunc.ts` — quota panel, auto-PM report, manual sweep.
- `devices.telefunc.ts` — saved-devices health pings.
- `relay-run.ts` + `relay-dispatch.ts` — the two halves of the remote-run relay (#1067): forward a run-scoped RPC to a connected device / answer one against the device's home checkout.
- `register.ts` — registers every telefunction under the client-baked `/server/*.telefunc.ts` keys.
- `index.ts` — barrel for the whole surface.

## Decisions

- Capability-by-context: hosts differ only in which context fields they wire; RPCs degrade uniformly (empty reads, typed `{ ok: false, error }` writes) where a field is unset, so the relay stays read-mostly and holds no user credentials.
- Implementations live here (not in framework-dashboard) so the daemon serves them in-process and `sendStart` can reach its `startRun` closure; the dashboard client imports them through re-export shims to keep the baked RPC keys stable.
- Reads are forgiving by convention: unknown project / failed read → empty value, never a thrown RPC.

## Facts

- Telefunc's `getContext` is only available synchronously at the top of a telefunction — context must be read before the first await (#1077, and `withWorktreeRemoval`).
- Since #736 each run lives in its own worktree and reads/writes its own `.the-framework/events.jsonl` and `control.jsonl` there; run-addressed RPCs must resolve through `resolveRunPath` (#749) or they hit the wrong checkout.
- Data flow symmetry: events flow run → `events.jsonl` → tail → Channel → browser; steering flows browser → telefunction → `control.jsonl` → run.
