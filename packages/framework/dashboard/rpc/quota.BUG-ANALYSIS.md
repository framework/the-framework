# Bug analysis: packages/framework/dashboard/rpc/quota.ts

## Business logic (high-level)

Typed client stubs for the quota panel and Auto PM: onQuota, onAutoPm, sendAutoPmSweep — all
three verified against `src/dashboard-rpc/quota.ts`'s exports (via index.ts). The SPEC's
semantics (sweep-on-demand running even with auto-run off, narrowing to one routine/project,
stand-down reasons) live server-side; this file only has to address them correctly, and does.
`export type *` is erased; no server code reaches the bundle.

## Functions (low-level)

- `onQuota` / `onAutoPm` / `sendAutoPmSweep` — name-and-signature-pinned stubs. Verdict for
  each: correct.

## Bugs found

None found.
