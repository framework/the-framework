# Bug analysis: packages/framework/dashboard/rpc/projects.ts

## Business logic (high-level)

Typed client stubs for the project RPCs. Name fidelity verified against
`src/dashboard-rpc/projects.ts` (via index.ts's re-export list): onProjects, sendAddProject,
sendPickProjectDirectory, onOnboarding, onRepoAutoMerge, onDriverReady — all six match the
server's export names exactly, and the server module exports no further RPC missing here. The
two-step add flow (pick directory, then register behind the trust confirmation) is represented as
the two separate handles the SPEC describes. `export type *` is type-only; no server code in the
bundle.

## Functions (low-level)

- 6 `rpc(...)` consts — name-and-signature-pinned stubs; declaration order differing from the
  server's is cosmetic. Verdict for each: correct.

## Bugs found

None found.
