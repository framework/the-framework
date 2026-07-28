Registers every dashboard telefunction under the client-baked Telefunc keys, since the no-Vite server cannot discover implementations that live in this package by file path.

## TLDR

- The client bakes each RPC key as `"<telefuncFilePath>:<exportName>"` with paths like `/server/reads.telefunc.ts`; `DASHBOARD_TELEFUNC_KEYS` holds those paths so a rename is a one-liner.
- `registerDashboardTelefunctions` (idempotent) walks every function export of the seven telefunc modules and registers each under its own export name via Telefunc's `__decorateTelefunction`.
- `registeredTelefunctionNames()` exposes what was registered so a test can hold it against the modules' exports.

## Decisions

- Registering *every* function export by construction makes the #866 failure impossible: a telefunction that was exported, shimmed, but never registered failed at runtime with a 400 and nothing else (how per-project preferences shipped broken).
- `appRootDir` is cosmetic — not part of the match key, and shields are off on the mount (see dashboard/telefunc-serve.ts).
