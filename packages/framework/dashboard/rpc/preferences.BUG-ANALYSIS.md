# Bug analysis: packages/framework/dashboard/rpc/preferences.ts

## Business logic (high-level)

Typed client stubs for the settings RPCs. Name fidelity verified against
`src/dashboard-rpc/preferences.ts` via `index.ts`: onPreferences, savePreferences,
patchPreferences, onProjectPresets, saveProjectPresets, onEditors, onNotifyChannels,
saveDiscordCredentials — all eight exist server-side under these exact names, and the server
module exports no additional RPC this file forgot (the #866 class of bug — exported but never
registered — is prevented server-side by building `RPC_HANDLERS` from the module exports, and
client-side by this file's 1:1 list).

Type-only re-exports: `export type *` from the implementation module plus `EditorInfo` from
`src/dashboard/open-in-app.js` — both erased at build; the comment's claim that no server code
reaches the bundle holds (type-position imports only).

The SPEC's write-only Discord credential model is a server-side property (`saveDiscordCredentials`
takes the patch; reads only report presence) — nothing here can violate it.

## Functions (low-level)

- 8 `rpc(...)` consts — thin, name-checked stubs. Verdict for each: correct.

## Bugs found

None found.
