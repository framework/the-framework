# Bug analysis: packages/framework/dashboard/lib/status-tone.ts

## Business logic (high-level)

A four-entry colour map for `AgentMeta.status` (`running`/`done`/`stopped`/`failed` → primary/success/warning/danger), shared by every list that shows a status so one status can never render as two colours. The SPEC adds: "any other status is left uncolored" — the `Record<string, string>` lookup returns `undefined` for unknown keys, which callers pass to `className` composition where it drops out. The four keys match the daemon's status vocabulary (verified against `AgentMeta.status` usage: `running`, `done`, `stopped`, `failed`); no fifth status exists to miss.

The type is `Record<string, string>` rather than `Record<AgentStatus, string>`, so a renamed status would not be a compile error here — a strictness wish, not a bug (the SPEC explicitly wants unknown → uncolored).

## Functions (low-level)

- `STATUS_TONE` — exported constant; tailwind token classes consistent with the rest of the design system (`text-primary`/`text-success`/`text-warning`/`text-danger`, same tokens `agent-status.ts` and `ticket-priority.ts` use). Verdict: correct.

## Bugs found

None found.
