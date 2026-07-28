The registry-file-backed half of the Discord credentials (#1095): a `DiscordCredentialsStore` over `readSecrets`/`writeSecrets`, split from the browser-safe rules so no `node:*` edge is reachable from what the dashboard imports.

## TLDR

- `status()` reports presence + origin (env vs stored) via `discordCredentialStatus`.
- `save(patch)` validates each credential, writes to the registry secrets, then fires `onChange` — the daemon passes its Discord-services reload, so a pasted token starts the bot on the spot instead of at the next restart.

## Decisions

- Refuses to edit a credential set in the environment: the write would land in the file and be shadowed on the next read, which is worse than saying no.
- `onChange` runs after the write, so a reload can never read the value it is replacing; a reload that throws is not a failed save (the credential is stored; the next daemon start uses it). Wrapped as `Promise.resolve().then(() => onChange())` rather than `Promise.resolve(onChange())` — a synchronous throw would otherwise happen while building the argument, escape the catch, and fail a save that already landed.
